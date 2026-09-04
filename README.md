# 🤠 Dotación Uyuy!! - Analizador de Dotación Docente SLEP

Aplicación web profesional diseñada para los **Servicios Locales de Educación Pública (SLEP)**. Procesa de manera automatizada planillas de dotación escolar (`.xlsx`, `.xls`, `.csv`), interpreta funciones y cargos mediante un motor híbrido inteligente (**Reglas del Estatuto Docente Chileno + Google Gemini AI**), clasifica las horas pedagógicas en **Aula**, **Técnicas** y **Directivas**, y genera el informe consolidado oficial.

---

## 🌐 Acceso Web Directo (Sin Instalar Nada)

Tus colegas y directivos pueden trabajar directamente en la aplicación web sin necesidad de instalar programas ni clonar código:

👉 **[https://saxneal-png.github.io/dotacion/](https://saxneal-png.github.io/dotacion/)**

Todo el procesamiento de las planillas ocurre de forma privada y ultrarrápida en el propio navegador de cada usuario.

---

## 🎯 Resultado Oficial

Genera con precisión matemática el consolidado ministerial en el formato oficial:

| RBD | ESTABLECIMIENTO | MATRÍCULA | HORAS DOCENTES AULA | HORAS DOCENTES DIRECTIVAS | HORAS DOCENTES TÉCNICAS | TOTAL HORAS EE |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 17822 | ESCUELA EJEMPLO SLEP | 345 | 184.0 | 44.0 | 142.0 | 370.0 |

> **Control de Calidad Automático**: Valida que $AULA + DIRECTIVA + TÉCNICA = TOTAL\ CONTRATO$. Si una planilla presenta descuadre en minutos u horas, el sistema lo resalta en rojo para auditoría inmediata.

---

## 🔑 Configuración de API Key (Google Gemini)

Cada usuario o colega debe utilizar su propia clave de API gratuita de Google Gemini:

1. **Obtener la clave (100% gratuita)**:
   - Ingresa a [Google AI Studio](https://aistudio.google.com/).
   - Inicia sesión con tu cuenta de Google y haz clic en **"Create API Key"**.
   - Copia la clave generada.

2. **Ingresar la clave en la web**:
   - Al abrir la página web, haz clic en el botón de la llave dorada (**"API Key"**) en la barra superior.
   - Pega tu clave y pulsa **"Mapear Modelos Disponibles"**. El sistema detectará automáticamente los modelos autorizados para tu cuenta (Gemini 3.8, 3.7, 3.6, 2.5 Flash, etc.).
   - Tu clave se guarda exclusivamente en tu navegador (`localStorage`), de forma privada y segura.

---

## ⚙️ Reglas Oficiales de Clasificación SLEP

El motor clasifica cada función bajo las directrices estrictas del sistema educativo público:

1. **AULA (Atención Pedagógica Directa)**:
   - Docencia frente a alumnos: Lenguaje, Matemática, Historia, Ciencias, Inglés, Artes, Música, Educación Física, Religión, Filosofía, etc.
   - Formación Ciudadana, Talleres JEC, Talleres SEP, Talleres Extraescolares.
   - Aula Común, Aula de Recursos, Atención PIE en aula, Codocencia.
   - *Regla de Oro: Toda actividad con presencia física y atención pedagógica directa a estudiantes.*

2. **TÉCNICA (Gestión Pedagógica y Apoyos)**:
   - Jefe(a) UTP, Apoyo UTP, Orientador(a) Institucional, Dirección / Equipo Directivo, Rector(a).
   - Encargado(a) CRA, Coordinación CRA, Enlaces / TIC.
   - Coordinación PIE, Trabajo Colaborativo PIE.
   - Recreos (60/40 y 65/35), Horas no lectivas (60/40 y 65/35).
   - Funciones no lectivas Art. 69, Planificación, Curriculista, Convivencia Escolar.
   - *Regla de Oro: Toda actividad fuera del aula que NO sea directiva es TÉCNICA.*

3. **DIRECTIVA (Liderazgo Escolar Superior)**:
   - **Exclusivamente**: Director(a), Subdirector(a), Inspector(a) General y Encargado(a) de Escuela.
   - *Regla de Oro: Solo estos 4 cargos constituyen horas Directivas.*

---

## 💡 Transparencia y Control del Prompt de IA

En la esquina superior derecha encontrarás el botón **`</> Prompt de IA`**:
- Permite **inspeccionar el texto exacto** que se le envía a Gemini.
- Permite **editarlo y personalizarlo** según las necesidades de tu Servicio Local.
- Incluye un botón para **restablecer** al prompt oficial ministerial con 1 clic.

---

## 📄 Tratamiento de Formatos Horarios (`h:mm`, `[h]:mm`)

La aplicación detecta y procesa de forma nativa celdas en formato horario (como `1:34`, `6:26`, `12:00` o `[40]:00`), convirtiéndolas a decimales cronológicos exactos ($1:34 + 6:26 = 8.00\text{h}$) sin pérdidas ni errores de redondeo.

---

## 💻 Ejecución Local Opcional (Para desarrolladores)

Si deseas ejecutar la aplicación en tu propia máquina con Python:
```bash
pip install -r requirements.txt
python run_app.py
```
Abrirá automáticamente la aplicación en `http://127.0.0.1:8080`.
