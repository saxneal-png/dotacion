import re
import unicodedata
import sqlite3
import os
import json
from typing import Dict, List, Tuple, Optional

# Initialize SQLite database for audit & classification cache
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "dotacion.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

DEFAULT_GEMINI_PROMPT = """Eres un analista experto en dotación docente del sistema educacional público chileno (SLEP - Servicios Locales de Educación Pública).
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
"""

DEFAULT_GEMINI_MODELS = [
    {
        "id": "gemini-3.8-flash",
        "display_name": "Gemini 3.8 Flash",
        "description": "Modelo de última generación. Velocidad extrema, alta precisión y optimizado para clasificación masiva.",
        "badge": "Nueva Generación",
        "is_recommended": True,
        "input_token_limit": 1048576,
        "output_token_limit": 8192,
    },
    {
        "id": "gemini-3.8-pro",
        "display_name": "Gemini 3.8 Pro",
        "description": "Máxima capacidad multimodal y razonamiento de última generación.",
        "badge": "Alta Precisión",
        "is_recommended": False,
        "input_token_limit": 2097152,
        "output_token_limit": 8192,
    },
    {
        "id": "gemini-3.7-flash",
        "display_name": "Gemini 3.7 Flash",
        "description": "Modelo híbrido de razonamiento ágil y procesamiento textual ultrarrápido.",
        "badge": "Recomendado",
        "is_recommended": True,
        "input_token_limit": 1048576,
        "output_token_limit": 8192,
    },
    {
        "id": "gemini-3.7-pro",
        "display_name": "Gemini 3.7 Pro",
        "description": "Razonamiento profundo para análisis y extracción de entidades complejas.",
        "badge": "Alta Precisión",
        "is_recommended": False,
        "input_token_limit": 2097152,
        "output_token_limit": 8192,
    },
    {
        "id": "gemini-3.6-flash",
        "display_name": "Gemini 3.6 Flash",
        "description": "Alta velocidad y exactitud para clasificación de texto pedagógico.",
        "badge": "Rápido",
        "is_recommended": False,
        "input_token_limit": 1048576,
        "output_token_limit": 8192,
    },
    {
        "id": "gemini-2.5-flash",
        "display_name": "Gemini 2.5 Flash",
        "description": "Modelo consolidado, rápido, económico y óptimo para planillas escolares.",
        "badge": "Estable",
        "is_recommended": False,
        "input_token_limit": 1048576,
        "output_token_limit": 8192,
    },
    {
        "id": "gemini-2.5-pro",
        "display_name": "Gemini 2.5 Pro",
        "description": "Capacidad avanzada de razonamiento y análisis contextual profundo.",
        "badge": "Alta Precisión",
        "is_recommended": False,
        "input_token_limit": 2097152,
        "output_token_limit": 8192,
    },
    {
        "id": "gemini-2.0-flash",
        "display_name": "Gemini 2.0 Flash",
        "description": "Alta velocidad y excelente precisión para procesamiento de texto escolar.",
        "badge": "Rápido",
        "is_recommended": False,
        "input_token_limit": 1048576,
        "output_token_limit": 8192,
    },
    {
        "id": "gemini-2.0-flash-lite",
        "display_name": "Gemini 2.0 Flash Lite",
        "description": "Modelo ultra ligero diseñado para máxima eficiencia y bajo consumo de cuota.",
        "badge": "Económico",
        "is_recommended": False,
        "input_token_limit": 1048576,
        "output_token_limit": 8192,
    },
    {
        "id": "gemini-1.5-flash",
        "display_name": "Gemini 1.5 Flash",
        "description": "Modelo clásico de alta estabilidad para tareas rápidas.",
        "badge": "Clásico",
        "is_recommended": False,
        "input_token_limit": 1048576,
        "output_token_limit": 8192,
    },
    {
        "id": "gemini-1.5-pro",
        "display_name": "Gemini 1.5 Pro",
        "description": "Modelo clásico avanzado para análisis exhaustivo.",
        "badge": "Pro",
        "is_recommended": False,
        "input_token_limit": 2097152,
        "output_token_limit": 8192,
    }
]

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS classification_cache (
                activity_norm TEXT PRIMARY KEY,
                original_text TEXT,
                category TEXT NOT NULL,
                source TEXT NOT NULL,
                confidence REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT,
                school_rbd TEXT,
                teacher_name TEXT,
                activity TEXT,
                hours REAL,
                category TEXT,
                source TEXT,
                gemini_response TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

init_db()

def get_gemini_prompt() -> str:
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT value FROM system_config WHERE key = 'gemini_prompt'")
            row = cur.fetchone()
            if row and row["value"]:
                return row["value"]
    except Exception as e:
        print(f"Error reading prompt from config: {e}")
    return DEFAULT_GEMINI_PROMPT

def set_gemini_prompt(prompt: str):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT OR REPLACE INTO system_config (key, value, updated_at)
            VALUES ('gemini_prompt', ?, CURRENT_TIMESTAMP)
        """, (prompt.strip(),))
        conn.commit()

def reset_gemini_prompt():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM system_config WHERE key = 'gemini_prompt'")
        conn.commit()

def get_selected_model() -> str:
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT value FROM system_config WHERE key = 'gemini_model'")
            row = cur.fetchone()
            if row and row["value"]:
                return row["value"]
    except Exception as e:
        print(f"Error reading model from config: {e}")
    return "gemini-2.5-flash"

def set_selected_model(model: str):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT OR REPLACE INTO system_config (key, value, updated_at)
            VALUES ('gemini_model', ?, CURRENT_TIMESTAMP)
        """, (model.strip(),))
        conn.commit()

def get_available_gemini_models(api_key: str, raise_errors: bool = False) -> List[Dict]:
    if not api_key or len(api_key.strip()) < 10:
        return DEFAULT_GEMINI_MODELS

    try:
        from google import genai
        client = genai.Client(api_key=api_key.strip())
        
        models_list = []
        for m in client.models.list():
            raw_id = getattr(m, "name", "") or ""
            model_id = raw_id.replace("models/", "").strip()
            
            # Filter only Gemini/Gemma generation models (exclude embeddings, imagen, audio, robot, etc.)
            lower_id = model_id.lower()
            if not ("gemini" in lower_id or "gemma" in lower_id):
                continue
            if any(ign in lower_id for ign in ["embedding", "embed", "imagen", "veo", "aqa", "tts", "transcription", "bison", "text-embedding"]):
                continue

            # Check supported actions if present
            supported_actions = getattr(m, "supported_actions", None) or []
            if supported_actions:
                actions_lower = [str(a).lower() for a in supported_actions]
                if not any("generatecontent" in a or "generate_content" in a for a in actions_lower):
                    continue

            display_name = getattr(m, "display_name", None) or model_id
            description = getattr(m, "description", None) or ""
            input_tokens = getattr(m, "input_token_limit", 1048576)
            output_tokens = getattr(m, "output_token_limit", 8192)

            is_rec = any(rec in model_id for rec in ["3.8-flash", "3.7-flash", "2.5-flash"]) and not any(x in model_id for x in ["lite", "exp", "thinking"])
            
            badge = "Estándar"
            if "3.8-flash" in model_id:
                badge = "Nueva Generación"
            elif "3.7-flash" in model_id:
                badge = "Recomendado"
            elif "3.8-pro" in model_id or "3.7-pro" in model_id:
                badge = "Alta Precisión"
            elif "3.6-flash" in model_id:
                badge = "Rápido"
            elif "2.5-flash" in model_id:
                badge = "Estable"
            elif "2.5-pro" in model_id or "1.5-pro" in model_id:
                badge = "Pro"
            elif "flash-lite" in model_id or "lite" in model_id:
                badge = "Económico"
            elif "flash" in model_id:
                badge = "Rápido"
            elif "thinking" in model_id or "reasoning" in model_id:
                badge = "Razonamiento"

            models_list.append({
                "id": model_id,
                "display_name": display_name,
                "description": description or f"Modelo Google Gemini ({model_id})",
                "badge": badge,
                "is_recommended": is_rec,
                "input_token_limit": input_tokens,
                "output_token_limit": output_tokens,
            })

        if models_list:
            # Dynamic sort by version (3.8 > 3.7 > 3.6 > 2.5 > 2.0 > 1.5), Flash before Pro
            def sort_key(item):
                mid = item["id"].lower()
                ver_match = re.search(r"(\d+(?:\.\d+)?)", mid)
                ver_val = float(ver_match.group(1)) if ver_match else 1.0
                
                is_flash = 1 if "flash" in mid and not ("lite" in mid) else (0.5 if "lite" in mid else 0)
                is_preview_or_exp = -0.2 if any(x in mid for x in ["exp", "preview", "thinking"]) else 0
                
                composite_score = ver_val * 10 + is_flash + is_preview_or_exp
                return (-composite_score, mid)

            models_list.sort(key=sort_key)
            return models_list

        return DEFAULT_GEMINI_MODELS
    except Exception as e:
        print(f"Error fetching models from Gemini API: {e}")
        if raise_errors:
            raise e
        return DEFAULT_GEMINI_MODELS

def clear_database():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM audit_log")
        cur.execute("DELETE FROM classification_cache")
        conn.commit()

def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = str(text).strip().lower()
    text = "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

# Reglas Oficiales:
# DIRECTIVA: Solo Director, Subdirector, Inspector General, Encargado de Escuela
# TECNICA: Todo lo fuera de aula que no sea directiva (incluye Jefe UTP, Dirección, Recreos, etc.)
# AULA: Atención pedagógica directa frente a estudiantes
LOCAL_EXACT_MAP: Dict[str, str] = {
    # Directiva (ESTRICTO: solo Director, Subdirector, Inspector General, Encargado de Escuela)
    "director": "DIRECTIVA",
    "directora": "DIRECTIVA",
    "subdirector": "DIRECTIVA",
    "subdirectora": "DIRECTIVA",
    "sub direccion": "DIRECTIVA",
    "inspector general": "DIRECTIVA",
    "inspectora general": "DIRECTIVA",
    "inspectoria general": "DIRECTIVA",
    "encargado de escuela": "DIRECTIVA",
    "encargada de escuela": "DIRECTIVA",

    # Técnica (Gestión pedagógica, apoyo no docente, liderazgo técnico pedagógico y no lectivas)
    "jefe utp": "TECNICA",
    "jefa utp": "TECNICA",
    "jefatura utp": "TECNICA",
    "utp": "TECNICA",
    "direccion": "TECNICA",
    "equipo directivo": "TECNICA",
    "rector": "TECNICA",
    "rectora": "TECNICA",
    "rectoria": "TECNICA",
    "coordinacion pie": "TECNICA",
    "coordinadora pie": "TECNICA",
    "coordinador pie": "TECNICA",
    "coord pie": "TECNICA",
    "coord. pie": "TECNICA",
    "trabajo colaborativo pie": "TECNICA",
    "colaborativo pie": "TECNICA",
    "trabajo colaborativo": "TECNICA",
    "cra": "TECNICA",
    "encargada cra": "TECNICA",
    "encargado cra": "TECNICA",
    "coordinacion cra": "TECNICA",
    "coordinador cra": "TECNICA",
    "coordinadora cra": "TECNICA",
    "enlaces": "TECNICA",
    "coordinacion enlaces": "TECNICA",
    "coordinador enlaces": "TECNICA",
    "encargado enlaces": "TECNICA",
    "encargado tic": "TECNICA",
    "coordinacion tic": "TECNICA",
    "apoyo utp": "TECNICA",
    "apoyo utp + pme": "TECNICA",
    "apoyo utp pme": "TECNICA",
    "apoyo tecnico": "TECNICA",
    "apoyo tecnico pedagogico": "TECNICA",
    "apoyo pedagogico": "TECNICA",
    "coordinacion pae": "TECNICA",
    "coord pae": "TECNICA",
    "coordinador pae": "TECNICA",
    "coordinadora pae": "TECNICA",
    "coordinacion formacion integral": "TECNICA",
    "orientador": "TECNICA",
    "orientadora": "TECNICA",
    "orientacion institucional": "TECNICA",
    "encargado de orientacion": "TECNICA",
    "encargada de orientacion": "TECNICA",
    "coordinacion de ciclo": "TECNICA",
    "coordinador de ciclo": "TECNICA",
    "coordinadora de ciclo": "TECNICA",
    "coordinacion de departamento": "TECNICA",
    "coordinador de departamento": "TECNICA",
    "coordinacion matematica": "TECNICA",
    "coordinacion lenguaje": "TECNICA",
    "coordinacion convivencia": "TECNICA",
    "coordinador de convivencia": "TECNICA",
    "encargado de convivencia": "TECNICA",
    "encargada de convivencia": "TECNICA",
    "encargado de convivencia escolar": "TECNICA",
    "coordinacion extraescolar": "TECNICA",
    "coordinacion medio ambiente": "TECNICA",
    "coordinacion epja": "TECNICA",
    "encargado sep": "TECNICA",
    "encargada sep": "TECNICA",
    "coordinacion sep": "TECNICA",
    "encargado piae": "TECNICA",
    "curriculista": "TECNICA",
    "sala de recursos": "TECNICA",
    "apoyo tecnico administrativo": "TECNICA",
    "encargado de informatica": "TECNICA",
    "planificacion": "TECNICA",
    "tiempo funciones no lectivas (art. 69)": "TECNICA",
    "tiempo funciones no lectivas (art 69)": "TECNICA",
    "tiempo funciones no lectivos (art. 69)": "TECNICA",
    "tiempo funciones no lectivas": "TECNICA",
    "tiempo funciones no lectivos": "TECNICA",
    "art 69": "TECNICA",
    "art. 69": "TECNICA",
    "comunidades cap": "TECNICA",
    "comunidad cap": "TECNICA",
    "reunion cap": "TECNICA",
    "capacitacion": "TECNICA",
    "evaluacion": "TECNICA",
    "preparacion de clases": "TECNICA",
    "consejo de profesores": "TECNICA",
    "reunion tecnica": "TECNICA",
    "reunion de profesores": "TECNICA",
    "atencion de apoderados": "TECNICA",
    "atencion apoderados": "TECNICA",

    # Aula (Frente a estudiantes y Proporciones Mineduc 65/35 / 60/40 / Recreos)
    "lenguaje": "AULA",
    "lenguaje y comunicacion": "AULA",
    "lengua y literatura": "AULA",
    "matematica": "AULA",
    "matematicas": "AULA",
    "ingles": "AULA",
    "idioma extranjero ingles": "AULA",
    "historia": "AULA",
    "historia geografia y ciencias sociales": "AULA",
    "formacion ciudadana": "AULA",
    "educacion ciudadana": "AULA",
    "ciencias para la ciudadania": "AULA",
    "ciencias naturales": "AULA",
    "ciencias": "AULA",
    "biologia": "AULA",
    "fisica": "AULA",
    "quimica": "AULA",
    "artes": "AULA",
    "artes visuales": "AULA",
    "artes plasticas": "AULA",
    "musica": "AULA",
    "educacion musical": "AULA",
    "tecnologia": "AULA",
    "educacion tecnologica": "AULA",
    "educacion fisica": "AULA",
    "educacion fisica y salud": "AULA",
    "ed fisica": "AULA",
    "religion": "AULA",
    "religion catolica": "AULA",
    "religion evangelica": "AULA",
    "filosofia": "AULA",
    "orientacion": "AULA",
    "orientacion vocacional": "AULA",
    "consejo de curso": "AULA",
    "consejo de curso y orientacion": "AULA",
    "recreo": "AULA",
    "recreos": "AULA",
    "recreo 60 40": "AULA",
    "recreos 60 40": "AULA",
    "recreo 65 35": "AULA",
    "recreos 65 35": "AULA",
    "horas no lectivas 60 40": "AULA",
    "horas no lectivos 60 40": "AULA",
    "horas no lectivas 65 35": "AULA",
    "horas no lectivos 65 35": "AULA",
    "no lectiva 65 35": "AULA",
    "no lectivas 65 35": "AULA",
    "no lectivos 65 35": "AULA",
    "no lectiva 60 40": "AULA",
    "no lectivas 60 40": "AULA",
    "no lectivos 60 40": "AULA",
    "identidad y autonomia": "AULA",
    "convivencia y ciudadania": "AULA",
    "corporalidad y movimiento": "AULA",
    "lenguaje verbal": "AULA",
    "lenguajes artisticos": "AULA",
    "pensamiento matematico": "AULA",
    "exploracion del entorno natural": "AULA",
    "comprension del entorno sociocultural": "AULA",
    "plan de estudio educacion parvularia": "AULA",
    "educacion parvularia": "AULA",
    "parvulos": "AULA",
    "primer ciclo": "AULA",
    "segundo ciclo": "AULA",
    "ensenanza basica": "AULA",
    "ensenanza media": "AULA",
    "profesor jefe": "AULA",
    "jefatura de curso": "AULA",
    "codocencia": "AULA",
    "co docencia": "AULA",
    "aula comun": "AULA",
    "aula de recursos": "AULA",
    "atencion pie en aula": "AULA",
    "atencion pie": "AULA",
    "pie aula": "AULA",
    "pie en aula": "AULA",
    "monitoreo de cursos": "AULA",
    "monitoreo de curso": "AULA",
    "extension horaria": "AULA",
    "aele": "AULA",
    "taller": "AULA",
    "talleres": "AULA",
    "taller jec": "AULA",
    "talleres jec": "AULA",
    "taller sep": "AULA",
    "talleres sep": "AULA",
    "taller extraescolar": "AULA",
    "talleres extraescolares": "AULA",
    "taller de musica": "AULA",
    "taller de deportes": "AULA",
    "taller de danza": "AULA",
    "taller de robotica": "AULA",
    "taller de ajedrez": "AULA",
    "taller de teatro": "AULA",
    "taller de lectura": "AULA",
    "taller de matematicas": "AULA",
    "taller de ingles": "AULA",
}

DIRECTIVE_KEYWORDS = [
    r"\bdirector(a)?\b",
    r"\bsubdirector(a)?\b",
    r"\binspector(a)?\s+general\b",
    r"\bencargad[oa]\s+de\s+escuela\b",
]

TECNICA_KEYWORDS = [
    r"\bjef(e|a)\s+utp\b",
    r"\butp\b",
    r"\bequipo\s+directivo\b",
    r"\brector(a)?\b",
    r"\bcoord(inador[a]?)?\s*(pie|cra|enlaces|tic|sep|ciclo|depto|departamento|convivencia|extraescolar|epja|pae|formacion\s+integral)\b",
    r"\btrabajo\s+colaborativo\b",
    r"\bapoyo\s+(utp|tecnico|pedagogico|admin)\b",
    r"\bapoyo\s+utp\s*(\+|\/|\s+)?pme\b",
    r"\bencargad[oa]\s+(sep|cra|enlaces|tic|piae|informatica|convivencia|orientacion)\b",
    r"\bcurriculista\b",
    r"\bplanificacion\b",
    r"\bcomunidad(es)?\s+cap\b",
    r"\bpreparacion\s+de\s+(clases|material)\b",
    r"\batencion\s+(de\s+)?apoderados\b",
    r"\borientador(a)?\b",
    r"\borientacion\s+institucional\b",
    r"\btiempo\s+funciones\s+no\s+lectivas\b",
    r"\bart(iculo|\.)?\s*69\b",
]

AULA_KEYWORDS = [
    r"\blengua(je| y literatura)?\b",
    r"\bmatematica(s)?\b",
    r"\bingles\b",
    r"\bhistoria\b",
    r"\bciencias\b",
    r"\bbiologia\b",
    r"\bfisica\b",
    r"\bquimica\b",
    r"\bartes?\b",
    r"\bmusica\b",
    r"\btecnologia\b",
    r"\bed(ucacion)?\s*fisica\b",
    r"\breligion\b",
    r"\bfilosofia\b",
    r"\bformacion\s+ciudadana\b",
    r"\borientacion(\s+vocacional)?\b",
    r"\bconsejo\s+de\s+curso\b",
    r"\brecreo(s)?\b",
    r"\b65\s*[\/\s]\s*35\b",
    r"\b60\s*[\/\s]\s*40\b",
    r"\b(identidad|autonomia|corporalidad|movimiento|lenguaje\s+verbal|lenguajes\s+artisticos|pensamiento\s+matematico|entorno\s+natural|entorno\s+sociocultural)\b",
    r"\btaller(es)?\b",
    r"\baula\s*(comun|de\s*recursos|pie)?\b",
    r"\bcodocencia\b",
    r"\baele\b",
    r"\bextension\s+horaria\b",
    r"\bparvularia\b",
    r"\bprofesor(a)?\s+jefe\b",
    r"\bjefatura\b",
    r"\bmonitoreo\b",
]

def classify_local(raw_activity: str) -> Optional[Tuple[str, str]]:
    norm = normalize_text(raw_activity)
    if not norm:
        return ("AULA", "Regla Local (Default)")

    # 1. Exact match in dictionary
    if norm in LOCAL_EXACT_MAP:
        return (LOCAL_EXACT_MAP[norm], "Regla Local (Diccionario)")

    # 2. Check cached classifications in SQLite
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT category, source FROM classification_cache WHERE activity_norm = ?", (norm,))
            row = cur.fetchone()
            if row:
                return (row["category"], f"Caché ({row['source']})")
    except Exception:
        pass

    # 3. Heuristic Regex Rules (Directiva > Técnica > Aula)
    for pattern in DIRECTIVE_KEYWORDS:
        if re.search(pattern, norm):
            return ("DIRECTIVA", "Regla Local (Patrón Directivo)")

    for pattern in TECNICA_KEYWORDS:
        if re.search(pattern, norm):
            return ("TECNICA", "Regla Local (Patrón Técnico)")

    for pattern in AULA_KEYWORDS:
        if re.search(pattern, norm):
            return ("AULA", "Regla Local (Patrón Pedagógico/Aula)")

    return None

def save_to_cache(activity_norm: str, original_text: str, category: str, source: str, confidence: float = 1.0):
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT OR REPLACE INTO classification_cache
                (activity_norm, original_text, category, source, confidence)
                VALUES (?, ?, ?, ?, ?)
            """, (activity_norm, original_text, category, source, confidence))
            conn.commit()
    except Exception as e:
        print(f"Error saving to cache: {e}")

def log_audit(file_name: str, school_rbd: str, teacher_name: str, activity: str, hours: float, category: str, source: str, gemini_response: str = ""):
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO audit_log
                (file_name, school_rbd, teacher_name, activity, hours, category, source, gemini_response)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (file_name, school_rbd, teacher_name, activity, hours, category, source, gemini_response))
            conn.commit()
    except Exception as e:
        print(f"Error logging audit: {e}")

def classify_batch_with_gemini(activities: List[str], api_key: str, model: Optional[str] = None) -> Tuple[Dict[str, str], str]:
    if not activities or not api_key:
        return {}, ""

    selected = (model or get_selected_model() or "gemini-3.7-flash").strip()
    
    # Priority list of models starting with the selected one
    candidate_models = [selected]
    for fallback_cand in [
        "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash",
        "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash",
        "gemini-3.8-pro", "gemini-3.7-pro", "gemini-2.5-pro"
    ]:
        if fallback_cand not in candidate_models:
            candidate_models.append(fallback_cand)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key.strip())

        prompt_template = get_gemini_prompt()
        if "{activities_json}" in prompt_template:
            prompt = prompt_template.replace("{activities_json}", json.dumps(activities, ensure_ascii=False, indent=2))
        else:
            prompt = f"{prompt_template}\n\nActividades a clasificar:\n{json.dumps(activities, ensure_ascii=False, indent=2)}"

        response = None
        last_error = None
        model_used = selected

        for cand in candidate_models:
            try:
                response = client.models.generate_content(
                    model=cand,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1
                    )
                )
                if response and response.text:
                    model_used = cand
                    break
            except Exception as me:
                last_error = me
                continue

        if not response or not response.text:
            raise Exception(f"No se pudo clasificar con ningún modelo de Gemini. Último error: {last_error}")

        response_text = response.text.strip()
        parsed = json.loads(response_text)

        result = {}
        for act in activities:
            val = parsed.get(act, "").strip().upper()
            if val not in ["AULA", "TECNICA", "DIRECTIVA"]:
                fallback, _ = classify_local(act) or ("AULA", "Default")
                val = fallback
            result[act] = val
            save_to_cache(normalize_text(act), act, val, f"Gemini AI ({model_used})")

        return result, model_used

    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        fallback_res = {}
        for act in activities:
            fb, _ = classify_local(act) or ("AULA", "Fallback")
            fallback_res[act] = fb
        return fallback_res, "Regla Heurística (Fallback Error)"

def classify_activity(activity: str, api_key: Optional[str] = None, model: Optional[str] = None) -> Tuple[str, str]:
    local_match = classify_local(activity)
    if local_match:
        return local_match

    if api_key:
        batch_res, model_used = classify_batch_with_gemini([activity], api_key, model=model)
        if activity in batch_res:
            return (batch_res[activity], f"Google Gemini AI ({model_used})")

    return ("AULA", "Regla Heurística (Default)")
