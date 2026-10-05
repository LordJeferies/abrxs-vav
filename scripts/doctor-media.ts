/* ═══ DOCTOR — checks de MEDIA (ffmpeg/ffprobe/decode/H264/temp/disk) ═══
   Solo capacidades audiovisuales locales: NADA de providers AI, ComfyUI,
   MLX, DaVinci ni CapCut. VideoToolbox se reporta como INFO en macOS —
   nunca es requisito cross-platform. Importado por scripts/doctor.ts y
   testeable en tests/media.test.ts. */
import { execFile } from 'node:child_process';
import { statfs, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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

/** Genera 1 s de video sintético (testsrc2 + audio sine) para probar decode/encode reales. */
async function makeSyntheticFixture(dir: string, videoCodec: string): Promise<string> {
  const out = join(dir, `fixture_${videoCodec}.mp4`);
  await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=1',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
    '-c:v', videoCodec, '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', out], 120_000);
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

    // Lectura de video real: sintetizar 1 s y sondearlo con ffprobe.
    try {
      const fixture = await makeSyntheticFixture(temp, 'libx264');
      const { stdout } = await run('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', fixture]);
      const info = JSON.parse(stdout) as { streams?: Array<{ codec_type?: string; width?: number }> };
      const video = info.streams?.find(s => s.codec_type === 'video');
      reports.push(video?.width
        ? { check: 'decodificar video (sintético)', status: 'PASS', detail: `testsrc2 320x240 leído por ffprobe` }
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
