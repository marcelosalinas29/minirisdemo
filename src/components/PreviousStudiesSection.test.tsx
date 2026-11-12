import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PreviousStudiesSection from './PreviousStudiesSection';

const mocks = vi.hoisted(() => ({ insert: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ in: () => ({ order: async () => ({ data: [], error: null }) }) }), insert: mocks.insert }),
  storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'usuario' }, isDoctor: false, isAdmin: false }) }));
vi.mock('@/store/useClinicStore', () => ({ useClinicStore: () => ({ searchPatients: () => [], searchPatientsRemote: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('carga manual de estudios previos', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); mocks.insert.mockResolvedValue({ error: null }); mocks.upload.mockResolvedValue({ error: null }); });
  it('sin fecha guarda varios archivos intactos en el paciente elegido aunque el nombre sea distinto', async () => {
    render(<PreviousStudiesSection patientIds={['elegido']} primaryPatientId="elegido" canEdit initiallyAdding />);
    const files = [new File(['pdf'], 'OTRO PACIENTE 99999999.pdf', { type: 'application/pdf' }), new File(['foto'], 'foto.png', { type: 'image/png' })];
    fireEvent.change(screen.getByLabelText('Archivos del estudio'), { target: { files } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(2));
    for (const [row] of mocks.insert.mock.calls) expect(row).toMatchObject({ patient_id: 'elegido', fecha: null, tipo: 'Estudio previo', origen: 'propio', estado: 'asignado' });
    expect(mocks.upload.mock.calls.map((call) => call[1])).toEqual(files);
    expect(mocks.insert.mock.calls.map(([row]) => row.archivo_nombre)).toEqual(files.map((file) => file.name));
  });
  it('usa la misma fecha, tipo y origen para todos los archivos', async () => {
    render(<PreviousStudiesSection patientIds={['elegido']} primaryPatientId="elegido" canEdit initiallyAdding />);
    fireEvent.change(screen.getByLabelText('Fecha (opcional)'), { target: { value: '2026-06-10' } });
    fireEvent.change(screen.getByLabelText('Tipo de estudio'), { target: { value: 'Ecografía Abdominal' } });
    fireEvent.change(screen.getByLabelText('Origen'), { target: { value: 'externo' } });
    fireEvent.change(screen.getByLabelText('Archivos del estudio'), { target: { files: [new File(['doc'], 'informe.doc'), new File(['docx'], 'informe.docx')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(2));
    for (const [row] of mocks.insert.mock.calls) expect(row).toMatchObject({ fecha: '2026-06-10', tipo: 'Ecografía Abdominal', origen: 'externo' });
  });
  it('no guarda sin elegir un archivo', async () => {
    render(<PreviousStudiesSection patientIds={['elegido']} primaryPatientId="elegido" canEdit initiallyAdding />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});