/* ═══ TEXT ALIGNMENT — texto del transcript → rango de FRAMES canónicos (M2) ═══
   Servicio PURO y determinista (sin LLM, sin red): alinea una frase del usuario
   contra el transcript word-level y devuelve candidates[] con frames.
   Orden de estrategias: exact → normalized exact → anchors (inicio+fin) → fuzzy.
   FUZZY (determinista, explicable): solo queries de ≥4 tokens, umbral 0.75, y
   decideAlignment exige confianza clara (≥0.9 y ventaja sobre el 2º candidato)
   para auto-crear una Piece — si no, AMBIGUOUS/UNRESOLVED con candidates[].
   Índice de búsqueda: {normalized, originalWordIndex} — las palabras que quedan
   vacías al normalizar ("…", "—", "¿") se OMITEN del índice pero los rangos
   devueltos siempre apuntan a las words ORIGINALES del transcript.
   Normalización razonable es/en mixto: minúsculas, colapso de espacios,
   puntuación básica fuera; acentos SOLO se relajan en la segunda pasada. */
import { secondsToFrameCeil, secondsToFrameFloor, type Timebase } from '@abraxas/contracts';
import type { TranscriptWords } from './transcribe';

export interface AlignWord { start: number; end: number; word: string }
export interface AlignCandidate {
  startFrame: number; endFrame: number; startSec: number; endSec: number;
  confidence: number; matchedText: string; wordIndexStart: number; wordIndexEnd: number; strategy: string;
}
export interface AlignToken { normalized: string; originalWordIndex: number }

/** Tokens normalizados para comparar. preservar=true mantiene acentos (1ª pasada).
    Los tokens vacíos (puntuación pura) se descartan — nunca generan matches. */
export function normalizeTokens(text: string, preserveAccents: boolean): string[] {
  const stripped = text
    .toLowerCase()
    .replace(/[.,;:!?¿¡"'“”«»()\[\]…\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const src = preserveAccents ? stripped : stripped.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return src ? src.split(' ').filter(Boolean) : [];
}

/** Words del transcript aplanados (word-level canónico; fallback: reparte el segmento). */
export function flattenWords(t: TranscriptWords): AlignWord[] {
  const words: AlignWord[] = [];
  const push = (word: string, start: number, end: number) => {
    const clean = word.trim();
    if (clean) words.push({ start, end, word: clean });
  };
  for (const seg of t.segments) {
    if (seg.words?.length) {
      for (const w of seg.words) push(w.word, w.start, w.end);
    } else {
      const tokens = seg.text.split(/\s+/).filter(Boolean);
      const per = tokens.length ? (seg.end - seg.start) / tokens.length : 0;
      tokens.forEach((tok, i) => push(tok, seg.start + i * per, seg.start + (i + 1) * per));
    }
  }
  return words;
}

/** Índice de búsqueda: {normalized, originalWordIndex}. Palabras que quedan vacías
    al normalizar se omiten del índice; el mapping preserva el índice ORIGINAL
    para que startFrame/endFrame cubran las words reales (H2). */
export function buildTokenIndex(words: AlignWord[], preserveAccents: boolean): AlignToken[] {
  const index: AlignToken[] = [];
  words.forEach((w, originalWordIndex) => {
    const token = normalizeTokens(w.word, preserveAccents)[0];
    if (token) index.push({ normalized: token, originalWordIndex });
  });
  return index;
}

function windowsMatch(index: AlignToken[], queryTokens: string[], at: number): { score: number; exact: boolean } {
  let matched = 0;
  for (let i = 0; i < queryTokens.length; i++) {
    if (index[at + i]?.normalized === queryTokens[i]) matched++;
  }
  const score = matched / queryTokens.length;
  return { score, exact: matched === queryTokens.length };
}

function candidatesFor(words: AlignWord[], index: AlignToken[], queryTokens: string[], strategy: string, threshold: number, timebase: Timebase): AlignCandidate[] {
  const out: AlignCandidate[] = [];
  for (let at = 0; at + queryTokens.length <= index.length; at++) {
    const { score, exact } = windowsMatch(index, queryTokens, at);
    if (!(exact || score >= threshold)) continue;
    // Expandir a las words ORIGINALES contiguas que quedaron fuera del índice
    // (puntuación pura "¿", "—", "…"): texto y frames cubren el span real.
    let firstIdx = index[at].originalWordIndex;
    let lastIdx = index[at + queryTokens.length - 1].originalWordIndex;
    while (firstIdx > 0 && !normalizeTokens(words[firstIdx - 1].word, false).length) firstIdx--;
    while (lastIdx < words.length - 1 && !normalizeTokens(words[lastIdx + 1].word, false).length) lastIdx++;
    const w0 = words[firstIdx], w1 = words[lastIdx];
    out.push({
      startFrame: secondsToFrameFloor(w0.start, timebase),   // cubre el inicio real
      endFrame: secondsToFrameCeil(w1.end, timebase),        // cubre el final, out-exclusivo
      startSec: w0.start, endSec: w1.end,
      confidence: Math.round(score * 1000) / 1000,
      matchedText: words.slice(firstIdx, lastIdx + 1).map(w => w.word).join(' '),
      wordIndexStart: firstIdx, wordIndexEnd: lastIdx,
      strategy,
    });
    if (exact) at += queryTokens.length - 1; // no duplicar solapes exactos largos
  }
  return out;
}

/** Alinea `query` contra el transcript: candidates ordenadas por confianza.
    Pasadas: con acentos → sin acentos → fuzzy (solo queries ≥4 tokens). */
export function alignText(t: TranscriptWords, query: string, timebase: Timebase): AlignCandidate[] {
  const words = flattenWords(t);
  const results: AlignCandidate[] = [];
  for (const preserve of [true, false]) {
    const queryTokens = normalizeTokens(query, preserve);
    if (!queryTokens.length) continue;
    for (const c of candidatesFor(words, buildTokenIndex(words, preserve), queryTokens, preserve ? 'exact' : 'normalized', 1, timebase)) results.push(c);
    if (results.length) break; // la primera pasada que matchea gana (acentos > relajada)
  }
  if (!results.length) {
    const queryTokens = normalizeTokens(query, false);
    // FUZY gating: frases muy cortas NO se auto-resuelven con aproximación.
    if (queryTokens.length >= 4) {
      for (const c of candidatesFor(words, buildTokenIndex(words, false), queryTokens, 'fuzzy', 0.75, timebase)) results.push(c);
    }
  }
  return results
    .filter((c, i, all) => all.findIndex(x => x.wordIndexStart === c.wordIndexStart && x.wordIndexEnd === c.wordIndexEnd) === i)
    .sort((a, b) => b.confidence - a.confidence || a.startSec - b.startSec);
}

/** Anclas: opening obligatorio, closing obligatorio → rangos que empiezan en un
    match del opening y terminan en el PRIMER match del closing DESPUÉS. */
export function alignAnchors(t: TranscriptWords, opening: string, closing: string, timebase: Timebase): AlignCandidate[] {
  const words = flattenWords(t);
  const index = buildTokenIndex(words, false);
  const openTokens = normalizeTokens(opening, false), closeTokens = normalizeTokens(closing, false);
  if (!openTokens.length || !closeTokens.length) return [];
  const out: AlignCandidate[] = [];
  for (let o = 0; o + openTokens.length <= index.length; o++) {
    if (!windowsMatch(index, openTokens, o).exact) continue;
    for (let c = o + openTokens.length; c + closeTokens.length <= index.length; c++) {
      if (!windowsMatch(index, closeTokens, c).exact) continue;
      const first = index[o], last = index[c + closeTokens.length - 1];
      const w0 = words[first.originalWordIndex], w1 = words[last.originalWordIndex];
      out.push({
        startFrame: secondsToFrameFloor(w0.start, timebase), endFrame: secondsToFrameCeil(w1.end, timebase),
        startSec: w0.start, endSec: w1.end, confidence: 1,
        matchedText: words.slice(first.originalWordIndex, last.originalWordIndex + 1).map(w => w.word).join(' '),
        wordIndexStart: first.originalWordIndex, wordIndexEnd: last.originalWordIndex,
        strategy: 'anchors',
      });
      break;
    }
  }
  return out;
}

export type AlignmentStatus = 'MATCH' | 'AMBIGUOUS' | 'UNRESOLVED';

/** Decisión de auto-creación (H1): exacta múltiple → AMBIGUOUS; fuzzy exige
    confianza clara (≥minConfidence y ventaja ≥0.05 sobre el 2º) o no auto-Piece. */
export function decideAlignment(candidates: AlignCandidate[], minConfidence = 0.9): { status: AlignmentStatus; candidates: AlignCandidate[] } {
  if (!candidates.length) return { status: 'UNRESOLVED', candidates };
  const top = candidates[0];
  if (top.strategy === 'fuzzy') {
    if (top.confidence < minConfidence) return { status: 'UNRESOLVED', candidates };
    if (candidates[1] && top.confidence - candidates[1].confidence < 0.05) return { status: 'AMBIGUOUS', candidates };
  }
  if (candidates[1] && candidates[1].confidence === top.confidence && candidates[1].strategy === top.strategy) return { status: 'AMBIGUOUS', candidates };
  return { status: 'MATCH', candidates };
}
