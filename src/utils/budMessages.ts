export type FocusState = 
  | 'ENFOQUE' 
  | 'DISTRACCION' 
  | 'ALERTA_SUAVE' 
  | 'FATIGA' 
  | 'PARALISIS' 
  | 'AGOBIO_POSTURAL' 
  | 'SOBREESTIMULACION' 
  | 'CELEBRACION' 
  | 'PAUSA';

interface BudContext {
  stepText?: string;
  distractionCount?: number;
}

const extractCoreTarget = (stepText?: string): string => {
  if (!stepText) return 'el objetivo';

  // 1. Si el paso cita una meta o tema entre comillas simples o dobles, priorizar ese tema
  const quotedMatch = stepText.match(/['"“](.*?)['"”]/);
  if (quotedMatch && quotedMatch[1] && quotedMatch[1].length > 3) {
    let topic = quotedMatch[1].trim();
    topic = topic.replace(/^(estudiar\s+(para\s+el\s+|para\s+mi\s+|para\s+|el\s+)?)/i, '');
    if (topic.length <= 26) return topic.toLowerCase();
    const cut = topic.substring(0, 24).lastIndexOf(' ');
    return (cut > 4 ? topic.substring(0, cut) : topic.substring(0, 24)).toLowerCase();
  }

  // 2. Limpieza de prefijos numéricos y verbos iniciales en mayúsculas
  let clean = stepText.replace(/^(\d+(\.\d+)*\s*[-–—.:]?\s*|[•\-*]\s*|(PASO\s*\d+\s*[-–—.:]?\s*))/i, '').trim();
  clean = clean.replace(/^[A-ZÁÉÍÓÚÑ]+\s+/i, '').trim();

  // 3. Cortar antes de cláusulas subordinadas o preposiciones largas
  const clauseIdx = clean.search(/(\s+(para|resolviendo|puliendo|mediante|utilizando|según)\s+|,|\.)/i);
  if (clauseIdx !== -1 && clauseIdx > 5) {
    clean = clean.substring(0, clauseIdx).trim();
  }

  // 4. Limitar longitud respetando palabras completas
  if (clean.length > 25) {
    const spaceIdx = clean.substring(0, 24).lastIndexOf(' ');
    clean = (spaceIdx > 4 ? clean.substring(0, spaceIdx) : clean.substring(0, 24)).trim();
  }

  // 5. Eliminar estrictamente cualquier conector, artículo o preposición huérfana al final
  clean = clean.replace(/\s+(y|e|o|u|de|del|a|al|con|en|para|por|el|la|los|las|un|una)$/i, '').trim();

  return clean.replace(/[.,;:]+$/, '').trim().toLowerCase() || 'este bloque';
};

export const getBudContextualMessage = (rawState: string, context: BudContext = {}): string => {
  const normalized = (rawState || '')
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, '_') as FocusState;

  const target = extractCoreTarget(context.stepText);
  const count = context.distractionCount || 0;

  switch (normalized) {
    case 'AGOBIO_POSTURAL':
      return `Mucho peso en la postura. Soltemos los hombros y respiremos.`;

    case 'SOBREESTIMULACION':
      return `Mente saturada. Hagamos una pausa breve de respiración.`;

    case 'FATIGA':
      return `Cansancio detectado. Parpadeemos despacio y respiremos.`;

    case 'PARALISIS':
      return `Paso denso. Concentrémonos solo en ${target}.`;

    case 'ALERTA_SUAVE':
    case 'DISTRACCION': {
      if (count > 1) {
        return `Paso a paso. Retomemos solo: ${target}.`;
      }
      return `Aquí seguimos. Volvamos a ${target}.`;
    }

    case 'ENFOQUE': {
      const focusTemplates = [
        `Buen ritmo. Sigamos con ${target}.`,
        `Concentración sólida. Continuemos con ${target}.`,
        `Estamos en sintonía. Seguimos en ${target}.`
      ];
      return focusTemplates[Math.floor(Math.random() * focusTemplates.length)];
    }

    case 'CELEBRACION':
      return `¡Paso listo! Vamos juntos por el que sigue.`;

    case 'PAUSA':
      return `Pausa activa. Listos cuando tú decidas retomar.`;

    default:
      return `Concentración activa. Sigamos con ${target}.`;
  }
};
