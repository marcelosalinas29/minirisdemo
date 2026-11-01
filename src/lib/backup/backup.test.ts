import { describe, it, expect } from 'vitest';
import { safeName, storagePathFromUrl, toCsv, dataUrlInfo } from './backupHelpers';

describe('respaldo: helpers', () => {
  it('safeName limpia tildes y símbolos', () => {
    expect(safeName('PÉREZ, José/María')).toBe('PEREZ_ Jose_Maria');
    expect(safeName('')).toBe('sin-nombre');
  });
  it('storagePathFromUrl saca la ruta de links firmados y públicos', () => {
    expect(storagePathFromUrl('https://x.supabase.co/storage/v1/object/sign/estudios_imagenes/abc/1_x.jpg?token=zz', 'estudios_imagenes')).toBe('abc/1_x.jpg');
    expect(storagePathFromUrl('https://x.supabase.co/storage/v1/object/public/estudios_imagenes/abc/2.jpg', 'estudios_imagenes')).toBe('abc/2.jpg');
    expect(storagePathFromUrl('data:image/jpeg;base64,AAA', 'estudios_imagenes')).toBeNull();
  });
  it('toCsv escapa comillas, punto y coma y saltos de línea', () => {
    const csv = toCsv(['a', 'b'], [['x;y', 'dice "hola"\nchau']]);
    expect(csv).toContain('"x;y"');
    expect(csv).toContain('"dice ""hola""\nchau"');
  });
  it('dataUrlInfo reconoce el tipo', () => {
    expect(dataUrlInfo('data:image/png;base64,QUJD')).toEqual({ ext: 'png', base64: 'QUJD' });
    expect(dataUrlInfo('hola')).toBeNull();
  });
});
