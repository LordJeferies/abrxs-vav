# Doctor y observabilidad

`Abraxas Doctor` debe comprobar:

- Node/Rust/Tauri;
- FFmpeg/ffprobe;
- MLX Whisper/whisper.cpp;
- VideoFlow/renderer;
- Remotion si se usa;
- hardware encoder;
- fonts;
- disk/free space;
- cache/project integrity;
- provider reachability;
- ComfyUI local si está configurado;
- plugin compatibility/schema versions;
- Keychain access;
- browser adapter prerequisites.

Debe generar un diagnostic bundle legible sin secretos.

Activity debe mostrar health, latency, job logs, retries, resource use y provider failures.

## Estado 0.5.1 (media hardening B — REAL)

`npm run doctor` ejecuta hoy (`scripts/doctor.ts` + `scripts/doctor-media.ts`):

| Check | Estado | Detalle |
|---|---|---|
| Node | REAL | ≥22 |
| projects/jobs (almacenamiento) | REAL | validez de registros vía FileRepository |
| ffmpeg / ffprobe | REAL | encontrados + versión (`ffmpeg -version`) |
| directorio temp escribible | REAL | escritura/borrado real en tmpdir |
| espacio libre en temp | REAL | `statfs(tmpdir)`; WARN si <5 GB |
| decodificar video (sintético) | REAL | genera testsrc2 1 s y lo sondea con ffprobe |
| encode H264 | REAL | encode real con fixture (libx264, fallback h264_videotoolbox) |
| VideoToolbox (macOS) | INFO | solo informativo — nunca requisito cross-platform |

Sin ffmpeg/ffprobe instalados, los checks dependientes se marcan FAIL/SKIP con detalle
claro (el doctor sale con exitCode 1 si hay FAIL) — nunca crash. Los checks de media son
testeables en `tests/media.test.ts` y el subset audiovisual corre con `npm run test:media`.

PENDIENTE (no diagnosticar todavía): fonts, MLX Whisper/whisper.cpp, Remotion, providers
AI, ComfyUI, DaVinci/CapCut, Keychain, browser adapters.
