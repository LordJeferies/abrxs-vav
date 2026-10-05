import { describe,it,expect } from 'vitest';
import { parseHttpRange } from '../apps/service/src/http-range';

describe('parseHttpRange (RFC 9110 §14.1.2, estricto)',()=>{
  it('sin header → null (respuesta 200 completa)',()=>{
    expect(parseHttpRange(undefined,1000)).toBeNull();
  });
  it('rangos válidos → {start,end}',()=>{
    expect(parseHttpRange('bytes=0-99',1000)).toEqual({start:0,end:99});
    expect(parseHttpRange('bytes=500-',1000)).toEqual({start:500,end:999});
    expect(parseHttpRange('bytes=-200',1000)).toEqual({start:800,end:999}); // suffix
    expect(parseHttpRange('bytes=999-999',1000)).toEqual({start:999,end:999});
    expect(parseHttpRange('bytes=0-',1000)).toEqual({start:0,end:999});
  });
  it('malformados o fuera de tamaño → invalid (416)',()=>{
    expect(parseHttpRange('bytes=',1000)).toBe('invalid');
    expect(parseHttpRange('bytes=-',1000)).toBe('invalid');
    expect(parseHttpRange('bytes=-0',1000)).toBe('invalid');       // suffix 0
    expect(parseHttpRange('bytes=1000-',1000)).toBe('invalid');    // start == size
    expect(parseHttpRange('bytes=2000-3000',1000)).toBe('invalid');
    expect(parseHttpRange('bytes=0-9999',1000)).toBe('invalid');   // end >= size
    expect(parseHttpRange('bytes=99-50',1000)).toBe('invalid');    // end < start
    expect(parseHttpRange('items=0-5',1000)).toBe('invalid');      // unidad incorrecta
    expect(parseHttpRange('bytes=abc-def',1000)).toBe('invalid');
    expect(parseHttpRange('bytes=1e3-',1000)).toBe('invalid');     // no decimal
  });
  it('archivo vacío → cualquier Range es invalid',()=>{
    expect(parseHttpRange('bytes=0-',0)).toBe('invalid');
    expect(parseHttpRange('bytes=-10',0)).toBe('invalid');
  });
});
