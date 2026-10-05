import { describe,it,expect } from 'vitest';
import { framesToSeconds,secondsToFrames,framesToTimecode,timecodeToFrames,isDropFrameTimebase,validateTimebase,fpsOf } from '@abraxas/contracts';

const TB={
  '23.976':{fpsNumerator:24000,fpsDenominator:1001},
  '24':{fpsNumerator:24,fpsDenominator:1},
  '25':{fpsNumerator:25,fpsDenominator:1},
  '29.97':{fpsNumerator:30000,fpsDenominator:1001},
  '30':{fpsNumerator:30,fpsDenominator:1},
  '50':{fpsNumerator:50,fpsDenominator:1},
  '59.94':{fpsNumerator:60000,fpsDenominator:1001},
  '60':{fpsNumerator:60,fpsDenominator:1}
} as const;

describe('framesToSeconds / secondsToFrames (rational timebase)',()=>{
  it('convierte con precisión racional en los 8 fps del milestone',()=>{
    expect(framesToSeconds(24000,TB['23.976'])).toBeCloseTo(1001,6);      // 24000 frames = 1001 s exactos
    expect(framesToSeconds(24,TB['24'])).toBe(1);
    expect(framesToSeconds(50,TB['25'])).toBe(2);
    expect(framesToSeconds(30000,TB['29.97'])).toBeCloseTo(1001,6);       // 30000 frames = 1001 s exactos
    expect(framesToSeconds(30,TB['30'])).toBe(1);
    expect(framesToSeconds(50,TB['50'])).toBe(1);
    expect(framesToSeconds(60000,TB['59.94'])).toBeCloseTo(1001,6);
    expect(framesToSeconds(60,TB['60'])).toBe(1);
  });
  it('redondea al frame más cercano y hace round-trip estable',()=>{
    for(const tb of Object.values(TB)){
      for(const frames of [0,1,2,7,47,1798,1800,3597,17982]){
        expect(secondsToFrames(framesToSeconds(frames,tb),tb)).toBe(frames);
      }
    }
  });
  it('rechaza entrada no canónica (frames fraccionarios, segundos negativos, timebase inválida)',()=>{
    expect(()=>framesToSeconds(1.5,TB['30'])).toThrow();
    expect(()=>framesToSeconds(-1,TB['30'])).toThrow();
    expect(()=>secondsToFrames(-0.1,TB['30'])).toThrow();
    expect(()=>secondsToFrames(Number.NaN,TB['30'])).toThrow();
    expect(()=>fpsOf({fpsNumerator:0,fpsDenominator:1})).toThrow();
    expect(()=>fpsOf({fpsNumerator:2997,fpsDenominator:0})).toThrow();
    expect(()=>validateTimebase({fpsNumerator:1.5,fpsDenominator:1})).toThrow();
  });
});

describe('framesToTimecode / timecodeToFrames',()=>{
  it('no drop-frame: contador entero (23.976 cuenta a 24)',()=>{
    expect(framesToTimecode(0,TB['30'])).toBe('00:00:00:00');
    expect(framesToTimecode(90,TB['30'])).toBe('00:00:03:00');
    expect(framesToTimecode(48,TB['24'])).toBe('00:00:02:00');
    expect(framesToTimecode(24000,TB['23.976'])).toBe('00:16:40:00'); // 1000 s a contador 24
    expect(framesToTimecode(125,TB['25'])).toBe('00:00:05:00');
    expect(framesToTimecode(3600,TB['60'])).toBe('00:01:00:00');
    expect(framesToTimecode(3600,TB['50'])).toBe('00:01:12:00');
  });
  it('drop-frame 29.97: salta los 2 primeros números de cada minuto no múltiplo de 10',()=>{
    expect(framesToTimecode(0,TB['29.97'])).toBe('00:00:00;00');
    expect(framesToTimecode(1799,TB['29.97'])).toBe('00:00:59;29');
    expect(framesToTimecode(1800,TB['29.97'])).toBe('00:01:00;02'); // ;00 y ;01 no existen
    expect(framesToTimecode(3597,TB['29.97'])).toBe('00:01:59;29');
    expect(framesToTimecode(3598,TB['29.97'])).toBe('00:02:00;02');
    expect(framesToTimecode(17982,TB['29.97'])).toBe('00:10:00;00'); // el minuto 10 no descarta
    expect(framesToTimecode(2589407,TB['29.97'])).toBe('23:59:59;29');
  });
  it('drop-frame 59.94: salta los 4 primeros números de cada minuto no múltiplo de 10',()=>{
    expect(framesToTimecode(3599,TB['59.94'])).toBe('00:00:59;59');
    expect(framesToTimecode(3600,TB['59.94'])).toBe('00:01:00;04');
    expect(framesToTimecode(35964,TB['59.94'])).toBe('00:10:00;00');
  });
  it('round-trip NDF en todos los fps (rango amplio)',()=>{
    for(const [name,tb] of Object.entries(TB)){
      if(isDropFrameTimebase(tb))continue;
      for(let frames=0;frames<3000;frames++){
        const tc=framesToTimecode(frames,tb);
        expect(timecodeToFrames(tc,tb),`${name} @ ${frames} (${tc})`).toBe(frames);
      }
    }
  });
  it('round-trip drop-frame exacto (verificación estricta, sin módulos de ciclo)',()=>{
    for(const tb of [TB['29.97'],TB['59.94']]){
      for(let frames=0;frames<40000;frames++){
        const tc=framesToTimecode(frames,tb);
        expect(timecodeToFrames(tc,tb)).toBe(frames);
      }
    }
  });
  it('rechaza frames descartados y timecodes malformados',()=>{
    expect(()=>timecodeToFrames('00:01:00;00',TB['29.97'])).toThrow(/descartado/);
    expect(()=>timecodeToFrames('00:01:00;01',TB['29.97'])).toThrow(/descartado/);
    expect(()=>timecodeToFrames('00:01:00;03',TB['29.97'])).not.toThrow();
    expect(()=>timecodeToFrames('00:10:00;00',TB['29.97'])).not.toThrow();
    expect(()=>timecodeToFrames('00:01:00;00',TB['59.94'])).toThrow(/descartado/);
    expect(()=>timecodeToFrames('00:00:60:00',TB['30'])).toThrow();
    expect(()=>timecodeToFrames('00:00:00:30',TB['30'])).toThrow(/excede/);
    expect(()=>timecodeToFrames('00:00:05;00',TB['25'])).toThrow(/no lo soporta/);
    expect(()=>timecodeToFrames('no-es-timecode',TB['30'])).toThrow();
    expect(timecodeToFrames('00:00:05:00',TB['30'])).toBe(150);
  });
  it('el separador decide: 29.97 NDF con ":" y DF con ";" son conteos distintos',()=>{
    const ndf=timecodeToFrames('00:01:00:00',TB['29.97']);
    const df=timecodeToFrames('00:01:00;02',TB['29.97']);
    expect(ndf).toBe(1800);
    expect(df).toBe(1800); // DF: ;00 y ;01 del minuto 1 no existen, ;02 es el primer frame real
    expect(timecodeToFrames('00:01:00:02',TB['29.97'])).toBe(1802); // NDF: :02 existe y cuenta distinto
  });
  it('clasifica drop-frame solo para 30000/1001 y 60000/1001',()=>{
    expect(isDropFrameTimebase(TB['29.97'])).toBe(true);
    expect(isDropFrameTimebase(TB['59.94'])).toBe(true);
    expect(isDropFrameTimebase(TB['23.976'])).toBe(false);
    expect(isDropFrameTimebase(TB['30'])).toBe(false);
    expect(isDropFrameTimebase(TB['60'])).toBe(false);
    expect(isDropFrameTimebase(TB['25'])).toBe(false);
  });
});
