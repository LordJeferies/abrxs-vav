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
