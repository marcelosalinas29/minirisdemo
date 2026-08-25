export function normalizePunctuation(input: string): string {
  if (!input) return '';
  const protectedChunks: string[] = [];
  let text = input;
  const PROTECTED: RegExp[] = [
    /\bpunto\s+de\s+/gi,
    /\bcoma\s+(diab[ée]tic\w+|hep[áa]tic\w+|profund\w+|superficial|farmacol[óo]gic\w+|inducid\w+)\b/gi,
    /\ben\s+coma\b/gi,
    /\bcomaticoso\b/gi,
  ];
  const PROTECT_TOKEN = '\u0003';
  for (const re of PROTECTED) {
    text = text.replace(re, (m) => {
      protectedChunks.push(m);
      return PROTECT_TOKEN + String(protectedChunks.length - 1) + PROTECT_TOKEN;
    });
  }
  const NL = '\u0001';
  const NLNL = '\u0002';
  const RULES = [
    { re: /\b(punto\s+y\s+aparte|punto\s+aparte)\b/gi, replace: '.' + NLNL },
    { re: /\b(nuevo\s+p[áa]rrafo|punto\s+y\s+p[áa]rrafo)\b/gi, replace: '.' + NLNL },
    { re: /\b(nueva\s+l[íi]nea|salto\s+de\s+l[íi]nea|nuevo\s+rengl[óo]n)\b/gi, replace: NL },
    { re: /\b(punto\s+y\s+seguido|punto\s+seguido)\b/gi, replace: '. ' },
    { re: /\b(punto\s+final)\b/gi, replace: '.' },
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
    { re: /\bcoma\b/gi, replace: ', ' },
    { re: /\bpunto\b/gi, replace: '. ' },
  ];
  for (const { re, replace } of RULES) {
    text = text.replace(re, replace);
  }
  text = text.replace(
    new RegExp(PROTECT_TOKEN + '(\\d+)' + PROTECT_TOKEN, 'g'),
    (_m, i) => protectedChunks[Number(i)] ?? '',
  );
  return cleanupSpacing(text);
}

export function cleanupSpacing(text: string): string {
  let out = text;
  out = out.replace(/\s+([.,;:!?)])/g, '$1');
  out = out.replace(/([.,;:!?])(?=[^\s\d.,;:!?)\u0001\u0002])/g, '$1 ');
  out = out.replace(/\(\s+/g, '(');
  out = out.replace(/[ \t]{2,}/g, ' ');
  out = out.replace(new RegExp('\\s*\u0002\\s*', 'g'), '\n\n');
  out = out.replace(new RegExp('\\s*\u0001\\s*', 'g'), '\n');
  out = out.replace(/\.{4,}/g, '...');
  out = out.replace(/([.,;:])\1+/g, '$1');
  out = out.replace(/(^|[.!?]\s+|\n)([a-záéíóúñ])/g, (_m, p, c) => p + c.toUpperCase());
  return out.replace(/[ \t]+\n/g, '\n').trim();
}

export function normalizeChunk(chunk: string): string {
  const normalized = normalizePunctuation(chunk);
  if (!normalized) return '';
  return /[\n]$/.test(normalized) ? normalized : normalized + ' ';
}

export function appendChunk(prev: string, chunk: string): string {
  const next = normalizeChunk(chunk);
  if (!next) return prev;
  if (!prev) return next;
  const needsSpace = !/[\s\n(]$/.test(prev);
  const joined = prev + (needsSpace ? ' ' : '') + next;
  return joined.replace(/([.!?]\s+)([a-záéíóúñ])/g, (_m, p, c) => p + c.toUpperCase());
}
