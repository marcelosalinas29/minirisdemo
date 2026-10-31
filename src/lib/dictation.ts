/**
 * Normalización de puntuación dictada.
 *
 * Convierte comandos verbales del dictado ("punto", "coma", "punto y aparte",
 * "abrir paréntesis", "nueva línea", etc.) en los símbolos correspondientes,
 * antes de enviar el texto a la IA.
 *
 * Se aplica sobre el texto FINAL del reconocimiento de voz (no sobre el interim),
 * y es puramente textual: no altera el contenido clínico dictado.
 */

type Rule = { re: RegExp; replace: string };

// Marcadores internos para evitar colisiones al reinsertar espacios.
const NL = '\u0001'; // salto de línea simple
const NLNL = '\u0002'; // salto de párrafo

/** Palabras/frases de comando -> símbolo. El orden importa: primero las más largas. */
const RULES: Rule[] = [
  // Párrafo / saltos de línea
  { re: /\b(punto\s+y\s+aparte|punto\s+aparte)\b/gi, replace: '.' + NLNL },
  { re: /\b(nuevo\s+p[áa]rrafo|punto\s+y\s+p[áa]rrafo)\b/gi, replace: '.' + NLNL },
  { re: /\b(nueva\s+l[íi]nea|salto\s+de\s+l[íi]nea|nuevo\s+rengl[óo]n)\b/gi, replace: NL },

  // Punto final / seguido
  { re: /\b(punto\s+y\s+seguido|punto\s+seguido)\b/gi, replace: '. ' },
  { re: /\b(punto\s+final)\b/gi, replace: '.' },

  // Otros signos compuestos
  { re: /\b(punto\s+y\s+coma)\b/gi, replace: '; ' },
  { re: /\b(dos\s+puntos)\b/gi, replace: ': ' },
  { re: /\b(puntos\s+suspensivos)\b/gi, replace: '... ' },
  { re: /\b(signo\s+de\s+interrogaci[óo]n)\b/gi, replace: '? ' },
  { re: /\b(signo\s+de\s+exclamaci[óo]n)\b/gi, replace: '! ' },
  { re: /\b(abrir?\s+par[ée]ntesis|par[ée]ntesis\s+que\s+abre)\b/gi, replace: ' (' },
  { re: /\b(cerrar?\s+par[ée]ntesis|par[ée]ntesis\s+que\s+cierra)\b/gi, replace: ') ' },
  { re: /\b(gui[óo]n\s+medio|gui[óo]n)\b/gi, replace: '-' },
  { re: /\b(barra\s+inclinada|barra)\b/gi, replace: '/' },
  { re: /\b(comillas)\b/gi, replace: '"' },

  // Simples (al final, para no romper los compuestos de arriba)
  { re: /\bcoma\b/gi, replace: ', ' },
  { re: /\bpunto\b/gi, replace: '. ' },
];

/** Palabras que NO deben tratarse como comando aunque contengan "punto"/"coma". */
const PROTECTED: RegExp[] = [
  /\bpunto\s+de\s+/gi, // "punto de partida", "punto de fuga"
  /\bcoma\s+(diab[ée]tic\w+|hep[áa]tic\w+|profund\w+|superficial|farmacol[óo]gic\w+|inducid\w+)\b/gi,
  /\ben\s+coma\b/gi,
  /\bcomaticoso\b/gi,
];

const PROTECT_TOKEN = '\u0003';

/** Convierte los comandos de puntuación dictados en símbolos reales. */
export function normalizePunctuation(input: string): string {
  if (!input) return '';

  // 1) Proteger falsos positivos clínicos
  const protectedChunks: string[] = [];
  let text = input;
  for (const re of PROTECTED) {
    text = text.replace(re, (m) => {
      protectedChunks.push(m);
      return `${PROTECT_TOKEN}${protectedChunks.length - 1}${PROTECT_TOKEN}`;
    });
  }

  // 2) Aplicar reglas de puntuación
  for (const { re, replace } of RULES) {
    text = text.replace(re, replace);
  }

  // 3) Restaurar protegidos
  text = text.replace(
    new RegExp(`${PROTECT_TOKEN}(\\d+)${PROTECT_TOKEN}`, 'g'),
    (_m, i) => protectedChunks[Number(i)] ?? '',
  );

  return cleanupSpacing(text);
}

/** Limpia espacios sobrantes alrededor de la puntuación y normaliza saltos. */
export function cleanupSpacing(text: string): string {
  let out = text;

  out = out.replace(/\s+([.,;:!?)])/g, '$1');
  out = out.replace(/([.,;:!?])(?=[^\s\d.,;:!?)\u0001\u0002])/g, '$1 ');
  out = out.replace(/\(\s+/g, '(');
  out = out.replace(/[ \t]{2,}/g, ' ');

  out = out.replace(new RegExp(`\\s*${NLNL}\\s*`, 'g'), '\n\n');
  out = out.replace(new RegExp(`\\s*${NL}\\s*`, 'g'), '\n');

  out = out.replace(/\.{4,}/g, '...');
  out = out.replace(/([.,;:])\1+/g, '$1');

  out = out.replace(/(^|[.!?]\s+|\n)([a-záéíóúñ])/g, (_m, p, c) => p + c.toUpperCase());

  return out.replace(/[ \t]+\n/g, '\n').trim();
}

/**
 * Normaliza un fragmento final de reconocimiento manteniendo el espacio final
 * para poder concatenar fragmentos sucesivos.
 */
export function normalizeChunk(chunk: string): string {
  const normalized = normalizePunctuation(chunk);
  if (!normalized) return '';
  return /[\n]$/.test(normalized) ? normalized : normalized + ' ';
}

/** Une el texto acumulado con un nuevo fragmento ya normalizado. */
export function appendChunk(prev: string, chunk: string): string {
  const next = normalizeChunk(chunk);
  if (!next) return prev;
  if (!prev) return next;
  const needsSpace = !/[\s\n(]$/.test(prev);
  const joined = prev + (needsSpace ? ' ' : '') + next;
  return joined.replace(/([.!?]\s+)([a-záéíóúñ])/g, (_m, p, c) => p + c.toUpperCase());
}
