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

export function isRut(val: any): boolean {
  const s = cleanStr(val);
  if (!s) return false;
  if (/\b\d{1,2}\.?\d{3}\.?\d{3}[-‐][0-9kK]\b/.test(s)) return true;
  if (/\b\d{7,8}[kK]\b/.test(s)) return true;
  if (/^\d{7,9}$/.test(s)) return true;
  return false;
}

export function looksLikeTeacherName(s: string): boolean {
  const sClean = s.trim();
  if (sClean.length < 4) return false;
  const sLower = sClean.toLowerCase();
  if (['total', 'subtotal', 'promedio', 'resumen', 'rbd', 'escuela', 'colegio', 'liceo', 'slep'].some(k => sLower.includes(k))) {
    return false;
  }
  if ([
    'recreo', 'taller', 'asignatura', 'docencia', 'planificacion', 'planificación',
    'tiempo', 'artículo', 'art.', 'horas', 'formacion', 'formación', 'historia',
    'lenguaje', 'matematica', 'matemática', 'ciencias', 'artes', 'musica', 'música',
    'educacion', 'educación', 'ingles', 'inglés', 'filosofia', 'filosofía', 'biologia',
    'biología', 'quimica', 'química', 'fisica', 'física', 'tecnologia', 'tecnología',
    'religion', 'religión', 'orientacion', 'orientación', 'cra', 'pie', 'sep', 'utp'
  ].some(k => sLower.startsWith(k))) {
    return false;
  }
  return sClean.split(/\s+/).length >= 2;
}

/**
 * Convierte cualquier valor de celda (decimal, texto, h:mm o [h]:mm) a horas cronológicas exactas.
 */
export function parseHoursCell(val: any): number {
  if (val === null || val === undefined) return 0.0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0.0;
    if (val > 0 && val <= 50) return Math.round(val * 100) / 100;
    return 0.0;
  }

  const s = cleanStr(val);
  if (!s || s === '-' || s === '.' || s.toLowerCase() === 'nan') return 0.0;

  // Fechas reales como "01/03/2024" o "2024-03-01" -> no son horas
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$|^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(s)) return 0.0;

  // Formato H:MM o [H]:MM o H:MM:SS (ej. 1:34, 6:26, 12:00, [40]:00)
  const timeMatch = s.match(/\[?(\d+)\]?:(\d{1,2})(?::(\d{1,2}))?/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2] || '0', 10);
    const sec = parseInt(timeMatch[3] || '0', 10);
    const totalH = h + m / 60.0 + sec / 3600.0;
    if (totalH > 0 && totalH <= 50) {
      return Math.round(totalH * 100) / 100;
    }
  }

  // Texto con "hrs" o "horas": "44 HRS", "30 HORAS"
  const textHrsMatch = s.match(/(?:^|\b)(\d+(?:[.,]\d+)?)\s*(?:hrs?|horas?)\b/i);
  if (textHrsMatch) {
    const parsed = parseFloat(textHrsMatch[1].replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      return Math.round(parsed * 100) / 100;
    }
  }

  // Extracción de número inicial
  const numMatch = s.match(/^\s*(\d+(?:[.,]\d+)?)/);
  if (numMatch) {
    const parsed = parseFloat(numMatch[1].replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      return Math.round(parsed * 100) / 100;
    }
  }

  return 0.0;
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

  // 2. Mapear columnas de la fila de encabezado (con soporte para encabezados combinados multinivel)
  const headersRow1 = (data[headerRowIdx] || []).map((c) => cleanStr(c).toLowerCase());
  let hasSubHeader = false;
  let headersRow2: string[] = [];

  if (headerRowIdx + 1 < data.length) {
    headersRow2 = (data[headerRowIdx + 1] || []).map((c) => cleanStr(c).toLowerCase());
    const countH2 = headersRow2.filter((h) => ['run', 'rut', 'nombre', 'cargo', 'asignatura', 'hora', 'sub', 'total'].some((k) => h.includes(k))).length;
    if (countH2 >= 2) {
      hasSubHeader = true;
    }
  }

  const headers: string[] = [];
  const maxCols = Math.max(headersRow1.length, headersRow2.length);
  for (let c = 0; c < maxCols; c++) {
    const h1 = headersRow1[c] || '';
    const h2 = hasSubHeader && headersRow2[c] ? headersRow2[c] : '';
    if (h1 && h2 && h1 !== h2) {
      headers.push(`${h1} ${h2}`);
    } else if (h2) {
      headers.push(h2);
    } else {
      headers.push(h1);
    }
  }

  const dataStartIdx = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;

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

    if (colNombres === -1 && ['nombre', 'docente', 'profesor', 'funcionario', 'apellidos', 'personal'].some((k) => h.includes(k))) {
      colNombres = idx;
    } else if (colRun === -1 && ['run', 'rut', 'cedula', 'identificacion'].some((k) => h.includes(k))) {
      colRun = idx;
    } else if (['horas contrato', 'hrs contrato', 'hrs. contrato', 'total horas contrato', 'total hrs contrato', 'total contrato'].some((k) => h.includes(k))) {
      colContrato = idx;
    } else if (h.includes('total ha') || h.includes('horas aula')) {
      colTotalHa = idx;
    } else if (h.includes('sub. gral') || h.includes('sub gral') || h.includes('titulares sub gral')) {
      colSubGral = idx;
    } else if (h.includes('sub. sep') || h.includes('sub sep') || h.includes('titulares sep')) {
      colSubSep = idx;
    } else if (h.includes('sub. pie') || h.includes('sub pie') || h.includes('titulares pie')) {
      colSubPie = idx;
    } else if (h.includes('total hc') || h.includes('total hrs') || h.includes('total horas') || h.includes('total cronologicas')) {
      colTotalHc = idx;
    } else if (colActividad === -1 && ['asignatura', 'cargo', 'funcion', 'función', 'actividad', 'rol', 'especialidad', 'materia', 'descripcion', 'descripción'].some((k) => h.includes(k))) {
      colActividad = idx;
    } else if (colHorasSimple === -1 && ['horas asignadas', 'horas lectivas', 'jornada', 'hora', 'hrs'].some((k) => h.includes(k))) {
      colHorasSimple = idx;
    }
  }

  if (colNombres === -1) colNombres = 0;

  const teachersData: ParsedSchoolData['teachers'] = [];
  let currentTeacher = '';
  let currentRut = '';
  let currentContract = 0.0;

  for (let r = dataStartIdx; r < data.length; r++) {
    const row = data[r] || [];
    let nombreRaw = colNombres !== -1 && colNombres < row.length ? cleanStr(row[colNombres]) : '';
    let runRaw = colRun !== -1 && colRun < row.length ? cleanStr(row[colRun]) : '';
    const actRaw = colActividad !== -1 && colActividad < row.length ? cleanStr(row[colActividad]) : '';

    const rowStrLower = row.slice(0, 5).map(cleanStr).join(' ').toLowerCase();
    if (['total general', 'resumen general', 'subtotal general', 'promedio general'].some((k) => rowStrLower.startsWith(k))) {
      continue;
    }

    if (isRut(nombreRaw) && !isRut(runRaw) && looksLikeTeacherName(runRaw)) {
      const temp = nombreRaw;
      nombreRaw = runRaw;
      runRaw = temp;
    }

    const contratoNum = colContrato !== -1 && colContrato < row.length ? parseHoursCell(row[colContrato]) : 0.0;
    const hSimple = colHorasSimple !== -1 && colHorasSimple < row.length ? parseHoursCell(row[colHorasSimple]) : 0.0;

    const hGral = colSubGral !== -1 && colSubGral < row.length ? parseHoursCell(row[colSubGral]) : 0.0;
    const hSep = colSubSep !== -1 && colSubSep < row.length ? parseHoursCell(row[colSubSep]) : 0.0;
    const hPie = colSubPie !== -1 && colSubPie < row.length ? parseHoursCell(row[colSubPie]) : 0.0;
    const totHc = colTotalHc !== -1 && colTotalHc < row.length ? parseHoursCell(row[colTotalHc]) : 0.0;
    const totHa = colTotalHa !== -1 && colTotalHa < row.length ? parseHoursCell(row[colTotalHa]) : 0.0;

    let subHours = hGral + hSep + hPie;
    if (subHours === 0.0 && totHc > 0.0) {
      subHours = totHc;
    }
    if (subHours === 0.0 && totHa > 0.0) {
      subHours = (totHa * 45.0) / 60.0;
    }

    const hasNewRun = isRut(runRaw);
    const hasTeacherName = looksLikeTeacherName(nombreRaw);

    if (hasNewRun || (hasTeacherName && nombreRaw !== currentTeacher)) {
      if (hasTeacherName) {
        currentTeacher = nombreRaw;
      } else if (!currentTeacher && nombreRaw) {
        currentTeacher = nombreRaw;
      }
      if (runRaw) {
        currentRut = runRaw;
      }
      if (contratoNum > 0) {
        currentContract = contratoNum;
      } else if (totHc > 0 && colContrato === -1) {
        currentContract = totHc;
      }
    }

    // Prioridad 1: Columna de actividad presente
    if (actRaw && (hSimple > 0 || subHours > 0 || contratoNum > 0)) {
      const actHours = hSimple > 0 ? hSimple : subHours > 0 ? subHours : contratoNum;
      teachersData.push({
        teacher_name: currentTeacher || nombreRaw,
        rut: currentRut || runRaw,
        activity: actRaw,
        hours: Math.round(actHours * 100) / 100,
        total_declared: currentContract > 0 ? currentContract : actHours,
      });
      continue;
    }

    // Prioridad 2: Jerárquico SLEP (actividad en colNombres)
    if (currentTeacher && nombreRaw && !hasNewRun && subHours > 0) {
      const nLower = nombreRaw.toLowerCase();
      if (!nLower.startsWith('total') && !nLower.startsWith('subtotal') && !nLower.includes('promedio')) {
        teachersData.push({
          teacher_name: currentTeacher,
          rut: currentRut,
          activity: nombreRaw,
          hours: Math.round(subHours * 100) / 100,
          total_declared: currentContract > 0 ? currentContract : subHours,
        });
        continue;
      }
    }

    // Prioridad 3: Plano sin columna de actividad
    if ((currentTeacher || nombreRaw) && (hSimple > 0 || contratoNum > 0) && !actRaw && !subHours) {
      const actHours = hSimple > 0 ? hSimple : contratoNum;
      teachersData.push({
        teacher_name: currentTeacher || nombreRaw,
        rut: currentRut || runRaw,
        activity: 'Docencia de Aula',
        hours: Math.round(actHours * 100) / 100,
        total_declared: currentContract > 0 ? currentContract : actHours,
      });
      continue;
    }
  }

  return {
    rbd,
    establishment,
    matricula,
    teachers: teachersData,
  };
}
