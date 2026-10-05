/* ═══ HTTP Range parsing — validación estricta para streaming de media ═══
   Un solo lugar para que servidor y tests compartan la semántica:
   - null            → sin Range (respuesta 200 completa);
   - {start,end}     → Range válido (206 con Content-Range);
   - 'invalid'       → Range malformado o fuera de tamaño (416). */

export type HttpRange = { start: number; end: number } | 'invalid' | null;

export function parseHttpRange(header: string | undefined, size: number): HttpRange {
  if (header === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return 'invalid';
  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return 'invalid';        // bytes=- (vacío)
  if (rawStart === '') {
    // bytes=-N → últimos N bytes (suffix range, RFC 9110 §14.1.2)
    const suffix = Number(rawEnd);
    if (suffix === 0) return 'invalid';
    if (size === 0) return 'invalid';
    const start = Math.max(0, size - suffix);
    return { start, end: size - 1 };
  }
  const start = Number(rawStart);
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) return 'invalid';
  const end = rawEnd === '' ? size - 1 : Number(rawEnd);
  if (!Number.isSafeInteger(end) || end < start || end >= size) return 'invalid';
  return { start, end };
}
