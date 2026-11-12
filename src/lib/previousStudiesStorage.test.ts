import { describe, expect, it, vi } from 'vitest';
import { savePreviousStudyFile } from './previousStudiesStorage';

describe('registro de estudios previos sin sobrescritura', () => {
  it('sube el archivo original sin sobrescribir', async () => {
    const file = new File(['foto original'], 'foto.png', { type: 'image/png' });
    const storage = { upload: vi.fn().mockResolvedValue({ error: null }), remove: vi.fn() };
    const register = vi.fn().mockResolvedValue({ error: null });
    await savePreviousStudyFile(storage, 'paciente/foto.png', file, register);
    expect(storage.upload).toHaveBeenCalledWith('paciente/foto.png', file, { upsert: false, contentType: 'image/png' });
    expect(register).toHaveBeenCalledOnce();
  });
  it('reutiliza el archivo duplicado y registra el estudio', async () => {
    const storage = { upload: vi.fn().mockResolvedValue({ error: { statusCode: '409', message: 'The resource already exists' } }), remove: vi.fn() };
    const register = vi.fn().mockResolvedValue({ error: null });
    await savePreviousStudyFile(storage, 'existente.pdf', new Blob(['pdf']), register);
    expect(register).toHaveBeenCalledOnce();
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it('borra solo el archivo recién subido si falla el insert', async () => {
    const storage = { upload: vi.fn().mockResolvedValue({ error: null }), remove: vi.fn().mockResolvedValue({ error: null }) };
    await expect(savePreviousStudyFile(storage, 'nuevo.pdf', new Blob(), async () => ({ error: { message: 'insert falló', code: '23505' } }))).rejects.toMatchObject({ code: '23505' });
    expect(storage.remove).toHaveBeenCalledWith(['nuevo.pdf']);
  });
  it('no borra un archivo reutilizado si falla el insert', async () => {
    const storage = { upload: vi.fn().mockResolvedValue({ error: { statusCode: '409', message: 'Duplicate' } }), remove: vi.fn() };
    await expect(savePreviousStudyFile(storage, 'existente.pdf', new Blob(), async () => ({ error: { message: 'insert falló' } }))).rejects.toMatchObject({ message: 'insert falló' });
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it('no inserta si Storage falla por otra causa', async () => {
    const storage = { upload: vi.fn().mockResolvedValue({ error: { statusCode: '403', message: 'Forbidden' } }), remove: vi.fn() };
    const register = vi.fn();
    await expect(savePreviousStudyFile(storage, 'nuevo.pdf', new Blob(), register)).rejects.toMatchObject({ statusCode: '403' });
    expect(register).not.toHaveBeenCalled();
  });
});