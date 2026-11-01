/**
 * Lector mínimo de archivos .zip, sin dependencias externas.
 * Lee el índice del zip y extrae cada archivo solo cuando se lo pide
 * (no carga todo el zip en memoria), usando la descompresión nativa del navegador.
 */
export interface ZipEntry {
  name: string;
  size: number; // tamaño descomprimido
  compressedSize: number;
  method: number; // 0 = sin comprimir, 8 = deflate
  localOffset: number;
  lastModified?: Date;
}

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;
const SIG_LOC = 0x04034b50;

function dosToDate(dosDate: number, dosTime: number): Date | undefined {
  const year = ((dosDate >> 9) & 0x7f) + 1980;
  const month = ((dosDate >> 5) & 0x0f) - 1;
  const day = dosDate & 0x1f;
  if (month < 0 || month > 11 || day < 1) return undefined;
  return new Date(year, month, day, (dosTime >> 11) & 0x1f, (dosTime >> 5) & 0x3f, (dosTime & 0x1f) * 2);
}

export async function listZipEntries(blob: Blob): Promise<ZipEntry[]> {
  const tailSize = Math.min(blob.size, 66000);
  const tail = new DataView(await blob.slice(blob.size - tailSize).arrayBuffer());
  let eocd = -1;
  for (let i = tailSize - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El archivo no es un .zip válido.');
  const total = tail.getUint16(eocd + 10, true);
  const cenSize = tail.getUint32(eocd + 12, true);
  const cenOffset = tail.getUint32(eocd + 16, true);
  if (total === 0xffff || cenOffset === 0xffffffff) throw new Error('El .zip es demasiado grande. Dividilo en partes más chicas.');
  const cen = new DataView(await blob.slice(cenOffset, cenOffset + cenSize).arrayBuffer());
  const entries: ZipEntry[] = [];
  const dec = new TextDecoder('utf-8');
  let p = 0;
  while (p + 46 <= cen.byteLength && cen.getUint32(p, true) === SIG_CEN) {
    const method = cen.getUint16(p + 10, true);
    const time = cen.getUint16(p + 12, true);
    const date = cen.getUint16(p + 14, true);
    const compressedSize = cen.getUint32(p + 20, true);
    const size = cen.getUint32(p + 24, true);
    const nameLen = cen.getUint16(p + 28, true);
    const extraLen = cen.getUint16(p + 30, true);
    const commentLen = cen.getUint16(p + 32, true);
    const localOffset = cen.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(cen.buffer, cen.byteOffset + p + 46, nameLen));
    entries.push({ name, size, compressedSize, method, localOffset, lastModified: dosToDate(date, time) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const source = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(data); controller.close(); } });
  const stream = source.pipeThrough(ds as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZipEntry(blob: Blob, entry: ZipEntry): Promise<Uint8Array> {
  const head = new DataView(await blob.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer());
  if (head.getUint32(0, true) !== SIG_LOC) throw new Error(`Entrada dañada en el zip: ${entry.name}`);
  const nameLen = head.getUint16(26, true);
  const extraLen = head.getUint16(28, true);
  const start = entry.localOffset + 30 + nameLen + extraLen;
  const raw = new Uint8Array(await blob.slice(start, start + entry.compressedSize).arrayBuffer());
  if (entry.method === 0) return raw;
  if (entry.method === 8) return inflateRaw(raw);
  throw new Error(`Compresión no soportada en ${entry.name}`);
}
