export const DEFAULT_GEMINI_PROMPT = `Eres un clasificador experto en dotación docente del sistema educacional público chileno (SLEP).

Tu única tarea es clasificar cada actividad, función, asignatura o cargo escolar recibido en EXACTAMENTE una de estas 3 categorías: "AULA", "TECNICA" o "DIRECTIVA".

ORDEN DE PRIORIDAD (si una actividad calza con más de una categoría, resuelve en este orden):
1° DIRECTIVA (la más restrictiva) → 2° TECNICA → 3° AULA (categoría por defecto para todo lo pedagógico).

1. "AULA" — Atención pedagógica directa a estudiantes:
   - Asignaturas: Lenguaje, Matemática, Inglés, Historia, Ciencias Naturales, Biología, Física, Química, Artes, Música, Tecnología, Educación Física, Religión, Filosofía, Formación/Educación Ciudadana.
   - Ejes de Educación Parvularia (Bases Curriculares): Identidad y Autonomía, Convivencia y Ciudadanía, Corporalidad y Movimiento, Lenguaje Verbal, Lenguajes Artísticos, Pensamiento Matemático, Exploración del Entorno Natural, Comprensión del Entorno Sociocultural, Plan de Estudio Educación Parvularia.
   - Talleres JEC/SEP/Extraescolares, AELE, Extensión Horaria, Aula Común, Aula de Recursos, Codocencia.
   - Atención directa a estudiantes con NEE (Aula de Recursos NEET/NEEP, Atención PIE en aula), atención de párvulos frente a niños (recreos/almuerzo incluido, si implica cuidado directo de estudiantes).
   - Profesor jefe con horas frente a curso.
   - REGLA "ORIENTACIÓN": si el texto es solo "Orientación" (sin más calificación), clasifica AULA — es la hora de consejo de curso frente a estudiantes. Solo clasifica TECNICA si el texto dice explícitamente "Orientador(a) Institucional", "Encargado(a) de Orientación" o equivalente (rol de gestión, no hora frente a curso).

2. "TECNICA" — Gestión pedagógica no frente a curso y apoyos:
   - Coordinación PIE, Trabajo Colaborativo (PIE o no), Encargado(a)/Coordinación CRA, Enlaces/TIC.
   - Apoyo UTP, Jefe(a) UTP, Apoyo Técnico(-Administrativo), Dirección, Equipo Directivo, Rector(a).
   - Cualquier "Coordinación de/coordinación X" (ciclo, departamento, convivencia escolar, extraescolar, medio ambiente, EPJA, PAE, Formación Integral).
   - Encargado(a) SEP/PIAE/informática, Curriculista, Planificación, Comunidades CAP.
   - Recreos (60/40, 65/35), Horas no lectivas (60/40, 65/35), Funciones no lectivas Art. 69.
   - Roles combinados con "+" o "/" (ej. "Apoyo UTP + PME") → TECNICA, salvo que el rol dominante sea explícitamente de aula.

3. "DIRECTIVA" — Liderazgo institucional:
   - Únicamente: Director(a), Subdirector(a), Inspector(a) General, Encargado(a) de Escuela.
   - Ningún otro cargo (ni "Equipo Directivo", ni "Jefe UTP") entra aquí.

Interpretación de texto:
- Corrige mentalmente errores ortográficos, variantes regionales y abreviaturas ("coord pie", "coord. PIE" → TECNICA).
- Si el texto combina un nombre de persona con un cargo entre paréntesis, clasifica solo por el cargo.
- Si de verdad no puedes determinar la categoría tras aplicar las reglas anteriores, usa tu mejor estimación — NUNCA omitas una clave ni dejes un valor fuera de {AULA, TECNICA, DIRECTIVA}.

Actividades a clasificar:
{activities_json}

Responde ÚNICAMENTE un objeto JSON plano, sin texto adicional ni bloques de código, con cada clave siendo el texto exacto recibido y el valor exclusivamente "AULA", "TECNICA" o "DIRECTIVA".
`;

export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Diccionario exhaustivo local de términos educacionales chilenos
const LOCAL_DICT: Record<string, string> = {
  // AULA (Asignaturas y Atención Pedagógica Directa)
  'lenguaje': 'AULA',
  'matematica': 'AULA',
  'matematicas': 'AULA',
  'ingles': 'AULA',
  'historia': 'AULA',
  'ciencias': 'AULA',
  'ciencias naturales': 'AULA',
  'biologia': 'AULA',
  'fisica': 'AULA',
  'quimica': 'AULA',
  'artes': 'AULA',
  'artes visuales': 'AULA',
  'musica': 'AULA',
  'tecnologia': 'AULA',
  'educacion fisica': 'AULA',
  'ed. fisica': 'AULA',
  'religion': 'AULA',
  'filosofia': 'AULA',
  'formacion ciudadana': 'AULA',
  'educacion ciudadana': 'AULA',
  'ciencias para la ciudadania': 'AULA',
  'orientacion': 'AULA',
  'orientacion vocacional': 'AULA',
  'consejo de curso': 'AULA',
  'consejo de curso y orientacion': 'AULA',
  'docencia de aula': 'AULA',
  'taller jec': 'AULA',
  'taller sep': 'AULA',
  'talleres': 'AULA',
  'taller': 'AULA',
  'aula comun': 'AULA',
  'aula de recursos': 'AULA',
  'codocencia': 'AULA',
  'atencion pie': 'AULA',
  'docencia': 'AULA',
  'profesor de aula': 'AULA',
  'profesor jefe': 'AULA',

  // Ejes Educación Parvularia (Bases Curriculares)
  'identidad y autonomia': 'AULA',
  'convivencia y ciudadania': 'AULA',
  'corporalidad y movimiento': 'AULA',
  'lenguaje verbal': 'AULA',
  'lenguajes artisticos': 'AULA',
  'pensamiento matematico': 'AULA',
  'exploracion del entorno natural': 'AULA',
  'comprension del entorno sociocultural': 'AULA',
  'plan de estudio educacion parvularia': 'AULA',
  'educacion parvularia': 'AULA',

  // DIRECTIVA (REGLA ESTRICTA)
  'director': 'DIRECTIVA',
  'directora': 'DIRECTIVA',
  'subdirector': 'DIRECTIVA',
  'subdirectora': 'DIRECTIVA',
  'inspector general': 'DIRECTIVA',
  'inspectora general': 'DIRECTIVA',
  'encargado de escuela': 'DIRECTIVA',
  'encargada de escuela': 'DIRECTIVA',

  // TECNICA (Gestión no frente a curso, apoyos y roles no lectivos)
  'jefe utp': 'TECNICA',
  'jefa utp': 'TECNICA',
  'direccion': 'TECNICA',
  'equipo directivo': 'TECNICA',
  'rector': 'TECNICA',
  'rectora': 'TECNICA',
  'coordinador pie': 'TECNICA',
  'coordinadora pie': 'TECNICA',
  'coordinacion pie': 'TECNICA',
  'coord pie': 'TECNICA',
  'trabajo colaborativo pie': 'TECNICA',
  'colaborativo pie': 'TECNICA',
  'encargado cra': 'TECNICA',
  'encargada cra': 'TECNICA',
  'cra': 'TECNICA',
  'coordinador cra': 'TECNICA',
  'enlaces': 'TECNICA',
  'coordinador enlaces': 'TECNICA',
  'apoyo utp': 'TECNICA',
  'apoyo utp + pme': 'TECNICA',
  'apoyo utp pme': 'TECNICA',
  'coordinacion pae': 'TECNICA',
  'coord pae': 'TECNICA',
  'coordinador pae': 'TECNICA',
  'coordinadora pae': 'TECNICA',
  'coordinacion formacion integral': 'TECNICA',
  'orientador': 'TECNICA',
  'orientadora': 'TECNICA',
  'orientacion institucional': 'TECNICA',
  'encargado de orientacion': 'TECNICA',
  'encargada de orientacion': 'TECNICA',
  'recreo': 'TECNICA',
  'recreos': 'TECNICA',
  'recreo 60/40': 'TECNICA',
  'recreos 60/40': 'TECNICA',
  'recreo 65/35': 'TECNICA',
  'recreos 65/35': 'TECNICA',
  'horas no lectivas': 'TECNICA',
  'horas no lectivos': 'TECNICA',
  'horas no lectivas 60/40': 'TECNICA',
  'horas no lectivos 60/40': 'TECNICA',
  'horas no lectivas 65/35': 'TECNICA',
  'horas no lectivos 65/35': 'TECNICA',
  'no lectiva': 'TECNICA',
  'no lectivo': 'TECNICA',
  'no lectivas': 'TECNICA',
  'no lectivos': 'TECNICA',
  'tiempo no lectivo': 'TECNICA',
  'tiempo no lectiva': 'TECNICA',
  'tiempo funciones no lectivas (art. 69)': 'TECNICA',
  'tiempo funciones no lectivas (art 69)': 'TECNICA',
  'tiempo funciones no lectivos (art. 69)': 'TECNICA',
  'art 69': 'TECNICA',
  'art. 69': 'TECNICA',
  'curriculista': 'TECNICA',
  'evaluador': 'TECNICA',
  'convivencia escolar': 'TECNICA',
};

export function classifyLocal(text: string): { category: string; source: string; confidence: number } | null {
  const norm = normalizeText(text);

  // Coincidencia exacta
  if (LOCAL_DICT[norm]) {
    return { category: LOCAL_DICT[norm], source: 'Regla Local (Diccionario)', confidence: 1.0 };
  }

  // Patrones directivos estrictos
  if (
    /^director(a)?\b/.test(norm) ||
    norm.includes('subdirector') ||
    norm.includes('inspector general') ||
    norm.includes('inspectora general') ||
    norm.includes('encargado de escuela') ||
    norm.includes('encargada de escuela')
  ) {
    return { category: 'DIRECTIVA', source: 'Regla Local (Patrón Directivo)', confidence: 0.98 };
  }

  // Patrones técnicos
  if (
    norm.includes('utp') ||
    norm.includes('cra') ||
    norm.includes('enlace') ||
    norm.includes('recreo') ||
    norm.includes('no lectiv') ||
    norm.includes('art 69') ||
    norm.includes('art. 69') ||
    norm.includes('colaborativo') ||
    norm.includes('coord') ||
    norm.includes('coordinac') ||
    norm.includes('encargad') ||
    norm.includes('orientad') ||
    norm.includes('orientacion institucional') ||
    norm.includes('curricul') ||
    norm.includes('convivencia') ||
    norm.includes('rector') ||
    norm.includes('directivo') ||
    norm.includes('ciclo') ||
    norm.includes('depto') ||
    norm.includes('departamento') ||
    norm.includes('evaluac') ||
    norm.includes('planificac') ||
    norm.includes('pae') ||
    norm.includes('pme')
  ) {
    return { category: 'TECNICA', source: 'Regla Local (Patrón Técnico)', confidence: 0.95 };
  }

  // Patrones de aula
  if (
    norm.includes('lenguaje') ||
    norm.includes('matemat') ||
    norm.includes('ingles') ||
    norm.includes('historia') ||
    norm.includes('ciencia') ||
    norm.includes('fisica') ||
    norm.includes('quimica') ||
    norm.includes('biolog') ||
    norm.includes('arte') ||
    norm.includes('music') ||
    norm.includes('tecnolog') ||
    norm.includes('religion') ||
    norm.includes('filosof') ||
    norm.includes('ciudadan') ||
    norm.includes('orientac') ||
    norm.includes('consejo de curso') ||
    norm.includes('taller') ||
    norm.includes('aula') ||
    norm.includes('pie') ||
    norm.includes('identidad') ||
    norm.includes('autonomia') ||
    norm.includes('corporalidad') ||
    norm.includes('movimiento') ||
    norm.includes('parvul')
  ) {
    return { category: 'AULA', source: 'Regla Local (Patrón Asignatura)', confidence: 0.95 };
  }

  return null;
}

/**
 * Consulta a Google Gemini para clasificar actividades no reconocidas por el diccionario local.
 */
export async function callGeminiClassification(
  activities: string[],
  apiKey: string,
  modelName: string = 'gemini-2.5-flash',
  customPrompt?: string
): Promise<Record<string, string>> {
  if (!apiKey || activities.length === 0) return {};

  const promptTemplate = customPrompt || DEFAULT_GEMINI_PROMPT;
  const prompt = promptTemplate.replace('{activities_json}', JSON.stringify(activities, null, 2));

  const candidateModels = [
    modelName,
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ];

  for (const m of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!resp.ok) continue;

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      }
    } catch {
      // Continuar al siguiente modelo en caso de error
    }
  }

  return {};
}

/**
 * Clasificador híbrido completo que combina reglas locales + Gemini AI con caché en localStorage.
 */
export async function classifyActivitiesHybrid(
  activities: string[],
  apiKey: string,
  modelName: string = 'gemini-2.5-flash',
  customPrompt?: string
): Promise<Record<string, { category: string; source: string; confidence: number }>> {
  const result: Record<string, { category: string; source: string; confidence: number }> = {};
  const cacheKey = 'dotacion_classification_cache';
  let cache: Record<string, { category: string; source: string; confidence: number }> = {};

  try {
    const saved = localStorage.getItem(cacheKey);
    if (saved) cache = JSON.parse(saved);
  } catch {
    cache = {};
  }

  const pendingGemini: string[] = [];

  for (const act of activities) {
    const trimmed = act.trim();
    if (!trimmed) continue;

    // 1. Revisar Caché
    if (cache[trimmed]) {
      result[trimmed] = cache[trimmed];
      continue;
    }

    // 2. Revisar Reglas Locales
    const local = classifyLocal(trimmed);
    if (local) {
      result[trimmed] = local;
      cache[trimmed] = local;
      continue;
    }

    // 3. Enviar a Gemini
    pendingGemini.push(trimmed);
  }

  if (pendingGemini.length > 0 && apiKey) {
    const geminiResults = await callGeminiClassification(pendingGemini, apiKey, modelName, customPrompt);
    for (const act of pendingGemini) {
      const cat = (geminiResults[act] || '').toUpperCase();
      if (['AULA', 'TECNICA', 'DIRECTIVA'].includes(cat)) {
        result[act] = { category: cat, source: `Google Gemini AI (${modelName})`, confidence: 0.99 };
      } else {
        result[act] = { category: 'AULA', source: 'Regla por Defecto (Atención Alumnos)', confidence: 0.7 };
      }
      cache[act] = result[act];
    }
  } else if (pendingGemini.length > 0) {
    for (const act of pendingGemini) {
      result[act] = { category: 'AULA', source: 'Regla por Defecto (Sin API Key)', confidence: 0.7 };
      cache[act] = result[act];
    }
  }

  try {
    localStorage.setItem(cacheKey, JSON.stringify(cache));
  } catch {
    // Ignorar si el almacenamiento local está lleno
  }

  return result;
}
