export const DEFAULT_GEMINI_PROMPT = `Eres un analista experto en dotación docente del sistema educacional público chileno (SLEP - Servicios Locales de Educación Pública).
Debes analizar detalladamente la estructura de las planillas que varía de una a otra pero todas buscan establecer lo mismo. Las columnas de la "c" a la "i" contienen los datos contractuales de los docentes mientras que en las columnas TOTAL HA* (horas Aula de 45 minutos), TOTAL HC** Sub. Gral (horas aula transformadas a cronológicas), TOTAL HC** Sub. SEP (horas cronológicas SEP), TOTAL HC** Sub. PIE (horas cronológicas PIE) y TOTAL HC. Considera que hay algunas celdas con el formato h:mm, [h]:mm y similares, que pueden afectar el cálculo pero cuentan como "horas cerradas".
considera además que las horas de recreo, 65/35, 60/40 y similares son horas "aula" ya que son las proporciones correspondientes según las tablas oficiales de Mineduc
Debes clasificar cada una de las siguientes funciones, asignaturas o cargos escolares en exactamente UNA de estas 3 categorías oficiales:

1. "AULA" (Frente a estudiantes / Atención pedagógica directa y proporciones oficiales Mineduc):
   - Lenguaje, Matemática, Inglés, Historia, Ciencias Naturales, Biología, Física, Química, Artes, Música, Tecnología, Educación Física, Religión, Filosofía, Orientación.
   - Formación Ciudadana, Educación Ciudadana, Ciencias para la Ciudadanía.
   - Orientación cuando se imparte a estudiantes.
   - Talleres JEC, Talleres SEP, Talleres Extraescolares, AELE, Extensión Horaria.
   - Aula Común, Aula de Recursos, Atención PIE en aula, Codocencia, Monitoreo de cursos.
   - Profesor jefe con horas frente a estudiantes.
   - Recreos, Recreos 60/40, Recreos 65/35, Horas no lectivas 60/40, Horas no lectivas 65/35 (proporciones de aula según tablas Mineduc).
   - Regla de Oro: Toda actividad donde exista atención pedagógica directa de estudiantes o proporción lectiva Mineduc (recreos, 65/35, 60/40) debe clasificarse como AULA.

2. "TECNICA" (Gestión pedagógica no docente y apoyos):
   - Coordinación PIE, Trabajo Colaborativo PIE, Encargado(a) CRA, Coordinación CRA, Enlaces, Coordinación Enlaces/TIC.
   - Apoyo UTP, Apoyo Técnico, Orientador(a), Orientadora/orientador, Jefe UTP, Jefa UTP, Dirección, Equipo Directivo, Rector, Rectora.
   - Coordinación de ciclo, coordinación de departamento, coordinación matemática, coordinación lenguaje, coordinación convivencia escolar, coordinación extraescolar, coordinación medio ambiente, coordinación EPJA.
   - Encargado(a) SEP, Encargado(a) PIAE, Curriculista, Sala de Recursos.
   - Apoyo Técnico Administrativo, Encargado de informática, Planificación, Comunidades CAP.
   - Funciones no lectivas art 69.
   - Regla de Oro: Toda actividad fuera del aula que no sea directiva ni proporción lectiva debe ser considerada técnica.

3. "DIRECTIVA" (Liderazgo y dirección institucional):
   - Director, Directora, Encargado de Escuela, Inspector General, Inspectora General, Subdirector, Subdirectora.
   - Regla de Oro: Solo director, subdirector e inspector general constituyen horas Directivas.

Tratamiento de texto e IA:
- Analizar el texto de cada actividad
- Interpretar variantes ortográficas, errores de escritura y sinónimos
- Reconocer abreviaturas del sistema escolar chileno (ej: "coord pie", "coord. PIE", "coordinación pie", "coordinadora PIE" -> todas deben clasificarse como TECNICA)

Actividades a clasificar:
{activities_json}

Instrucciones de formato de respuesta:
Responde ÚNICAMENTE con un objeto JSON válido donde cada clave sea el texto exacto recibido y el valor sea exclusivamente "AULA", "TECNICA" o "DIRECTIVA".
Ejemplo de formato:
{
  "Taller Robótica Escolar": "AULA",
  "coord. PIE": "TECNICA",
  "Inspector General": "DIRECTIVA",
  "Jefe UTP": "TECNICA",
  "Recreos 65/35": "AULA"
}
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
  // AULA (Asignaturas, Atención Pedagógica Directa y Proporciones 65/35 / Recreos Mineduc)
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
  'plan de estudio': 'AULA',
  'plan de estudios': 'AULA',
  'planes de estudio': 'AULA',
  'apoyo en aula': 'AULA',
  'codocente': 'AULA',
  'co docente': 'AULA',
  'co-docente': 'AULA',
  'acompanamiento pedagogico': 'AULA',
  'mediacion escolar': 'AULA',
  'fundacion barnechea': 'AULA',
  'taller jec': 'AULA',
  'taller sep': 'AULA',
  'talleres': 'AULA',
  'taller': 'AULA',
  'taller pk': 'AULA',
  'talleres no jec': 'AULA',
  'taller no jec': 'AULA',
  'aula comun': 'AULA',
  'aula de recursos': 'AULA',
  'codocencia': 'AULA',
  'atencion pie': 'AULA',
  'docente pie': 'AULA',
  'pie': 'AULA',
  'docencia': 'AULA',
  'profesor de aula': 'AULA',
  'profesor jefe': 'AULA',

  // Proporciones Recreos y Horas No Lectivas 65/35 / 60/40 (Mineduc - Ley 20.903)
  'recreo': 'AULA',
  'recreos': 'AULA',
  'recreo 60/40': 'AULA',
  'recreos 60/40': 'AULA',
  'recreo 65/35': 'AULA',
  'recreos 65/35': 'AULA',
  'horas no lectivas 60/40': 'AULA',
  'horas no lectivos 60/40': 'AULA',
  'horas no lectivas 65/35': 'AULA',
  'horas no lectivos 65/35': 'AULA',
  'no lectiva 65/35': 'AULA',
  'no lectivas 65/35': 'AULA',
  'no lectivos 65/35': 'AULA',
  'no lectiva 60/40': 'AULA',
  'no lectivas 60/40': 'AULA',
  'no lectivos 60/40': 'AULA',

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
  'jefe de utp': 'TECNICA',
  'jefa de utp': 'TECNICA',
  'direccion': 'TECNICA',
  'equipo directivo': 'TECNICA',
  'rector': 'TECNICA',
  'rectora': 'TECNICA',
  'coordinador pie': 'TECNICA',
  'coordinadora pie': 'TECNICA',
  'coordinacion pie': 'TECNICA',
  'cordinacion pie': 'TECNICA',
  'cordinacion pie media': 'TECNICA',
  'coordinacion pie media': 'TECNICA',
  'coordinacion p.e.e.': 'TECNICA',
  'coordinacion pee': 'TECNICA',
  'coordinacion ensenanza media': 'TECNICA',
  'cordinadora 1° ciclo': 'TECNICA',
  'coordinadora 1° ciclo': 'TECNICA',
  'coordinador 1° ciclo': 'TECNICA',
  'coordinador de ciclo': 'TECNICA',
  'coordinadora de ciclo': 'TECNICA',
  'coordinacion de ciclo': 'TECNICA',
  'coord pie': 'TECNICA',
  'trabajo colaborativo pie': 'TECNICA',
  'colaborativo pie': 'TECNICA',
  'encargado cra': 'TECNICA',
  'encargada cra': 'TECNICA',
  'cra': 'TECNICA',
  'coordinador cra': 'TECNICA',
  'coordinacion cra': 'TECNICA',
  'enlaces': 'TECNICA',
  'coordinador enlaces': 'TECNICA',
  'coordinacion enlaces': 'TECNICA',
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
  'apoyo a la convivencia educativa 1° ciclo': 'TECNICA',
  'encargado convivencia ens. media': 'TECNICA',
  'encargada convivencia ens. media': 'TECNICA',
  'encargado convivencia ens. basica': 'TECNICA',
  'encargada convivencia ens. basica': 'TECNICA',
  'convivencia escolar': 'TECNICA',
  'apoyo biblioteca': 'TECNICA',
  'redes sociales': 'TECNICA',
  'horas gremiales': 'TECNICA',
  'art. 49 ley 19.070 reduccion horaria': 'TECNICA',
  'art 49 ley 19070 reduccion horaria': 'TECNICA',
  'tiempo funciones no lectivas (art. 69)': 'TECNICA',
  'tiempo funciones no lectivas (art 69)': 'TECNICA',
  'tiempo funciones no lectivos (art. 69)': 'TECNICA',
  'tiempo funciones no lectivas': 'TECNICA',
  'art 69': 'TECNICA',
  'art. 69': 'TECNICA',
  'curriculista': 'TECNICA',
  'evaluador': 'TECNICA',
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

  // Patrones de aula (incluyendo proporciones de recreo y 65/35 / 60/40 de aula)
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
    norm.includes('recreo') ||
    norm.includes('65/35') ||
    norm.includes('65 35') ||
    norm.includes('60/40') ||
    norm.includes('60 40') ||
    norm.includes('taller') ||
    norm.includes('aula') ||
    norm.includes('pie') ||
    norm.includes('identidad') ||
    norm.includes('autonomia') ||
    norm.includes('corporalidad') ||
    norm.includes('movimiento') ||
    norm.includes('parvul')
  ) {
    // Si contiene explícitamente "coord" o "encargad" o "art 69", no es aula
    if (!norm.includes('coord') && !norm.includes('encargad') && !norm.includes('art 69') && !norm.includes('art. 69')) {
      return { category: 'AULA', source: 'Regla Local (Patrón Asignatura / Proporción Mineduc)', confidence: 0.95 };
    }
  }

  // Patrones técnicos
  if (
    norm.includes('utp') ||
    norm.includes('cra') ||
    norm.includes('enlace') ||
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
    norm.includes('pme') ||
    norm.includes('no lectiv')
  ) {
    return { category: 'TECNICA', source: 'Regla Local (Patrón Técnico)', confidence: 0.95 };
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
