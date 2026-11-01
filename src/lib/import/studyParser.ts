import { readZipEntry, listZipEntries } from './zipReader';

export interface ParsedStudy {
  paciente: string; // nombre detectado
  fecha: string | null; // ISO yyyy-mm-dd
  estudio: string;
  dni: string;
  origen: 'contenido' | 'nombre';
}

/** Texto de un .docx (documento de Word / Google Docs descargado). */
export async function docxToText(blob: Blob): Promise<string> {
  const entries = await listZipEntries(blob);
  const doc = entries.find((e) => e.name === 'word/document.xml');
  if (!doc) throw new Error('No parece un .docx válido');
  const xml = new TextDecoder('utf-8').decode(await readZipEntry(blob, doc));
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function toIso(d: string, m: string, y: string): string | null {
  let year = Number(y);
  if (y.length === 2) year += 2000;
  const month = Number(m), day = Number(d);
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Lee los encabezados PACIENTE / FECHA / ESTUDIO de un informe. */
export function parseReportText(text: string): ParsedStudy | null {
  const pac = text.match(/PACIENTE\s*[:：]\s*([^\n\r]+)/i);
  if (!pac) return null;
  const fec = text.match(/FECHA\s*[:：]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})/i);
  const est = text.match(/ESTUDIO\s*[:：]\s*([^\n\r]+)/i);
  const dni = text.match(/D\.?\s?N\.?\s?I\.?\s*[:：]?\s*([\d.]{6,12})/i);
  return {
    paciente: pac[1].replace(/\s+/g, ' ').trim(),
    fecha: fec ? toIso(fec[1], fec[2], fec[3]) : null,
    estudio: est ? est[1].replace(/\s+/g, ' ').trim() : '',
    dni: dni ? dni[1].replace(/\D/g, '') : '',
    origen: 'contenido',
  };
}

/** Datos a partir del nombre del archivo: "APELLIDO NOMBRES - tipo" o "PDF - APELLIDO NOMBRES TIPO". */
export function parseFileName(fileName: string): ParsedStudy {
  const base = fileName.replace(/^.*[\\/]/, '').replace(/\.[A-Za-z0-9]{2,5}$/, '').trim();
  const clean = base.replace(/^PDF\s*-\s*/i, '');
  const parts = clean.split(/\s*-\s*/);
  const paciente = parts[0].replace(/\s+/g, ' ').trim();
  const estudio = parts.slice(1).join(' ').trim();
  return { paciente, fecha: null, estudio, dni: '', origen: 'nombre' };
}

/** Los PDF "PDF - ..." suelen ser el respaldo que genera la propia app (ya están en el sistema). */
export function looksLikeAppBackup(fileName: string): boolean {
  return /^PDF\s*-\s*/i.test(fileName.replace(/^.*[\\/]/, ''));
}

// ---------- Coincidencia con pacientes ----------
export interface MatchPatient { id: string; name: string; dni: string; dniMaterno?: boolean }

export function foldName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
const STOP = new Set(['DE', 'LA', 'DEL', 'LOS', 'LAS', 'Y']);
export function nameTokens(s: string): string[] {
  return foldName(s).split(' ').filter((t) => t && !STOP.has(t));
}

export type MatchKind = 'exacto' | 'otro-orden' | 'posible' | 'ninguno';
export interface MatchResult { kind: MatchKind; candidates: MatchPatient[] }

export function matchPatients(nombre: string, dni: string, patients: MatchPatient[]): MatchResult {
  const t = nameTokens(nombre);
  const wantedDni = dni.replace(/\D/g, '');
  if (wantedDni.length >= 6) {
    const byDni = patients.filter((p) => !p.dniMaterno && p.dni.replace(/\D/g, '') === wantedDni);
    if (byDni.length > 0) return { kind: 'exacto', candidates: byDni.slice(0, 5) };
  }
  if (t.length === 0) return { kind: 'ninguno', candidates: [] };
  const seq = t.join(' ');
  const set = [...t].sort().join(' ');
  const exact: MatchPatient[] = [];
  const reordered: MatchPatient[] = [];
  const possible: MatchPatient[] = [];
  const s = new Set(t);
  for (const p of patients) {
    const pt = nameTokens(p.name);
    if (pt.length === 0) continue;
    if (pt.join(' ') === seq) { exact.push(p); continue; }
    if ([...pt].sort().join(' ') === set) { reordered.push(p); continue; }
    const ps = new Set(pt);
    const common = t.filter((x) => ps.has(x)).length;
    if (t[0] && ps.has(t[0]) && common >= 2 && (common >= t.length - 1 || common >= pt.length - 1)) possible.push(p);
  }
  if (exact.length) return { kind: 'exacto', candidates: exact.slice(0, 5) };
  if (reordered.length) return { kind: 'otro-orden', candidates: reordered.slice(0, 5) };
  if (possible.length) return { kind: 'posible', candidates: possible.slice(0, 5) };
  void s;
  return { kind: 'ninguno', candidates: [] };
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const decodeXml = (t: string) =>
  t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const escHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** XML de un .docx (word/document.xml) a HTML conservando negrita, cursiva, subrayado y alineación. */
export function docxXmlToHtml(xml: string): string {
  const paras = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  const out: string[] = [];
  for (const p of paras) {
    const jc = p.match(/<w:jc w:val="(\w+)"/)?.[1];
    const align = jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : jc === 'both' ? 'justify' : '';
    let html = '';
    for (const r of p.match(/<w:r[ >][\s\S]*?<\/w:r>/g) || []) {
      const rpr = r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] || '';
      const on = (tag: string) => new RegExp(`<w:${tag}(?: [^>]*)?/>`).test(rpr) && !new RegExp(`<w:${tag} w:val="(0|false|none)"`).test(rpr);
      const bold = on('b'), italic = on('i'), underline = on('u');
      let text = '';
      for (const m of r.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)) {
        text += m[0] === '<w:tab/>' ? '    ' : m[0] === '<w:br/>' ? '\n' : escHtml(decodeXml(m[1] ?? ''));
      }
      if (!text) continue;
      text = text.replace(/\n/g, '<br>');
      if (underline) text = `<u>${text}</u>`;
      if (italic) text = `<em>${text}</em>`;
      if (bold) text = `<strong>${text}</strong>`;
      html += text;
    }
    out.push(html.trim() ? `<p${align ? ` style="text-align: ${align}"` : ''}>${html}</p>` : '');
  }
  return out.filter(Boolean).join('');
}

/** Un .docx a HTML con su formato. */
export async function docxToHtml(blob: Blob): Promise<string> {
  const entries = await listZipEntries(blob);
  const doc = entries.find((e) => e.name === 'word/document.xml');
  if (!doc) throw new Error('No parece un .docx válido');
  return docxXmlToHtml(new TextDecoder('utf-8').decode(await readZipEntry(blob, doc)));
}
