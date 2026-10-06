import { describe,it,expect } from 'vitest';
import { alignText,alignAnchors,flattenWords,normalizeTokens,decideAlignment } from '../apps/service/src/align';
import { secondsToFrameFloor,secondsToFrameCeil } from '@abraxas/contracts';
import type { TranscriptWords } from '../apps/service/src/transcribe';

const TB={fpsNumerator:30000,fpsDenominator:1001};
const fpsDenominatorContains=(f:number,tb:{fpsNumerator:number;fpsDenominator:number})=>
  f*tb.fpsDenominator/tb.fpsNumerator<=2 && (f+1)*tb.fpsDenominator/tb.fpsNumerator>2;
const seg=(text:string,start:number,end:number,words?:Array<{start:number;end:number;word:string}>):WhisperSegment=>({start,end,text,...(words?{words}: {})});
const T=(segments:WhisperSegment[],language='es'):TranscriptWords=>({language,backend:'mlx_whisper',model:'test',sourceHash:'x',segments});

const FIXTURE=T([
  seg('Hola, ¿cómo estás? Bien.',0,2,[
    {start:0.0,end:0.3,word:'Hola,'},{start:0.3,end:0.6,word:'¿cómo'},{start:0.6,end:0.9,word:'estás?'},
    {start:0.9,end:1.4,word:'Bien.'}]),
  seg('José Ramírez tiene 33 años y vive en Málaga.',2,6,[
    {start:2.0,end:2.4,word:'José'},{start:2.4,end:2.7,word:'Ramírez'},{start:2.7,end:2.9,word:'tiene'},
    {start:2.9,end:3.3,word:'33'},{start:3.3,end:3.6,word:'años'},{start:3.6,end:3.8,word:'y'},
    {start:3.8,end:4.2,word:'vive'},{start:4.2,end:4.4,word:'en'},{start:4.4,end:5.9,word:'Málaga.'}]),
  seg('José Ramírez siempre responde.',6,8,[
    {start:6.0,end:6.4,word:'José'},{start:6.4,end:6.8,word:'Ramírez'},{start:6.8,end:7.2,word:'siempre'},
    {start:7.2,end:7.9,word:'responde.'}]),
]);

describe('normalizeTokens',()=>{
  it('minúsculas, sin puntuación básica, colapso de espacios',()=>{
    expect(normalizeTokens('¿Hola,   MUNDO?!','true')).toEqual(['hola','mundo']);
  });
  it('sin preservar acentos los relaja; con preservar los conserva',()=>{
    expect(normalizeTokens('Ramírez Málaga',false)).toEqual(['ramirez','malaga']);
    expect(normalizeTokens('Ramírez Málaga',true)).toEqual(['ramírez','málaga']);
  });
  it('números y siglas intactos',()=>{
    expect(normalizeTokens('EP32 4K HDR-10,',false)).toEqual(['ep32','4k','hdr','10']);
  });
});

describe('flattenWords',()=>{
  it('usa words reales cuando existen',()=>{
    expect(flattenWords(FIXTURE)).toHaveLength(17);
  });
  it('reparte segmentos sin words (determinista)',()=>{
    const w=flattenWords(T([seg('tres palabras aqui',0,3)]));
    expect(w).toHaveLength(3);
    expect(w[0].start).toBeCloseTo(0);expect(w[2].end).toBeCloseTo(3);
  });
});

describe('alignText',()=>{
  it('EXACT: frase con puntuación/acentos → 1 candidate con frames canónicos',()=>{
    const c=alignText(FIXTURE,'¿cómo estás?',TB);
    expect(c).toHaveLength(1);
    expect(c[0].confidence).toBe(1);
    expect(c[0].strategy).toBe('exact');
    expect(c[0].startFrame).toBe(8);            // floor: 0.3 s @ 29.97 = 8.99 → frame 8 (cubre el inicio)
    expect(c[0].endFrame).toBe(27);             // ceil out-exclusivo: 0.9 s → 26.97 → 27
    expect(c[0].matchedText).toBe('¿cómo estás?');
  });
  it('NORMALIZED: sin acentos ni puntuación encuentra igual (nombres intactos)',()=>{
    const c=alignText(FIXTURE,'jose ramirez tiene 33 anos y vive en malaga',TB);
    expect(c).toHaveLength(1);
    expect(c[0].confidence).toBe(1);
    expect(c[0].strategy).toBe('normalized');
    expect(c[0].startSec).toBeCloseTo(2.0);
    expect(c[0].matchedText).toContain('José');
  });
  it('AMBIGUITY: frase repetida dos veces → 2 candidates, NUNCA elige al azar',()=>{
    const c=alignText(FIXTURE,'José Ramírez',TB);
    expect(c.length).toBe(2);
    expect(c[0].wordIndexStart).toBeLessThan(c[1].wordIndexStart);
    expect(c[0].matchedText).toBe('José Ramírez');
    expect(c[1].matchedText).toBe('José Ramírez');
  });
  it('INEXISTENTE sin parecidos → sin candidates (sin inventar)',()=>{
    expect(alignText(FIXTURE,'zebra quilombo xylophone',TB)).toEqual([]);
  });
  it('FUZZY: palabra casi igual dentro del umbral 0.75 con estrategia explicada',()=>{
    const c=alignText(FIXTURE,'José Ramírez siemrpe responde',TB); // 'siemrpe' typo
    expect(c.length).toBe(1);
    expect(c[0].strategy).toBe('fuzzy');
    expect(c[0].confidence).toBeGreaterThanOrEqual(0.75);
    expect(c[0].confidence).toBeLessThan(1);
  });
  it('FUZZY gating: query corto (<4 tokens) NUNCA fuzzy',()=>{
    expect(alignText(FIXTURE,'José siemrpe',TB)).toEqual([]); // 2 tokens, typo → nada
  });
  it('falso positivo 3/4 tokens: candidate 0.75 existe pero NUNCA auto-Piece',()=>{
    const c=alignText(FIXTURE,'Ramírez vive 33 años',TB);
    expect(c).toHaveLength(1);            // ventana 'Ramírez tiene 33 años' = 3/4
    expect(c[0].confidence).toBe(0.75);
    expect(decideAlignment(c).status).toBe('UNRESOLVED'); // el gating bloquea la creación
  });
  it('decideAlignment: fuzzy débil → UNRESOLVED (no auto-Piece)',()=>{
    const fuzzy=alignText(FIXTURE,'José Ramírez siemrpe responde',TB);
    const d=decideAlignment(fuzzy);
    expect(d.status).toBe('UNRESOLVED'); // 0.75 < 0.9
  });
  it('decideAlignment: top apenas superior al 2º → AMBIGUOUS',()=>{
    const d=decideAlignment([
      {startFrame:0,endFrame:10,startSec:0,endSec:1,confidence:0.92,matchedText:'a',wordIndexStart:0,wordIndexEnd:2,strategy:'fuzzy'},
      {startFrame:20,endFrame:30,startSec:2,endSec:3,confidence:0.9,matchedText:'b',wordIndexStart:5,wordIndexEnd:7,strategy:'fuzzy'}]);
    expect(d.status).toBe('AMBIGUOUS');
  });
  it('decideAlignment: fuzzy claro (≥0.9 y ventaja ≥0.05) → MATCH',()=>{
    const d=decideAlignment([
      {startFrame:0,endFrame:10,startSec:0,endSec:1,confidence:0.95,matchedText:'a',wordIndexStart:0,wordIndexEnd:2,strategy:'fuzzy'},
      {startFrame:20,endFrame:30,startSec:2,endSec:3,confidence:0.76,matchedText:'b',wordIndexStart:5,wordIndexEnd:7,strategy:'fuzzy'}]);
    expect(d.status).toBe('MATCH');
  });
  it('decideAlignment: exacto repetido → AMBIGUOUS; exacto único → MATCH',()=>{
    expect(decideAlignment(alignText(FIXTURE,'José Ramírez',TB)).status).toBe('AMBIGUOUS');
    expect(decideAlignment(alignText(FIXTURE,'¿cómo estás?',TB)).status).toBe('MATCH');
  });
  it('query vacío/solo puntuación → sin candidates',()=>{
    expect(alignText(FIXTURE,'...',TB)).toEqual([]);
    expect(alignText(FIXTURE,'',TB)).toEqual([]);
  });
});

describe('índice con tokens vacíos (H2)',()=>{
  it('palabras de puntuación pura ("…","—","¿") se omiten del índice SIN romper rangos',()=>{
    const t=T([
      seg('Hola — ¿cómo estás?',0,2,[
        {start:0.0,end:0.2,word:'Hola'},{start:0.2,end:0.3,word:'…'},{start:0.3,end:0.35,word:'—'},
        {start:0.35,end:0.45,word:'¿'},{start:0.45,end:0.7,word:'cómo'},{start:0.7,end:0.95,word:'estás?'}]),
    ]);
    const c=alignText(t,'cómo estás?',TB);
    expect(c).toHaveLength(1);
    expect(c[0].matchedText).toBe('… — ¿ cómo estás?'); // expansión: TODAS las words contiguas sin token
    expect(c[0].startSec).toBeCloseTo(0.2);             // cubre desde '…' (cobre seguro del span)
    expect(c[0].endSec).toBeCloseTo(0.95);
    expect(c[0].startFrame).toBe(5);                     // floor(0.2*29.97)=5
  });
});

describe('boundaries floor/ceil (H3) — el clip no corta palabras',()=>{
  const cases:[
    string,{fpsNumerator:number;fpsDenominator:number},number
  ][]=[
    ['23.976',{fpsNumerator:24000,fpsDenominator:1001},24],
    ['29.97',{fpsNumerator:30000,fpsDenominator:1001},30],
    ['59.94',{fpsNumerator:60000,fpsDenominator:1001},60],
    ['24',{fpsNumerator:24,fpsDenominator:1},24],
    ['25',{fpsNumerator:25,fpsDenominator:1},25],
    ['30',{fpsNumerator:30,fpsDenominator:1},30],
  ];
  it('timestamp ENTRE frames: start=floor cubre el inicio; end=ceil out-exclusivo cubre el final',()=>{
    for(const [name,tb] of cases){
      const fps=tb.fpsNumerator/tb.fpsDenominator;      // solo para leer; la MATEMÁTICA es racional
      const start=1.2345,end=2.3456; // NO caen en frontera de frame en ningún tb
      const sf=secondsToFrameFloor(start,tb),ef=secondsToFrameCeil(end,tb);
      expect(sf,`${name} start racional`).toBe(Math.floor(start*tb.fpsNumerator/tb.fpsDenominator));
      expect(ef,`${name} end racional`).toBe(Math.ceil(end*tb.fpsNumerator/tb.fpsDenominator));
      expect(ef,`${name} out-exclusivo cubre`).toBeGreaterThan(sf);
      // cobertura: el frame de start empieza ANTES o EN el instante; el de end termina DESPUÉS o EN él
      expect(sf*tb.fpsDenominator/tb.fpsNumerator,`${name} cobertura inicio`).toBeLessThanOrEqual(start);
      expect(ef*tb.fpsDenominator/tb.fpsNumerator,`${name} cobertura final`).toBeGreaterThanOrEqual(end);
      void fps;
    }
  });
  it('frontera EXACTA (fps entero): floor/ceil == frame exacto; NTSC: 2 s cae DENTRO del frame 47/59 y floor lo contiene',()=>{
    for(const [name,tb,fps] of cases){
      const ntsc=tb.fpsDenominator!==1;
      if(ntsc){
        const f=secondsToFrameFloor(2,tb); // 2 s NO es frontera en n/1001: frame 47 (29.97) lo contiene
        expect(fpsDenominatorContains(f,tb),`${name} floor contiene 2s`).toBe(true);
        expect(secondsToFrameCeil(2,tb)-f,`${name} ceil = floor+1 (dentro de frame)`).toBeLessThanOrEqual(1);
      }else{
        expect(secondsToFrameFloor(2,tb),`${name}`).toBe(2*fps);      // 2.0 s exacto
        expect(secondsToFrameCeil(2,tb),`${name}`).toBe(2*fps);       // sin estirar
      }
    }
  });
  it('con reflect: alignText usa floor/ceil (no round) en los frames de candidates',()=>{
    const c=alignText(FIXTURE,'Bien.',TB);
    expect(c).toHaveLength(1);
    expect(c[0].startFrame).toBe(Math.floor(0.9*30000/1001));   // 26 (floor), no 27 (round)
    expect(c[0].endFrame).toBe(Math.ceil(1.4*30000/1001));      // 42 (ceil)
  });
});

describe('alignAnchors',()=>{
  it('opening + closing → rango continuo que abarca ambos',()=>{
    const c=alignAnchors(FIXTURE,'José Ramírez tiene','vive en Málaga',TB);
    expect(c).toHaveLength(1);
    expect(c[0].strategy).toBe('anchors');
    expect(c[0].startSec).toBeCloseTo(2.0);
    expect(c[0].endSec).toBeCloseTo(5.9);
    expect(c[0].matchedText).toContain('33 años');
  });
  it('respetan el orden: closing antes del opening → sin candidates',()=>{
    expect(alignAnchors(FIXTURE,'vive en Málaga','Hola',TB)).toEqual([]);
  });
  it('opening inexistente → sin candidates',()=>{
    expect(alignAnchors(FIXTURE,'cuando comenzamos','vive en Málaga',TB)).toEqual([]);
  });
});
