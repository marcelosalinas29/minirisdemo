import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ImportStudiesPage from './ImportStudiesPage';

const mocks = vi.hoisted(() => ({ insert: vi.fn(), upload: vi.fn(), hash: vi.fn() }));
const patient = { id: 'paciente-manual', name: 'MARIA SCHREIBER', dni: '12345678' };
vi.mock('@/components/AppLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'secretaria' }, isViewer: false }) }));
vi.mock('@/store/useClinicStore', () => ({ useClinicStore: () => ({ patients: [patient], fetchPatients: vi.fn(), searchPatients: (query: string) => /MARIA|12345678/i.test(query) ? [patient] : [], searchPatientsRemote: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/import/studyParser', () => ({ sha256Hex: mocks.hash, parseFileName: () => ({ paciente: '', dni: '', fecha: '', estudio: '' }), matchPatients: () => ({ candidates: [], kind: 'ninguno' }), looksLikeAppBackup: () => false, docxToText: vi.fn(), parseReportText: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ in: async () => ({ data: [], error: null }) }), insert: mocks.insert }),
  storage: { from: () => ({ upload: mocks.upload, remove: vi.fn().mockResolvedValue({ error: null }) }) },
} }));

describe('asignación manual del importador', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); mocks.hash.mockResolvedValue('a'.repeat(64)); mocks.upload.mockResolvedValue({ error: null }); mocks.insert.mockResolvedValue({ error: null }); vi.spyOn(window, 'confirm').mockReturnValue(true); });
  for (const status of ['pendiente', 'error']) {
    it(`asigna un archivo ${status} por DNI y lo incluye para guardar`, async () => {
      if (status === 'error') mocks.hash.mockRejectedValueOnce(new Error('fallo de lectura'));
      const { container } = render(<ImportStudiesPage />);
      const file = new File(['PDF original'], 'sin-nombre.pdf', { type: 'application/pdf' });
      const input = container.querySelector('input[type=file]');
      if (!input) throw new Error('Falta selección de archivos');
      fireEvent.change(input, { target: { files: [file] } });
      const search = await screen.findByLabelText('Buscar paciente para asignar');
      fireEvent.change(search, { target: { value: '12345678' } });
      fireEvent.click(await screen.findByRole('button', { name: 'MARIA SCHREIBER · DNI 12345678' }));
      fireEvent.click(screen.getByRole('button', { name: 'Importar 1 seleccionado(s)' }));
      await waitFor(() => expect(mocks.insert).toHaveBeenCalledOnce());
      expect(mocks.insert.mock.calls[0][0]).toMatchObject({ patient_id: 'paciente-manual', estado: 'asignado', fecha: null, tipo: 'Estudio previo' });
      expect(mocks.upload.mock.calls[0][0]).toBe(`paciente-manual/${'a'.repeat(16)}_sin-nombre.pdf`);
      expect(mocks.upload.mock.calls[0][2].upsert).toBe(false);
    });
  }
});