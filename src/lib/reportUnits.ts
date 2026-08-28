/**
 * Puente entre el HTML de TipTap y el modelo de "unidades" de texto plano.
 *
 * Un <p> del editor = una línea = una unidad. Al reconstruir el HTML se
 * preserva la negrita de los encabezados y de las etiquetas "Hígado: ...".
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>');
}

/** HTML del editor -> texto plano (una línea por bloque). */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ');
  const el = document.createElement('div');
  el.innerHTML = withBreaks;
  const text = el.textContent || '';
  return text
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trim())
    .filter((l, i, arr) => l !== '' || (i > 0 && i < arr.length - 1 && arr[i - 1] !== ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Texto plano -> HTML compatible con el editor (mismo criterio que las plantillas). */
export function plainTextToHtml(text: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === '') return '';
      if (trimmed === '---') return '<p>---</p>';
      const isHeader = /^[A-ZÁÉÍÓÚÑÜ\s\-()/]+:?$/.test(trimmed) && trimmed.length < 60;
      if (isHeader) return `<p><strong>${escapeHtml(trimmed)}</strong></p>`;
      const labelMatch = trimmed.match(/^([A-Za-záéíóúñüÁÉÍÓÚÑÜ\s\-()/]+:)\s*(.*)/);
      if (labelMatch) {
        return `<p><strong>${escapeHtml(labelMatch[1])}</strong> ${escapeHtml(labelMatch[2])}</p>`;
      }
      return `<p>${escapeHtml(trimmed)}</p>`;
    })
    .filter(Boolean)
    .join('');
}
