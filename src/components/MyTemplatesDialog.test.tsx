import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Base de datos simulada: una tabla de plantillas propias en memoria
const rows: any[] = [];
const calls: string[] = [];
vi.mock('@/integrations/supabase/client', () => {
  const builder = (op: string, payload?: any) => {
    const api: any = {
      eq: (_c: string, id: string) => { api._id = id; return api; },
      select: () => api,
      order: () => api,
      then: (res: any) => {
        if (op === 'select') return res({ data: rows.map((r) => ({ ...r })), error: null });
        if (op === 'insert') { rows.push({ id: `id${rows.length + 1}`, ...payload }); calls.push('insert'); return res({ error: null }); }
        if (op === 'update') {
          const r = rows.find((x) => x.id === api._id); if (r) Object.assign(r, payload); calls.push('update');
          return res({ data: r ? [{ id: r.id }] : [], error: null });
        }
        if (op === 'delete') { const i = rows.findIndex((x) => x.id === api._id); if (i >= 0) rows.splice(i, 1); calls.push('delete'); return res({ error: null }); }
      },
    };
    return api;
  };
  return { supabase: { from: () => ({
    select: () => builder('select'),
    insert: (p: any) => builder('insert', p),
    update: (p: any) => builder('update', p),
    delete: () => builder('delete'),
  }) } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// El editor de texto real es pesado: se reemplaza por un cuadro de texto simple
vi.mock('@/components/RichTextEditor', () => ({
  default: ({ content, onChange }: any) => <textarea aria-label="contenido" value={content} onChange={(e) => onChange(e.target.value)} />,
}));

import MyTemplatesDialog from './MyTemplatesDialog';

describe('Mis plantillas: editar las veces que haga falta', () => {
  beforeEach(() => { rows.length = 0; calls.length = 0; rows.push({ id: 'a1', name: 'Ecografía Abdominal', study_type: null, content: '<p>versión 1</p>' }); });

  it('editar una plantilla propia la actualiza (no crea otra) y se puede repetir', async () => {
    const onChanged = vi.fn();
    render(<MyTemplatesDialog open onOpenChange={() => {}} currentReport="" onChanged={onChanged} prefill={null} />);
    const editBtn = await screen.findByLabelText('Editar');

    for (const version of ['versión 2', 'versión 3']) {
      fireEvent.click(editBtn);
      const box = await screen.findByLabelText('contenido');
      await waitFor(() => expect((box as HTMLTextAreaElement).value).not.toBe(''));
      fireEvent.change(box, { target: { value: `<p>${version}</p>` } });
      fireEvent.click(screen.getByText('Guardar cambios'));
      await waitFor(() => expect(rows[0].content).toBe(`<p>${version}</p>`));
      await screen.findByLabelText('Editar');
    }
    expect(rows).toHaveLength(1);            // sigue siendo una sola plantilla
    expect(calls.filter((c) => c === 'insert')).toHaveLength(0);
    expect(calls.filter((c) => c === 'update')).toHaveLength(2);
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it('agregar una plantilla nueva sigue creando una nueva', async () => {
    render(<MyTemplatesDialog open onOpenChange={() => {}} currentReport="" onChanged={() => {}} prefill={null} />);
    await screen.findByLabelText('Editar');
    fireEvent.change(screen.getByPlaceholderText('Nombre de la plantilla'), { target: { value: 'Nueva' } });
    fireEvent.change(screen.getByLabelText('contenido'), { target: { value: '<p>texto</p>' } });
    fireEvent.click(screen.getByText('Guardar plantilla'));
    await waitFor(() => expect(rows).toHaveLength(2));
    expect(calls).toContain('insert');
  });

  it('desde una plantilla de la app: guarda tu versión; desde una propia (con id): la modifica', async () => {
    const { rerender } = render(<MyTemplatesDialog open onOpenChange={() => {}} currentReport="" onChanged={() => {}} prefill={{ name: 'Ecografía Pélvica', html: '<p>base</p>', studyType: '' }} />);
    await screen.findByText('Guardar plantilla');
    fireEvent.click(screen.getByText('Guardar plantilla'));
    await waitFor(() => expect(rows).toHaveLength(2));
    rerender(<MyTemplatesDialog open onOpenChange={() => {}} currentReport="" onChanged={() => {}} prefill={{ id: 'a1', name: 'Ecografía Abdominal', html: '<p>cambio</p>', studyType: '' }} />);
    await screen.findByText('Guardar cambios');
    fireEvent.click(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(rows.find((r) => r.id === 'a1').content).toBe('<p>cambio</p>'));
    expect(rows).toHaveLength(2);
  });
});
