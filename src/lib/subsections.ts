/**
 * Mapeo por subsecciones / unidades.
 *
 * Objetivo: que cada hallazgo dictado reemplace EXACTAMENTE la frase de normalidad
 * del apartado anatómico correspondiente, manteniendo el orden de la plantilla.
 *
 * Adaptado a esta app: una sección es simplemente { title, content } y las
 * unidades se derivan del contenido (por líneas y oraciones), porque las
 * plantillas de acá tienen una línea por apartado anatómico.
 */

export interface ReportSectionLike {
  id?: string;
  title: string;
  content: string;
}

export interface SectionUnit {
  /** Índice estable dentro de la sección */
  index: number;
  /** Etiqueta anatómica (si la línea tiene formato "Hígado: ...") */
  label?: string;
  /** Texto actual de la unidad */
  text: string;
  /** Separador que sigue a esta unidad al reconstruir el texto */
  separator: string;
}

export interface SectionUnits {
  sectionId: string;
  sectionTitle: string;
  units: SectionUnit[];
  declared: boolean;
}

/** Detecta etiqueta anatómica al inicio de la línea ("Hígado: ..."). */
function detectLabel(text: string): string | undefined {
  const m = text.match(/^([A-Za-zÁÉÍÓÚÑÜáéíóúñü][A-Za-zÁÉÍÓÚÑÜáéíóúñü\s\-()/.]{1,40}?):/);
  return m ? m[1].trim() : undefined;
}

/** Divide un texto en oraciones/líneas conservando los separadores. */
function splitIntoUnits(content: string): SectionUnit[] {
  const units: SectionUnit[] = [];
  const lines = content.split(/(\n+)/);
  let index = 0;

  for (let i = 0; i < lines.length; i += 2) {
    const line = lines[i];
    const lineSep = lines[i + 1] ?? '';
    if (!line || !line.trim()) continue;

    // Si la línea es un apartado con etiqueta ("Hígado: ..."), es UNA unidad.
    if (detectLabel(line)) {
      units.push({
        index: index++,
        label: detectLabel(line),
        text: line.trim(),
        separator: lineSep || '\n',
      });
      continue;
    }

    // Oraciones dentro de la línea: cortamos tras . ! ? seguidos de espacio
    const parts = line.split(/(?<=[.!?])\s+/).filter((p) => p.trim().length > 0);
    parts.forEach((p, pi) => {
      const isLast = pi === parts.length - 1;
      units.push({
        index: index++,
        text: p.trim(),
        separator: isLast ? lineSep || '\n' : ' ',
      });
    });
  }

  if (units.length === 0 && content.trim()) {
    units.push({ index: 0, text: content.trim(), separator: '' });
  }
  return units;
}

export function getSectionUnits(section: ReportSectionLike): SectionUnits {
  return {
    sectionId: section.id ?? section.title,
    sectionTitle: section.title,
    units: splitIntoUnits(section.content),
    declared: false,
  };
}

export interface UnitUpdate {
  sectionTitle: string;
  unitIndex?: number | null;
  /** "replace" reemplaza la unidad; "append" agrega al final; "delete" la elimina */
  action?: 'replace' | 'append' | 'delete';
  text: string;
}

/**
 * Aplica actualizaciones de unidades y devuelve el contenido final de la sección,
 * manteniendo el orden jerárquico original.
 */
export function applyUnitUpdates(section: ReportSectionLike, updates: UnitUpdate[]): string {
  const { units } = getSectionUnits(section);
  const working = units.map((u) => ({ ...u }));
  const appended: string[] = [];

  for (const u of updates) {
    const action = u.action ?? (u.unitIndex == null ? 'append' : 'replace');
    if (action === 'append' || u.unitIndex == null) {
      if (u.text?.trim()) appended.push(u.text.trim());
      continue;
    }
    const target = working.find((w) => w.index === u.unitIndex);
    if (!target) {
      if (u.text?.trim()) appended.push(u.text.trim());
      continue;
    }
    if (action === 'delete') {
      target.text = '';
    } else {
      target.text = u.text.trim();
    }
  }

  const kept = working.filter((w) => w.text.length > 0);
  let out = '';
  kept.forEach((w, i) => {
    out += w.text;
    if (i < kept.length - 1) out += w.separator || ' ';
  });

  if (appended.length) {
    const usesNewlines = units.some((u) => u.separator.includes('\n'));
    const joiner = usesNewlines ? '\n' : ' ';
    out = out ? out + joiner + appended.join(joiner) : appended.join(joiner);
  }

  return out.trim();
}

/** Payload compacto que se envía al modelo. */
export function buildUnitsPayload(sections: ReportSectionLike[]) {
  return sections.map((s) => {
    const su = getSectionUnits(s);
    return {
      title: su.sectionTitle,
      declared: su.declared,
      units: su.units.map((u) => ({ index: u.index, label: u.label, text: u.text })),
    };
  });
}

/** Índices de unidades que cambiaron entre dos contenidos (para la vista previa). */
export function diffUnits(before: string, after: string): { changed: string[]; added: string[] } {
  const beforeUnits = splitIntoUnits(before).map((u) => u.text);
  const afterUnits = splitIntoUnits(after).map((u) => u.text);
  const changed = afterUnits.filter((t) => !beforeUnits.includes(t));
  const added = changed.filter((t) => {
    const label = detectLabel(t);
    if (!label) return true;
    return !beforeUnits.some((b) => detectLabel(b) === label);
  });
  return { changed, added };
}
