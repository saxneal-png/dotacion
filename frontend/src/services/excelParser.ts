import * as XLSX from 'xlsx';

export interface ParsedSchoolData {
  rbd: string;
  establishment: string;
  matricula: number;
  teachers: Array<{
    teacher_name: string;
    rut: string;
    activity: string;
    hours: number;
    total_declared: number;
  }>;
}

export function cleanStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * Convierte cualquier valor de celda (decimal, texto, h:mm o [h]:mm) a horas cronológicas exactas.
 */
export function parseHoursCell(val: any): number {
  if (val === null || val === undefined) return 0.0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0.0;
    return val;
  }

  const s = cleanStr(val);
  if (!s || s === '-' || s === '.' || s.toLowerCase() === 'nan') return 0.0;

  // Formato H:MM o [H]:MM (ej. 1:34, 6:26, 12:00, [40]:00)
  const timeMatch = s.match(/^\[?(\d+)\]?:(\d{1,2})(?::\d{1,2})?$/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    return Math.round((h + m / 60.0) * 100) / 100;
  }

  // Formato numérico estándar con comas o puntos (ej. "12,5" o "12.5")
  const cleaned = s.replace(',', '.').replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0.0 : parsed;
}

/**
 * Analiza un archivo Excel (.xlsx, .xls) o CSV en memoria desde el navegador.
 */
export async function parseExcelBrowser(file: File): Promise<ParsedSchoolData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: false,
    raw: false,
  });

  // Buscar la hoja más adecuada (priorizando nombres como dotacion, planilla, horas)
  let sheetName = workbook.SheetNames[0];
  for (const name of workbook.SheetNames) {
    const lower = name.toLowerCase();
    if (lower.includes('dotaci') || lower.includes('planilla') || lower.includes('horas') || lower.includes('docente')) {
      sheetName = name;
      break;
    }
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`No se pudo leer la hoja en ${file.name}`);
  }

  // Convertir a matriz bidimensional de strings limpios
  const data: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  let rbd = '';
  let establishment = '';
  let matricula = 0;
  let headerRowIdx = -1;

  const maxRows = Math.min(data.length, 30);

  // 1. Escanear metadatos (RBD, Establecimiento, Matrícula) en las primeras filas
  for (let r = 0; r < maxRows; r++) {
    const row = data[r] || [];
    const rowText = row.slice(0, 15).map(cleanStr).join(' ');

    if (!rbd) {
      const rbdMatch = rowText.match(/rbd\s*[:\.\-]?\s*(\d+)/i);
      if (rbdMatch) {
        rbd = rbdMatch[1];
      } else {
        for (let c = 0; c < row.length; c++) {
          const val = cleanStr(row[c]);
          if (/^1\d{4,5}$/.test(val)) {
            rbd = val;
            break;
          }
        }
      }
    }

    if (!establishment) {
      const estMatch = rowText.match(/(?:establecimiento|colegio|escuela|liceo)\s*[:\.\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\.\-]+)/i);
      if (estMatch && estMatch[1].trim().length > 3) {
        establishment = estMatch[1].trim().toUpperCase();
      }
    }

    if (matricula === 0) {
      const matMatch = rowText.match(/matr[ií]cula\s*[:\.\-]?\s*(\d+)/i);
      if (matMatch) {
        matricula = parseInt(matMatch[1], 10);
      }
    }

    // Buscar encabezados de la tabla docente
    const rowLower = row.map((c) => cleanStr(c).toLowerCase()).join(' ');
    const hasDocente = ['docente', 'nombre', 'profesor', 'funcionario', 'run', 'rut'].some((k) => rowLower.includes(k));
    const hasHoras = ['hora', 'hrs', 'asignatura', 'cargo', 'total ha', 'total hc'].some((k) => rowLower.includes(k));
    if (hasDocente && hasHoras) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx === -1) {
    for (let r = 0; r < maxRows; r++) {
      const rowLower = (data[r] || []).map((c) => cleanStr(c).toLowerCase());
      if (rowLower.some((x) => x.includes('docente') || x.includes('nombre') || x.includes('rut') || x.includes('run'))) {
        headerRowIdx = r;
        break;
      }
    }
  }

  if (headerRowIdx === -1) headerRowIdx = 0;

  // Fallbacks para metadatos si no se encontraron en las celdas
  if (!rbd) {
    const filenameRbd = file.name.match(/\b(\d{4,6})\b/);
    rbd = filenameRbd ? filenameRbd[1] : 'S/RBD';
  }

  if (!establishment || establishment.length < 3) {
    let cleanName = file.name.replace(/\.[^/.]+$/, '');
    cleanName = cleanName.replace(/(planilla|dotacion|slep|de|prueba|proyeccion|\d{4})/gi, '').trim();
    establishment = cleanName.replace(/^[ -_]+|[ -_]+$/g, '').toUpperCase() || 'ESTABLECIMIENTO SIN NOMBRE';
  }

  // 2. Mapear columnas de la fila de encabezado
  const headers = (data[headerRowIdx] || []).map((c) => cleanStr(c).toLowerCase());

  let colNombres = -1;
  let colRun = -1;
  let colContrato = -1;
  let colTotalHa = -1;
  let colSubGral = -1;
  let colSubSep = -1;
  let colSubPie = -1;
  let colTotalHc = -1;
  let colActividad = -1;
  let colHorasSimple = -1;

  for (let idx = 0; idx < headers.length; idx++) {
    const h = headers[idx];
    if (!h) continue;

    if (colNombres === -1 && ['nombre', 'docente', 'profesor', 'funcionario', 'apellidos'].some((k) => h.includes(k))) {
      colNombres = idx;
    } else if (colRun === -1 && ['run', 'rut'].some((k) => h.includes(k))) {
      colRun = idx;
    } else if (['horas contrato', 'hrs contrato', 'hrs. contrato'].some((k) => h.includes(k))) {
      colContrato = idx;
    } else if (h.includes('total ha') || h.includes('horas aula')) {
      colTotalHa = idx;
    } else if (h.includes('sub. gral') || h.includes('sub gral')) {
      colSubGral = idx;
    } else if (h.includes('sub. sep') || h.includes('sub sep')) {
      colSubSep = idx;
    } else if (h.includes('sub. pie') || h.includes('sub pie')) {
      colSubPie = idx;
    } else if (h.includes('total hc') || h.includes('total hrs') || h.includes('total horas')) {
      colTotalHc = idx;
    } else if (colActividad === -1 && ['asignatura', 'cargo', 'funcion', 'actividad', 'rol'].some((k) => h.includes(k))) {
      colActividad = idx;
    } else if (colHorasSimple === -1 && ['hora', 'hrs'].some((k) => h.includes(k))) {
      colHorasSimple = idx;
    }
  }

  if (colNombres === -1) colNombres = 0;

  const isHierarchical = (colSubGral !== -1 || colTotalHc !== -1 || colContrato !== -1) && colRun !== -1;
  const teachersData: ParsedSchoolData['teachers'] = [];

  if (isHierarchical) {
    let currentTeacher = '';
    let currentRut = '';
    let currentContract = 0.0;

    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const row = data[r] || [];
      const nombreVal = cleanStr(row[colNombres]);
      const runVal = colRun !== -1 && colRun < row.length ? cleanStr(row[colRun]) : '';

      if (!nombreVal && !runVal) continue;
      const nombreLower = nombreVal.toLowerCase();

      if (nombreLower.startsWith('total') || nombreLower.startsWith('subtotal') || nombreLower.includes('promedio')) {
        continue;
      }

      // Detección de Fila Maestra del Docente
      const hasRun = /\d{1,2}\.?\d{3}\.?\d{3}[-‐][0-9kK]|\b\d{7,8}[-‐][0-9kK]\b/.test(runVal);
      const contratoNum = colContrato !== -1 && colContrato < row.length ? parseHoursCell(row[colContrato]) : 0.0;

      const looksLikePerson =
        nombreVal.split(/\s+/).length >= 2 &&
        !['historia', 'lenguaje', 'matematica', 'artes', 'musica', 'recreo', 'funciones', 'taller'].some((k) =>
          nombreLower.includes(k)
        );

      if (hasRun || (contratoNum > 0 && looksLikePerson)) {
        currentTeacher = nombreVal;
        currentRut = runVal;
        currentContract = contratoNum;
        continue;
      }

      // Si no es fila maestra de docente, es una sub-fila de actividad
      if (currentTeacher && nombreVal) {
        const actividad = nombreVal;

        const hGral = colSubGral !== -1 && colSubGral < row.length ? parseHoursCell(row[colSubGral]) : 0.0;
        const hSep = colSubSep !== -1 && colSubSep < row.length ? parseHoursCell(row[colSubSep]) : 0.0;
        const hPie = colSubPie !== -1 && colSubPie < row.length ? parseHoursCell(row[colSubPie]) : 0.0;
        const totHc = colTotalHc !== -1 && colTotalHc < row.length ? parseHoursCell(row[colTotalHc]) : 0.0;
        const totHa = colTotalHa !== -1 && colTotalHa < row.length ? parseHoursCell(row[colTotalHa]) : 0.0;

        let hours = hGral + hSep + hPie;
        if (hours === 0.0 && totHc > 0.0) {
          hours = totHc;
        }
        if (hours === 0.0 && totHa > 0.0) {
          // Convertir horas pedagógicas (45 min) a cronológicas (60 min)
          hours = (totHa * 45.0) / 60.0;
        }

        if (hours > 0) {
          teachersData.push({
            teacher_name: currentTeacher,
            rut: currentRut,
            activity: actividad,
            hours: Math.round(hours * 100) / 100,
            total_declared: currentContract > 0 ? currentContract : hours,
          });
        }
      }
    }
  } else {
    // Modo Plano
    let currentTeacher = '';
    let currentRut = '';

    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const row = data[r] || [];
      let rowDocente = colNombres !== -1 && colNombres < row.length ? cleanStr(row[colNombres]) : '';
      if (!rowDocente && colRun !== -1 && colRun < row.length) {
        rowDocente = cleanStr(row[colRun]);
      }

      if (!rowDocente || ['total', 'subtotal', 'promedio', 'slep'].some((k) => rowDocente.toLowerCase().includes(k))) {
        continue;
      }

      currentTeacher = rowDocente;
      currentRut = colRun !== -1 && colRun < row.length ? cleanStr(row[colRun]) : '';
      const rowTotal = colTotalHc !== -1 && colTotalHc < row.length ? parseHoursCell(row[colTotalHc]) : 0.0;

      if (colActividad !== -1 && colHorasSimple !== -1) {
        const act = cleanStr(row[colActividad]);
        const h = parseHoursCell(row[colHorasSimple]);
        if (act && h > 0) {
          teachersData.push({
            teacher_name: currentTeacher,
            rut: currentRut,
            activity: act,
            hours: Math.round(h * 100) / 100,
            total_declared: rowTotal > 0 ? rowTotal : h,
          });
          continue;
        }
      }

      const actividad = colActividad !== -1 && colActividad < row.length ? cleanStr(row[colActividad]) : 'Docencia de Aula';
      const horas = colHorasSimple !== -1 && colHorasSimple < row.length ? parseHoursCell(row[colHorasSimple]) : rowTotal;

      if (horas > 0) {
        teachersData.push({
          teacher_name: currentTeacher,
          rut: currentRut,
          activity: actividad || 'Docencia de Aula',
          hours: Math.round(horas * 100) / 100,
          total_declared: rowTotal > 0 ? rowTotal : horas,
        });
      }
    }
  }

  return {
    rbd,
    establishment,
    matricula,
    teachers: teachersData,
  };
}
