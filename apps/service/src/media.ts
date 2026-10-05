/* ═══ MEDIA PIPELINE — FFmpeg/ffprobe real (Canter v1 + Dresser v1) ═══
   El core ya decide (grafo); este módulo EJECUTA: probe, proxy, filmstrip,
   waveform, corte frame-accurate, Ken Burns, captions quemadas, render final.
   Todo local. Errores humanos, timeouts por proceso (watchdog del JobEngine aparte). */
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, mkdir, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';

function run(cmd: string, args: string[], timeoutMs = 600_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // execFile con argv: NUNCA shell → los paths con espacios/acentos/'()[] no interpolan nada.
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd} falló: ${(stderr || err.message).slice(-600)}`));
      else resolve({ stdout, stderr });
    });
  });
}
/* ── Hash streaming: memoria ~constante (chunks de 1 MiB) aunque el máster pese GB. ── */
export const sha256File = (p: string): Promise<string> => new Promise((resolve, reject) => {
  const hash = createHash('sha256');
  const stream = createReadStream(p, { highWaterMark: 1024 * 1024 });
  stream.on('data', chunk => hash.update(chunk));
  stream.on('error', (err: NodeJS.ErrnoException) =>
    reject(new Error(`No se pudo leer ${p} para calcular el hash: ${err.code ?? ''} ${err.message}`.trimEnd())));
  stream.on('end', () => resolve(hash.digest('hex')));
});

/* ── Probe ── */
export interface MediaInfo {
  path: string; hash: string; durationSec: number; width: number; height: number;
  fps: number; fpsNumerator?: number; fpsDenominator?: number; codec?: string;
  hasAudio: boolean; sizeBytes: number;
}
export async function probe(file: string): Promise<MediaInfo> {
  await stat(file); // error humano si no existe
  const { stdout } = await run('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', file], 30_000);
  const j = JSON.parse(stdout) as { format?: { duration?: string; size?: string }; streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string; r_frame_rate?: string }> };
  const v = j.streams?.find(s => s.codec_type === 'video');
  const a = j.streams?.some(s => s.codec_type === 'audio');
  if (!v) throw new Error('El archivo no tiene pista de video.');
  const rate = (v.avg_frame_rate || v.r_frame_rate || '25/1').split('/').map(Number);
  const fps = rate[1] ? rate[0] / rate[1] : 25;
  // fps racional CANÓNICO cuando ffprobe lo reporta como fracción utilizable
  // (p.ej. 30000/1001); el float `fps` queda solo como frontera de visualización.
  const rational = rate[1] > 0 && rate[0] > 0 ? { fpsNumerator: rate[0], fpsDenominator: rate[1] } : {};
  return {
    path: file, hash: await sha256File(file),
    durationSec: Number(j.format?.duration ?? 0), width: v.width ?? 1080, height: v.height ?? 1920,
    fps: Math.round(fps * 1000) / 1000, hasAudio: !!a, sizeBytes: Number(j.format?.size ?? 0),
    ...(v.codec_name ? { codec: v.codec_name } : {}),
    ...rational,
  };
}

/* ── Ingest: proxy 540p + filmstrip + waveform (jobs en segundo plano) ── */
export async function makeProxy(src: string, dir: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  const out = join(dir, 'proxy_540.mp4');
  await run('ffmpeg', ['-y', '-i', src, '-vf', "scale=-2:min(540\\,ih)", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out]);
  return out;
}

/* ── Duración ligera (solo contenedor; NO hash-ea el máster para esto) ── */
export async function probeDurationSec(file: string): Promise<number> {
  await stat(file);
  const { stdout } = await run('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', file], 30_000);
  const j = JSON.parse(stdout) as { format?: { duration?: string } };
  const duration = Number(j.format?.duration ?? 0);
  if (!(duration > 0) || !Number.isFinite(duration)) throw new Error(`ffprobe no reportó una duración válida para ${file}.`);
  return duration;
}

/** Timestamps (segundos) de N thumbnails repartidos por TODA la duración:
    midpoint de cada segmento duration/N — determinista y uniforme por construcción. */
export function planThumbnailTimestamps(durationSec: number, count: number): number[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error('Duración inválida para el filmstrip.');
  if (!Number.isInteger(count) || count < 1) throw new Error('El filmstrip necesita al menos 1 thumbnail.');
  return Array.from({ length: count }, (_, i) => +(durationSec * (i + 0.5) / count).toFixed(3));
}

/* ── Filmstrip: exactamente N thumbnails uniformes sobre TODA la duración.
    Un seek por thumbnail (-ss antes de -i): decodifica ~1 frame por punto,
    memoria ~constante, sin importar el fps (23.976…60). Sin mod(n,X). ── */
export async function makeFilmstrip(src: string, dir: string, count = 24, cols = 6): Promise<string> {
  const duration = await probeDurationSec(src);
  const timestamps = planThumbnailTimestamps(duration, count);
  const grid = Math.max(1, Math.floor(cols));
  const rows = Math.ceil(count / grid);
  await mkdir(dir, { recursive: true });
  const framesDir = await mkdtemp(join(tmpdir(), 'abrxs-strip-'));
  try {
    for (const [i, t] of timestamps.entries()) {
      const frame = join(framesDir, `f${String(i).padStart(3, '0')}.jpg`);
      const args = (at: string): string[] => ['-y', '-ss', at, '-i', src, '-frames:v', '1', '-vf', 'scale=240:-2', '-q:v', '4', frame];
      try {
        await run('ffmpeg', args(t.toFixed(3)), 120_000);
        await stat(frame);
      } catch {
        // Seek caído fuera del último frame (contenedores con duración redondeada): reintento al final real.
        await run('ffmpeg', args(Math.max(0, duration - 0.05).toFixed(3)), 120_000);
      }
    }
    const out = join(dir, 'filmstrip.jpg');
    await run('ffmpeg', ['-y', '-framerate', '1', '-i', join(framesDir, 'f%03d.jpg'),
      '-vf', `tile=${grid}x${rows}:color=black`, '-frames:v', '1', '-q:v', '4', out], 120_000);
    return out;
  } finally {
    await rm(framesDir, { recursive: true, force: true });
  }
}
export async function makeWaveform(src: string, dir: string): Promise<string | null> {
  await mkdir(dir, { recursive: true });
  const out = join(dir, 'waveform.png');
  try { await run('ffmpeg', ['-y', '-i', src, '-filter_complex', 'showwavespic=s=1200x180:colors=#7fb4ff', '-frames:v', '1', out], 120_000); return out; }
  catch { return null; } // sin audio → null honesto
}

/* ── Transcripts: SRT / VTT / TXT plano ── */
export interface Segment { startSec: number; endSec: number; text: string; }
const ts = (s: string): number => {
  const m = s.trim().replace(',', '.').split(':').map(Number);
  return m.length === 3 ? m[0] * 3600 + m[1] * 60 + m[2] : m.length === 2 ? m[0] * 60 + m[1] : m[0];
};
export function parseSrt(text: string): Segment[] {
  return text.replace(/\r/g, '').split(/\n{2,}/).map(block => {
    const lines = block.split('\n').filter(Boolean);
    const t = lines.find(l => l.includes('-->'));
    if (!t) return null;
    const [a, b] = t.split('-->');
    const body = lines.slice(lines.indexOf(t) + 1).join(' ').trim();
    return body ? { startSec: ts(a), endSec: ts(b), text: body } : null;
  }).filter((s): s is Segment => !!s);
}
export function parseVtt(text: string): Segment[] {
  return parseSrt(text.replace(/^WEBVTT.*\n/, ''));
}
/** TXT plano sin tiempos: reparte la duración del máster por peso de palabras (~2.6 w/s). */
export function parsePlainTxt(text: string, durationSec: number): Segment[] {
  const paras = text.replace(/\r/g, '').split(/\n{2,}/).map(p => p.replace(/\n/g, ' ').trim()).filter(Boolean);
  const words = paras.map(p => p.split(/\s+/).length);
  const total = words.reduce((a, b) => a + b, 0) || 1;
  const rate = Math.min(durationSec / total, 0.6); // máx 0.6s por palabra
  let t = 0;
  return paras.map((p, i) => {
    const d = Math.max(1.2, words[i] * rate);
    const seg = { startSec: +t.toFixed(3), endSec: +(t + d).toFixed(3), text: p };
    t += d; return seg;
  });
}
export function parseTranscript(text: string, durationSec: number): { format: 'srt' | 'vtt' | 'txt'; segments: Segment[] } {
  if (/^\s*WEBVTT/m.test(text)) return { format: 'vtt', segments: parseVtt(text) };
  if (/-->/.test(text)) return { format: 'srt', segments: parseSrt(text) };
  return { format: 'txt', segments: parsePlainTxt(text, durationSec) };
}
/** SRT del slice de una pieza (tiempos relativos a la pieza). */
export function sliceSrt(segments: Segment[], inSec: number, outSec: number): string {
  const fmt = (s: number) => {
    const ms = Math.round((s % 1) * 1000), t = Math.floor(s);
    return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };
  let n = 0;
  return segments.filter(s => s.endSec > inSec && s.startSec < outSec)
    .map(s => { n++; return `${n}\n${fmt(Math.max(0, s.startSec - inSec))} --> ${fmt(Math.min(outSec - inSec, s.endSec - inSec))}\n${s.text}`; })
    .join('\n\n');
}

/* ── Keywords para el Visual Director (determinista) ── */
const STOP = new Set(['de','la','que','el','en','y','a','los','del','se','las','por','un','para','con','no','una','su','al','es','lo','como','más','pero','sus','le','ya','o','este','sí','porque','esta','entre','cuando','muy','sin','sobre','también','me','hasta','hay','donde','quien','desde','todo','nos','durante','todos','uno','les','ni','contra','otros','ese','eso','ante','ellos','e','esto','mí','antes','algunos','qué','unos','yo','otro','otras','ella','si','me','the','and','for','are','but','not','you','all','can','her','was','one','our','out','day','get','has','him','his','how','its','new','now','old','see','two','way','who','did','yes','this','that']);
export function keywords(text: string, max = 6): string {
  const freq = new Map<string, number>();
  for (const w of text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9ñ]+/)) {
    if (w.length < 4 || STOP.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([w]) => w).join(' ');
}

/* ── Corte frame-accurate (re-encode) ── */
export async function cutPiece(src: string, inSec: number, outSec: number, outPath: string): Promise<string> {
  await mkdir(join(outPath, '..'), { recursive: true });
  await run('ffmpeg', ['-y', '-ss', inSec.toFixed(3), '-i', src, '-t', (outSec - inSec).toFixed(3),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', outPath]);
  return outPath;
}

/** Escapa un path para un VALOR de opción de filtergraph (p.ej. subtitles=…).
    Receta de dos niveles de la documentación oficial de FFmpeg ("Notes on
    filtergraph escaping") — VERIFICADA con ffmpeg real en tests/media.test.ts:
    nivel 1 (valor de opción) escapan \ ' :; nivel 2 (filtergraph completo)
    vuelven a escapar los backslashes del nivel 1 y además , ; [ ].
    Las variantes con comillas NO sobreviven el parser del grafo en ffmpeg 9. */
export const escapeFilterPath = (path: string): string => {
  const optionLevel = path.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:');
  return optionLevel
    .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:')
    .replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
};

/* ── Render final v1: corte + B-rolls Ken Burns (fullscreen) + captions quemadas ── */
export interface BrollOverlay { imagePath: string; inSec: number; outSec: number; motion: 'ZOOM_IN' | 'ZOOM_OUT' | 'STATIC'; }
export interface RenderFinalOpts {
  src: string; inSec: number; outSec: number; outPath: string;
  brolls?: BrollOverlay[]; srtPath?: string;
  captionStyle?: { fontName?: string; primaryColor?: string; outlineColour?: string; fontSize?: number };
  vertical?: boolean;
}
export async function renderFinal(o: RenderFinalOpts): Promise<string> {
  const args: string[] = ['-y', '-ss', o.inSec.toFixed(3), '-i', o.src, '-t', (o.outSec - o.inSec).toFixed(3)];
  const filters: string[] = [];
  let last = '0:v';
  const brolls = o.brolls ?? [];
  const fps = 30;
  brolls.forEach((b, i) => {
    args.push('-loop', '1', '-t', (b.outSec - b.inSec).toFixed(3), '-i', b.imagePath);
    const frames = Math.max(1, Math.round((b.outSec - b.inSec) * fps));
    const zoom = b.motion === 'STATIC' ? '1.05' : b.motion === 'ZOOM_OUT' ? `'max(1.0,1.12-0.12*on/${frames})'` : `'min(1.18,1.0+0.12*on/${frames})'`;
    filters.push(`[${i + 1}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z=${zoom}:d=1:s=1080x1920:fps=${fps},setsar=1,format=yuv420p[b${i}]`);
    const labelIn = i === 0 ? '[0:v]' : `[v${i - 1}]`;
    filters.push(`${labelIn}[b${i}]overlay=enable='between(t,${b.inSec.toFixed(2)},${b.outSec.toFixed(2)})'[v${i}]`);
    last = `v${i}`;
  });
  let vf = last === '0:v' ? '' : `[${last}]`;
  if (o.srtPath) {
    const st = o.captionStyle ?? {};
    const force = `FontName=${st.fontName ?? 'Helvetica'},FontSize=${st.fontSize ?? 16},PrimaryColour=${st.primaryColor ?? '&H00FFFFFF'},OutlineColour=${st.outlineColour ?? '&H90000000'},Outline=1,Bold=1,MarginV=60`;
    const sub = `subtitles=${escapeFilterPath(o.srtPath)}:force_style='${force}'`;
    vf = vf ? `${vf}${sub}[vout]` : `${sub}[vout]`;
    filters.push(vf);
  } else if (vf) {
    filters.push(`${vf}null[vout]`);
  }
  if (filters.length) args.push('-filter_complex', filters.join(';'), '-map', '[vout]');
  args.push('-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', o.outPath);
  await mkdir(join(o.outPath, '..'), { recursive: true });
  await run('ffmpeg', args, 1_800_000);
  return o.outPath;
}
export const tempDir = () => mkdtemp(join(tmpdir(), 'abrxs-'));
export const baseName = basename;
