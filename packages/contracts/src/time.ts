/* ═══ TIEMPO CANÓNICO — helpers de frames/timebase racional (0.5.1) ═══
   La verdad del dominio son frames enteros con timebase racional
   (fpsNumerator/fpsDenominator); los segundos son frontera externa
   (docs/ARCHITECTURE.md: "La verdad interna es frame/tick based").
   Módulo puro: sin FFmpeg, sin I/O, sin dependencias.
   Timecodes con separador ';' son drop-frame (solo 30000/1001 y 60000/1001);
   con ':' son no drop-frame (el contador corre al fps entero más cercano). */

export interface RationalTimebase { fpsNumerator: number; fpsDenominator: number }

/** Valida la timebase: enteros positivos y más de 1 fps. */
export function validateTimebase(timebase:RationalTimebase):void{
  if(!Number.isInteger(timebase.fpsNumerator)||!Number.isInteger(timebase.fpsDenominator)||timebase.fpsNumerator<1||timebase.fpsDenominator<1)
    throw new Error('La timebase debe ser racional con numerador y denominador enteros positivos.');
  if(timebase.fpsNumerator/timebase.fpsDenominator<1) throw new Error('La timebase debe ser al menos 1 fps.');
}

/** Valor real de fps (frontera externa: solo para mostrar o dialogar con humanos). */
export function fpsOf(timebase:RationalTimebase):number{
  validateTimebase(timebase);
  return timebase.fpsNumerator/timebase.fpsDenominator;
}

/** Frames → segundos exactos (frontera externa). Exige entero no negativo. */
export function framesToSeconds(frames:number,timebase:RationalTimebase):number{
  validateTimebase(timebase);
  if(!Number.isInteger(frames)||frames<0) throw new Error('Los frames deben ser un entero no negativo.');
  return frames*timebase.fpsDenominator/timebase.fpsNumerator;
}

/** Segundos → frame más cercano. Los segundos nunca son verdad del dominio. */
export function secondsToFrames(seconds:number,timebase:RationalTimebase):number{
  validateTimebase(timebase);
  if(!Number.isFinite(seconds)||seconds<0) throw new Error('Los segundos deben ser un número finito no negativo.');
  return Math.round(seconds*timebase.fpsNumerator/timebase.fpsDenominator);
}

/* Límites de CLIP (p.ej. palabra del transcript → Piece): el clip no debe cortar
   una palabra por redondeo. start=COVER-floor (empieza en el frame que CONTIENE
   el instante), end=COVER-ceil out-exclusivo (el primer frame DESPUÉS del
   instante). Matemática racional entera — nunca fps float como identidad. */
export function secondsToFrameFloor(seconds:number,timebase:RationalTimebase):number{
  validateTimebase(timebase);
  if(!Number.isFinite(seconds)||seconds<0) throw new Error('Los segundos deben ser un número finito no negativo.');
  return Math.floor(seconds*timebase.fpsNumerator/timebase.fpsDenominator);
}
export function secondsToFrameCeil(seconds:number,timebase:RationalTimebase):number{
  validateTimebase(timebase);
  if(!Number.isFinite(seconds)||seconds<0) throw new Error('Los segundos deben ser un número finito no negativo.');
  return Math.ceil(seconds*timebase.fpsNumerator/timebase.fpsDenominator);
}

/** SMPTE drop-frame solo existe para 30000/1001 (29.97) y 60000/1001 (59.94). */
export function isDropFrameTimebase(timebase:RationalTimebase):boolean{
  validateTimebase(timebase);
  return (timebase.fpsNumerator===30000&&timebase.fpsDenominator===1001)||(timebase.fpsNumerator===60000&&timebase.fpsDenominator===1001);
}

/** fps del CONTADOR de timecode (entero: 24 para 23.976, 30 para 29.97…).
    Acepta la familia NTSC (n/1001 difiere ≤0.1% del entero); rechaza lo demás. */
function counterFps(timebase:RationalTimebase):number{
  const fps=fpsOf(timebase),counter=Math.round(fps);
  if(counter<1||Math.abs(fps/counter-1)>0.002) throw new Error(`No existe contador de timecode entero para ${timebase.fpsNumerator}/${timebase.fpsDenominator}.`);
  return counter;
}
const pad=(n:number)=>String(n).padStart(2,'0');
function format(h:number,m:number,s:number,f:number,sep:string){return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(f)}`;}

/* Parámetros del contador: en DF cada minuto (salvo los múltiplos de 10) salta
   los primeros `drop` números; un bloque de 10 min tiene minuteLen*10 números
   mostrados y minuteLen*10-9*drop frames reales. */
function counterParams(timebase:RationalTimebase){
  const counter=counterFps(timebase),minuteLen=counter*60;
  const df=isDropFrameTimebase(timebase),drop=df?(counter===30?2:4):0;
  return {counter,minuteLen,df,drop,per10Real:minuteLen*10-9*drop,cycle:df?144*(minuteLen*10-9*drop):counter*86400};
}

/** Frames → timecode. DF: HH:MM:SS;FF. NDF: HH:MM:SS:FF. Envuelve a 24 h. */
export function framesToTimecode(frames:number,timebase:RationalTimebase):string{
  validateTimebase(timebase);
  if(!Number.isInteger(frames)||frames<0) throw new Error('Los frames deben ser un entero no negativo.');
  const {counter,minuteLen,df,drop,per10Real,cycle}=counterParams(timebase);
  const f=((frames%cycle)+cycle)%cycle;
  let t:number;
  if(!df){t=f;}
  else{
    const blocks=Math.floor(f/per10Real),r=f%per10Real;
    const k=r<minuteLen?0:1+Math.floor((r-minuteLen)/(minuteLen-drop));
    t=blocks*minuteLen*10+(k===0?r:r+k*drop);
  }
  return format(Math.floor(t/counter/3600),Math.floor(t/counter/60)%60,Math.floor(t/counter)%60,t%counter,df?';':':');
}

/** Timecode → frames. El separador decide: ';' drop-frame, ':' no drop-frame. */
export function timecodeToFrames(timecode:string,timebase:RationalTimebase):number{
  validateTimebase(timebase);
  const match=/^(\d{1,2}):(\d{1,2}):(\d{1,2})([;:])(\d{1,2})$/.exec(timecode.trim());
  if(!match) throw new Error(`Timecode inválido: "${timecode}". Formato esperado HH:MM:SS;FF (drop-frame) u HH:MM:SS:FF (no drop-frame).`);
  const hh=Number(match[1]),mm=Number(match[2]),ss=Number(match[3]),sep=match[4],ff=Number(match[5]);
  const {counter,minuteLen,df,drop,per10Real,cycle}=counterParams(timebase);
  if(mm>59||ss>59) throw new Error(`Timecode inválido: "${timecode}".`);
  if(ff>=counter) throw new Error(`Timecode inválido: "${timecode}" excede ${counter} frames por segundo.`);
  if(sep===';'&&!df) throw new Error(`"${timecode}" declara drop-frame (;) pero la timebase ${timebase.fpsNumerator}/${timebase.fpsDenominator} no lo soporta.`);
  const t=(hh*3600+mm*60+ss)*counter+ff;
  if(!df||sep===':') return t%cycle; // NDF (incluye 29.97/59.94 NDF con ':')
  // DF: los minutos que no son múltiplo de 10 no tienen los primeros `drop` números.
  if(mm%10!==0&&ss*counter+ff<drop) throw new Error(`"${timecode}" es un frame descartado por drop-frame (los primeros ${drop} de cada minuto no múltiplo de 10 no existen).`);
  const withinBlock=mm%10,r=withinBlock===0?withinBlock*minuteLen+ss*counter+ff:withinBlock*minuteLen+ss*counter+ff-withinBlock*drop;
  return (Math.floor((hh*60+mm)/10)*per10Real+r)%cycle;
}
