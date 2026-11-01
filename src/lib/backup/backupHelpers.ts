/** Funciones puras del respaldo (se prueban aparte de la pantalla). */

/** Saca el nombre de archivo seguro (sin caracteres raros ni barras). */
export function safeName(value: string, max = 80): string {
  return (value || 'sin-nombre')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, max) || 'sin-nombre';
}

/** De un link de Storage (público o firmado) devuelve la ruta del archivo dentro del bucket. */
export function storagePathFromUrl(url: string, bucket: string): string | null {
  if (!url || url.startsWith('data:')) return null;
  const m = url.match(new RegExp(`/${bucket}/(.+?)(?:\\?|$)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Una celda de CSV, con comillas cuando hace falta. */
export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // BOM para que Excel abra bien las tildes
  return '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
}

/** Extensión según el tipo de archivo de una imagen base64 antigua. */
export function dataUrlInfo(dataUrl: string): { ext: string; base64: string } | null {
  const m = dataUrl.match(/^data:([\w/+.-]+);base64,(.*)$/s);
  if (!m) return null;
  const ext = m[1].includes('png') ? 'png' : m[1].includes('pdf') ? 'pdf' : 'jpg';
  return { ext, base64: m[2] };
}
