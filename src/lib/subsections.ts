/** Manejo de "unidades" (líneas/apartados) de un informe para el dictado con IA. */

export interface Unit {
  index: number;
  label?: string;
  text: string;
}

export interface Section {
  title: string;
  content: string;
}

export interface UnitSection {
  title: string;
  units: Unit[];
}

export interface UnitUpdate {
  sectionTitle: string;
  unitIndex: number | null;
  action: 'replace' | 'append' | 'delete';
  text: string;
}

/** Divide el contenido de una sección en unidades (una por línea no vacía). */
export function splitUnits(content: string): string[] {
  return (content || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

const labelOf = (text: string): string | undefined => {
  const m = text.match(/^([^:.]{2,40}):/);
  return m ? m[1].trim() : undefined;
};

export function buildUnitsPayload(sections: Section[]): UnitSection[] {
  return sections.map((s) => ({
    title: s.title,
    units: splitUnits(s.content).map((text, index) => ({
      index,
      label: labelOf(text),
      text,
    })),
  }));
}

/** Aplica las actualizaciones de la IA y devuelve el texto plano resultante. */
export function applyUnitUpdates(section: Section, updates: UnitUpdate[]): string {
  const units = splitUnits(section.content);
  const toDelete = new Set<number>();

  for (const u of updates) {
    if (!u || typeof u !== 'object') continue;
    if (u.sectionTitle && u.sectionTitle !== section.title && updates.length > 1) {
      // Con una sola sección aceptamos igualmente los updates.
    }
    const idx = typeof u.unitIndex === 'number' ? u.unitIndex : null;

    if (u.action === 'delete') {
      if (idx !== null && idx >= 0 && idx < units.length) toDelete.add(idx);
      continue;
    }

    const text = (u.text || '').trim();
    if (!text) continue;

    if (u.action === 'replace' && idx !== null && idx >= 0 && idx < units.length) {
      units[idx] = text;
    } else {
      units.push(text);
    }
  }

  return units.filter((_, i) => !toDelete.has(i)).join('\n');
}

/** Devuelve las líneas nuevas o modificadas respecto del texto original. */
export function diffUnits(before: string, after: string): { changed: string[] } {
  const prev = new Set(splitUnits(before));
  return { changed: splitUnits(after).filter((line) => !prev.has(line)) };
}
