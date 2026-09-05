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

export function isSummaryOrTotalLabel(s: string): boolean {
  const sClean = s.trim().toLowerCase();
  if (!sClean) return false;
  const patterns = [
    /^(total|subtotal|sub-total|sub\s*total|resumen|suma|promedio|totales|carga\s*horaria|total\s*general|total\s*docente|total\s*contrato|total\s*horas|total\s*hrs)\b/,
    /^(rbd|escuela|colegio|liceo|slep|servicio\s*local|simbolog[ií]a|observacion(es)?)\b/,
  ];
  return patterns.some((p) => p.test(sClean));
}

export function looksLikeTeacherName(s: string): boolean {
  const sClean = s.trim();
  if (sClean.length < 3) return false;
  if (isSummaryOrTotalLabel(sClean)) return false;
  const sLower = sClean.toLowerCase();

  // Check common teacher placeholders in public schools
  if (['vacante', 'por contratar', 'reemplazo', 'sin asignar', 'a contratar', 'docente nuevo', 'profesor nuevo', 'pendiente', 'profesional de apoyo'].some((k) => sLower.includes(k))) {
    return true;
  }

  if ([
    'recreo', 'taller', 'asignatura', 'docencia', 'planificacion', 'planificación',
    'tiempo', 'artículo', 'art.', 'horas', 'formacion', 'formación', 'historia',
    'lenguaje', 'matematica', 'matemática', 'ciencias', 'artes', 'musica', 'música',
    'educacion', 'educación', 'ingles', 'inglés', 'filosofia', 'filosofía', 'biologia',
    'biología', 'quimica', 'química', 'fisica', 'física', 'tecnologia', 'tecnología',
    'religion', 'religión', 'orientacion', 'orientación', 'cra', 'pie', 'sep', 'utp'
  ].some((k) => sLower.startsWith(k))) {
    return false;
  }
  const parts = sClean.split(/\s+/);
  return parts.length >= 2 || sClean.length >= 5;
}

export function extractRoleFromName(name: string): { cleanName: string; role: string } {
  const m = name.match(/\(([^)]+)\)/);
  if (m) {
    const role = m[1].trim();
    const cleanName = name.replace(/\s*\([^)]+\)/, '').trim();
    return { cleanName, role };
  }
  return { cleanName: name.trim(), role: '' };
}

/**
 * Convierte cualquier valor de celda (decimal, texto, h:mm o [h]:mm) a horas cronológicas exactas.
 */
export function parseHoursCell(val: any): number {
  if (val === null || val === undefined) return 0.0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0.0;
    // Excel fraction of day (e.g. 0.267361 for 6h26m, 0.5 for 12h)
    if (val > 0.0 && val < 1.0) {
      const converted = val * 24.0;
      if (converted > 0 && converted <= 50) return Math.round(converted * 100) / 100;
    }
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

  // Extracción de número inicial (e.g. "44", "44.5", "0.267361")
  const numMatch = s.match(/^\s*(\d+(?:[.,]\d+)?)/);
  if (numMatch) {
    const parsed = parseFloat(numMatch[1].replace(',', '.'));
    if (!isNaN(parsed)) {
      if (parsed > 0.0 && parsed < 1.0) {
        const converted = parsed * 24.0;
        if (converted > 0 && converted <= 50) return Math.round(converted * 100) / 100;
      }
      if (parsed > 0 && parsed <= 50) {
        return Math.round(parsed * 100) / 100;
      }
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

  const data: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  let rbd = '';
  let establishment = '';
  let matricula = 0;
  let headerRowIdx = -1;

  const maxRows = Math.min(data.length, 50);

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

    const rowLower = row.map((c) => cleanStr(c).toLowerCase()).join(' ');
    const hasDocente = ['docente', 'nombre', 'profesor', 'funcionario', 'run', 'rut', 'personal'].some((k) => rowLower.includes(k));
    const hasHoras = ['hora', 'hrs', 'asignatura', 'cargo', 'total ha', 'total hc', 'funcion', 'jornada', 'actividad', 'especialidad'].some((k) => rowLower.includes(k));
    if (hasDocente && hasHoras && headerRowIdx === -1) {
      headerRowIdx = r;
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

  if (!rbd) {
    const filenameRbd = file.name.match(/\b(\d{4,6})\b/);
    rbd = filenameRbd ? filenameRbd[1] : 'S/RBD';
  }

  if (!establishment || establishment.length < 3) {
    let cleanName = file.name.replace(/\.[^/.]+$/, '');
    cleanName = cleanName.replace(/(planilla|dotacion|slep|de|prueba|proyeccion|\d{4})/gi, '').trim();
    establishment = cleanName.replace(/^[ -_]+|[ -_]+$/g, '').toUpperCase() || 'ESTABLECIMIENTO SIN NOMBRE';
  }

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

    if (colNombres === -1 && ['nombre', 'docente', 'profesor', 'funcionario', 'apellidos', 'personal', 'nombres'].some((k) => h.includes(k))) {
      colNombres = idx;
    } else if (colRun === -1 && ['run', 'rut', 'cedula', 'identificacion'].some((k) => h.includes(k))) {
      colRun = idx;
    } else if (colContrato === -1 && [
      'horas contrato', 'hrs contrato', 'hrs. contrato', 'total horas contrato',
      'total hrs contrato', 'total contrato', 'horas totales', 'total horas',
      'horas semanales', 'total carga horaria'
    ].some((k) => h.includes(k))) {
      colContrato = idx;
    } else if (colTotalHa === -1 && (h.includes('total ha') || h.includes('horas aula'))) {
      colTotalHa = idx;
    } else if (colSubGral === -1 && ((h.includes('total hc') && h.includes('gral')) || h.includes('hc sub. gral') || h.includes('hc sub gral') || ((h.includes('sub. gral') || h.includes('sub gral')) && !h.includes('titular') && !h.includes('contrata')))) {
      colSubGral = idx;
    } else if (colSubSep === -1 && ((h.includes('total hc') && h.includes('sep')) || h.includes('hc sub. sep') || h.includes('hc sub sep') || ((h.includes('sub. sep') || h.includes('sub sep')) && !h.includes('titular') && !h.includes('contrata')))) {
      colSubSep = idx;
    } else if (colSubPie === -1 && ((h.includes('total hc') && h.includes('pie')) || h.includes('hc sub. pie') || h.includes('hc sub pie') || ((h.includes('sub. pie') || h.includes('sub pie')) && !h.includes('titular') && !h.includes('contrata')))) {
      colSubPie = idx;
    } else if (colTotalHc === -1 && (h === 'total hc' || h.includes('total hc') || h.includes('total cronologicas') || h.includes('total cronológicas') || h.includes('horas cronologicas') || h.includes('horas cronológicas'))) {
      colTotalHc = idx;
    } else if (colActividad === -1 && ['asignatura', 'cargo', 'funcion', 'función', 'actividad', 'rol', 'especialidad', 'materia', 'descripcion', 'descripción'].some((k) => h.includes(k))) {
      colActividad = idx;
    } else if (colHorasSimple === -1 && ['horas asignadas', 'horas lectivas', 'jornada', 'horas', 'hora', 'hrs'].some((k) => h.includes(k))) {
      colHorasSimple = idx;
    }
  }

  if (colNombres === -1) colNombres = 0;

  const teachersData: ParsedSchoolData['teachers'] = [];

  // CASE 1: Flat / Standard spreadsheet (explicit activity column)
  if (colActividad !== -1 && (colHorasSimple !== -1 || colContrato !== -1 || colTotalHc !== -1)) {
    let currentTeacher = '';
    let currentRut = '';
    let currentContract = 0.0;

    for (let r = dataStartIdx; r < data.length; r++) {
      const row = data[r] || [];
      let nombreRaw = colNombres !== -1 && colNombres < row.length ? cleanStr(row[colNombres]) : '';
      let runRaw = colRun !== -1 && colRun < row.length ? cleanStr(row[colRun]) : '';
      const actRaw = colActividad !== -1 && colActividad < row.length ? cleanStr(row[colActividad]) : '';

      const rowStrLower = row.slice(0, 5).map(cleanStr).join(' ').toLowerCase();
      if (isSummaryOrTotalLabel(rowStrLower) || isSummaryOrTotalLabel(nombreRaw)) {
        continue;
      }

      if (isRut(nombreRaw) && !isRut(runRaw)) {
        nombreRaw = runRaw;
        runRaw = cleanStr(row[colNombres]);
      }

      const contratoNum = colContrato !== -1 && colContrato < row.length ? parseHoursCell(row[colContrato]) : 0.0;
      const hSimple = colHorasSimple !== -1 && colHorasSimple < row.length ? parseHoursCell(row[colHorasSimple]) : 0.0;
      const totHc = colTotalHc !== -1 && colTotalHc < row.length ? parseHoursCell(row[colTotalHc]) : 0.0;

      if (nombreRaw && !isSummaryOrTotalLabel(nombreRaw)) {
        currentTeacher = nombreRaw;
      }
      if (runRaw) {
        currentRut = runRaw.replace(',', '.').replace(/\s+/g, '');
      }
      if (contratoNum > 0) {
        currentContract = contratoNum;
      } else if (totHc > 0) {
        currentContract = totHc;
      }

      const actH = hSimple > 0 ? hSimple : totHc > 0 ? totHc : contratoNum;
      
      // Never omit teacher: fallback activity if blank
      const { cleanName: cleanTname, role: roleInName } = extractRoleFromName(currentTeacher);
      const finalAct = actRaw || roleInName || 'Docencia de Aula';

      if (currentTeacher && (actH > 0 || currentContract > 0)) {
        const effectiveH = actH > 0 ? actH : currentContract;
        teachersData.push({
          teacher_name: cleanTname,
          rut: currentRut,
          activity: finalAct,
          hours: Math.round(effectiveH * 100) / 100,
          total_declared: currentContract > 0 ? currentContract : effectiveH,
        });
      }
    }

    return {
      rbd,
      establishment,
      matricula,
      teachers: teachersData,
    };
  }

  // CASE 2: SLEP Hierarchical spreadsheet (activities in sub-rows under colNombres)
  let r = dataStartIdx;
  let currentSection = '';

  while (r < data.length) {
    const row = data[r] || [];
    const c1 = cleanStr(row[colNombres]);
    const c2 = colRun !== -1 && colRun < row.length ? cleanStr(row[colRun]) : '';

    // Check section headers
    if (!c2 && c1 && ['PIE', 'CO DOCENTES', 'EQUIPO GESTIÓN', 'ASISTENTES', 'SIMBOLOGÍA', 'RESUMEN'].some((k) => c1.toUpperCase().includes(k)) && !looksLikeTeacherName(c1)) {
      currentSection = c1.toUpperCase();
      r++;
      continue;
    }

    if (isSummaryOrTotalLabel(c1)) {
      r++;
      continue;
    }

    const hasRun = colRun !== -1 ? isRut(c2) : false;
    const contratoNum = colContrato !== -1 && colContrato < row.length ? parseHoursCell(row[colContrato]) : 0.0;
    
    // Check any master hours
    const hGralMaster = colSubGral !== -1 && colSubGral < row.length ? parseHoursCell(row[colSubGral]) : 0.0;
    const hSepMaster = colSubSep !== -1 && colSubSep < row.length ? parseHoursCell(row[colSubSep]) : 0.0;
    const hPieMaster = colSubPie !== -1 && colSubPie < row.length ? parseHoursCell(row[colSubPie]) : 0.0;
    const totHcMaster = colTotalHc !== -1 && colTotalHc < row.length ? parseHoursCell(row[colTotalHc]) : 0.0;
    const anyMasterH = (contratoNum > 0 || hGralMaster > 0 || hSepMaster > 0 || hPieMaster > 0 || totHcMaster > 0);

    const isValidTeacher = hasRun || (looksLikeTeacherName(c1) && (anyMasterH || c1 !== ''));
    if (!isValidTeacher) {
      r++;
      continue;
    }

    const { cleanName: teacherName, role: roleInName } = extractRoleFromName(c1);
    const teacherRut = c2 ? c2.replace(',', '.').replace(/\s+/g, '') : '';

    const subRows: Array<{ name: string; hours: number }> = [];
    let subR = r + 1;

    while (subR < data.length) {
      const subRow = data[subR] || [];
      const subC1 = cleanStr(subRow[colNombres]);
      const subC2 = colRun !== -1 && colRun < subRow.length ? cleanStr(subRow[colRun]) : '';

      // Stop if next row is teacher with RUN
      if (colRun !== -1 && isRut(subC2)) {
        break;
      }
      // Stop if next row is teacher with name & contract
      const subContrato = colContrato !== -1 && colContrato < subRow.length ? parseHoursCell(subRow[colContrato]) : 0.0;
      if (looksLikeTeacherName(subC1) && subContrato > 0) {
        break;
      }
      // Stop if section header
      if (!subC2 && subC1 && ['PIE', 'CO DOCENTES', 'EQUIPO GESTIÓN', 'SIMBOLOGÍA', 'RESUMEN'].some((k) => subC1.toUpperCase().includes(k)) && !looksLikeTeacherName(subC1)) {
        break;
      }
      // Stop if summary row (do NOT add as activity)
      if (isSummaryOrTotalLabel(subC1)) {
        subR++;
        break;
      }

      if (subC1) {
        const hGral = colSubGral !== -1 && colSubGral < subRow.length ? parseHoursCell(subRow[colSubGral]) : 0.0;
        const hSep = colSubSep !== -1 && colSubSep < subRow.length ? parseHoursCell(subRow[colSubSep]) : 0.0;
        const hPie = colSubPie !== -1 && colSubPie < subRow.length ? parseHoursCell(subRow[colSubPie]) : 0.0;
        const totHc = colTotalHc !== -1 && colTotalHc < subRow.length ? parseHoursCell(subRow[colTotalHc]) : 0.0;
        const totHa = colTotalHa !== -1 && colTotalHa < subRow.length ? parseHoursCell(subRow[colTotalHa]) : 0.0;

        let h = hGral + hSep + hPie;
        if (h === 0.0 && totHc > 0.0) h = totHc;
        if (h === 0.0 && totHa > 0.0) h = (totHa * 45.0) / 60.0;

        if (h > 0) {
          subRows.push({ name: subC1, hours: Math.round(h * 100) / 100 });
        }
      }

      subR++;
    }

    if (subRows.length > 0) {
      for (const item of subRows) {
        teachersData.push({
          teacher_name: teacherName,
          rut: teacherRut,
          activity: item.name,
          hours: item.hours,
          total_declared: contratoNum > 0 ? contratoNum : item.hours,
        });
      }
    } else {
      let actName = roleInName;
      if (!actName) {
        if (currentSection.includes('PIE') || (colSubPie !== -1 && colSubPie < row.length && parseHoursCell(row[colSubPie]) > 0)) {
          actName = 'Docente PIE';
        } else if (currentSection.includes('CO DOCENTE')) {
          actName = 'Co-docente';
        } else {
          actName = 'Docencia de Aula';
        }
      }

      let hRow = contratoNum;
      if (hRow === 0.0) {
        const hGral = colSubGral !== -1 && colSubGral < row.length ? parseHoursCell(row[colSubGral]) : 0.0;
        const hSep = colSubSep !== -1 && colSubSep < row.length ? parseHoursCell(row[colSubSep]) : 0.0;
        const hPie = colSubPie !== -1 && colSubPie < row.length ? parseHoursCell(row[colSubPie]) : 0.0;
        hRow = hGral + hSep + hPie;
        if (hRow === 0.0 && colTotalHc !== -1 && colTotalHc < row.length) {
          hRow = parseHoursCell(row[colTotalHc]);
        }
      }

      if (hRow > 0 || contratoNum > 0) {
        const effectiveH = hRow > 0 ? hRow : contratoNum;
        teachersData.push({
          teacher_name: teacherName,
          rut: teacherRut,
          activity: actName,
          hours: Math.round(effectiveH * 100) / 100,
          total_declared: contratoNum > 0 ? contratoNum : effectiveH,
        });
      }
    }

    r = subR;
  }

  return {
    rbd,
    establishment,
    matricula,
    teachers: teachersData,
  };
}
