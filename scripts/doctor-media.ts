/* ═══ DOCTOR — checks de MEDIA (ffmpeg/ffprobe/decode/H264/temp/disk) ═══
   Solo capacidades audiovisuales locales: NADA de providers AI, ComfyUI,
   MLX, DaVinci ni CapCut. VideoToolbox se reporta como INFO en macOS —
   nunca es requisito cross-platform. Importado por scripts/doctor.ts y
   testeable en tests/media.test.ts. */
import { execFile } from 'node:child_process';
import { statfs, mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export interface MediaReport { check: string; status: 'PASS'|'FAIL'|'WARN'|'INFO'|'SKIP'; detail: string }

function run(cmd: string, args: string[], timeoutMs = 60_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (!err) return resolve({ code: 0, stdout, stderr });
      const code = typeof err.code === 'number' ? err.code : 127; // 127 = binario no encontrado
      resolve({ code, stdout, stderr: err.code === 'ENOENT' ? `${cmd} no encontrado` : stderr });
    });
  });
}

const versionOf = async (bin: string): Promise<MediaReport> => {
  const { code, stdout, stderr } = await run(bin, ['-version']);
  if (code !== 0) return { check: bin, status: 'FAIL', detail: stderr.slice(0, 200) || `${bin} no ejecutable` };
  const version = /version\s+(\S+)/.exec(stdout)?.[1] ?? 'desconocida';
  return { check: bin, status: 'PASS', detail: `versión ${version}` };
};

/** Codec del FIXTURE DE DECODE: mpeg4 es NATIVO de libavcodec (sin librerías
    externas), presente en cualquier build razonable de ffmpeg y decodificable
    en todas partes. El check de decodificación NO debe depender de libx264 ni
    de ningún encoder H264: una instalación sin libx264 (p.ej. solo
    h264_videotoolbox) decodifica bien y debe salir PASS. */
export const DECODE_FIXTURE_CODEC = 'mpeg4';

/** Argumentos de encode POR CODEC — NUNCA pasar opciones de libx264 (p.ej.
    -preset) a otros encoders: h264_videotoolbox y los codecs nativos no las
    comparten. Mantener mínimos y verificados con ffmpeg real. */
export function encoderArgs(videoCodec: string): string[] {
  switch (videoCodec) {
    case 'libx264':
      return ['-c:v', videoCodec, '-preset', 'ultrafast', '-pix_fmt', 'yuv420p'];
    case 'h264_videotoolbox':
      return ['-c:v', videoCodec, '-pix_fmt', 'yuv420p'];
    default: // codecs nativos (mpeg4, ffv1…): sin opciones específicas
      return ['-c:v', videoCodec, '-pix_fmt', 'yuv420p'];
  }
}

/** Genera 1 s de video sintético (testsrc2 + audio sine) para probar decode/encode reales.
    run() RESUELVE aunque ffmpeg salga con error, así que aquí se valida TODO antes de
    devolver el path: exit code, existencia y tamaño > 0 — un encode fallido jamás puede
    producir un PASS del doctor (verificado por test negativo en tests/media.test.ts). */
export async function makeSyntheticFixture(dir: string, videoCodec: string): Promise<string> {
  const out = join(dir, `fixture_${videoCodec}.mp4`);
  const result = await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=1',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
    ...encoderArgs(videoCodec), '-c:a', 'aac', '-shortest', out], 120_000);
  if (result.code !== 0)
    throw new Error(`ffmpeg falló con codec "${videoCodec}" (exit ${result.code}): ${(result.stderr || result.stdout || 'sin salida').slice(-300)}`);
  const info = await stat(out).catch(() => null);
  if (!info || info.size <= 0)
    throw new Error(`ffmpeg no produjo salida válida con codec "${videoCodec}": ${out}`);
  return out;
}

export async function runMediaChecks(): Promise<MediaReport[]> {
  const reports: MediaReport[] = [];
  const ffmpeg = await versionOf('ffmpeg');
  const ffprobe = await versionOf('ffprobe');
  reports.push(ffmpeg, ffprobe);

  if (ffmpeg.status !== 'PASS' || ffprobe.status !== 'PASS') {
    // Sin binarios no se puede probar nada más: honesto y accionable.
    for (const check of ['decodificar video (sintético)', 'encode H264', 'VideoToolbox (macOS)'])
      reports.push({ check, status: 'SKIP', detail: 'Requiere ffmpeg/ffprobe instalados.' });
    return reports;
  }

  const temp = await mkdtemp(join(tmpdir(), 'abrxs-doctor-'));
  try {
    // Escritura en temp (prerrequisito de proxies, filmstrips y renders).
    try {
      const probe = join(temp, '.write-test');
      await writeFile(probe, 'abrxs');
      await rm(probe);
      reports.push({ check: 'directorio temp escribible', status: 'PASS', detail: temp });
    } catch (error) {
      reports.push({ check: 'directorio temp escribible', status: 'FAIL', detail: error instanceof Error ? error.message : 'no escribible' });
    }

    // Espacio libre en el volumen de temp (los renders de másteres ocupan GB).
    try {
      const { bavail, bsize } = await statfs(tmpdir());
      const freeGb = (Number(bavail) * Number(bsize)) / 1024 ** 3;
      reports.push({ check: 'espacio libre en temp', status: freeGb < 5 ? 'WARN' : 'PASS', detail: `${freeGb.toFixed(1)} GB libres` });
    } catch {
      reports.push({ check: 'espacio libre en temp', status: 'SKIP', detail: 'statfs no disponible en esta plataforma' });
    }

    // Lectura de video real: sintetizar 1 s con codec NATIVO (mpeg4) y sondearlo
    // con ffprobe. INDEPENDIENTE de los encoders H264: sin libx264 también debe PASS.
    try {
      const fixture = await makeSyntheticFixture(temp, DECODE_FIXTURE_CODEC);
      const { stdout } = await run('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', fixture]);
      const info = JSON.parse(stdout) as { streams?: Array<{ codec_type?: string; width?: number; codec_name?: string }> };
      const video = info.streams?.find(s => s.codec_type === 'video');
      reports.push(video?.width
        ? { check: 'decodificar video (sintético)', status: 'PASS', detail: `${DECODE_FIXTURE_CODEC} 320x240 leído por ffprobe (independiente de encoders H264)` }
        : { check: 'decodificar video (sintético)', status: 'FAIL', detail: 'ffprobe no vio pista de video' });
    } catch (error) {
      reports.push({ check: 'decodificar video (sintético)', status: 'FAIL', detail: error instanceof Error ? error.message.slice(-300) : 'falló el fixture' });
    }

    // Encode H264 "razonable": libx264 si existe; si no, videotoolbox (macOS); si no, FAIL.
    let h264Detail = '';
    try {
      await makeSyntheticFixture(temp, 'libx264');
      h264Detail = 'libx264';
    } catch {
      try {
        await makeSyntheticFixture(temp, 'h264_videotoolbox');
        h264Detail = 'h264_videotoolbox';
      } catch { /* sin encoder H264 → FAIL abajo */ }
    }
    reports.push(h264Detail
      ? { check: 'encode H264', status: 'PASS', detail: `encoder probado con fixture real: ${h264Detail}` }
      : { check: 'encode H264', status: 'FAIL', detail: 'sin encoder H264 (libx264/h264_videotoolbox)' });

    // Whisper local: binario y modelo se reportan POR SEPARADO — jamás PASS sin
    // modelo real. whisper.cpp sin modelo ggml → SKIP honesto; mlx si está cacheado.
    const whisperBin=await run('whisper-cli',['--help'],20_000);
    reports.push(whisperBin.code===0
      ? {check:'whisper.cpp binario',status:'PASS',detail:'whisper-cli disponible'}
      : {check:'whisper.cpp binario',status:'SKIP',detail:'no instalado (backend preferido: mlx_whisper)'});
    const cppModel=process.env.ABRXS_WHISPER_CPP_MODEL||'';
    if(whisperBin.code===0)reports.push(cppModel
      ? {check:'whisper.cpp modelo',status:'PASS',detail:cppModel}
      : {check:'whisper.cpp modelo',status:'SKIP',detail:'sin modelo ggml — configura ABRXS_WHISPER_CPP_MODEL (no se descarga automáticamente)'});
    const mlxCheck=await run('mlx_whisper',['--help'],20_000);
    const mlxModel=process.env.ABRXS_MLX_MODEL||'mlx-community/whisper-large-v3-turbo';
    const hfCache=join(process.env.HOME||'','.cache','huggingface','hub',`models--${mlxModel.replace(/\//g,'--')}`);
    let mlxModelOk=false;try{await stat(hfCache);mlxModelOk=true;}catch{}
    reports.push(mlxCheck.code===0
      ? {check:'mlx_whisper',status:'PASS',detail:mlxModelOk?`modelo cacheado: ${mlxModel}`:`CLI disponible; modelo ${mlxModel} sin caché local (se descarga al transcribir)`}
      : {check:'mlx_whisper',status:'SKIP',detail:'no instalado'});

    // VideoToolbox: solo informativo (no es requisito cross-platform).
    if (process.platform === 'darwin') {
      const { stdout } = await run('ffmpeg', ['-hide_banner', '-encoders']);
      const has = /h264_videotoolbox/.test(stdout);
      reports.push({ check: 'VideoToolbox (macOS)', status: 'INFO', detail: has ? 'h264_videotoolbox disponible (aceleración por hardware opcional)' : 'no disponible en este build de ffmpeg' });
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  return reports;
}
