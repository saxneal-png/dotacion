import { parseExcelBrowser } from './excelParser';
import { classifyActivitiesHybrid } from './classifier';
import type { SchoolSummary, TeacherRecord, KpiStats, ConsolidatedResponse } from '../types';

export async function processDotacionFilesClient(
  files: File[],
  apiKey: string,
  modelName: string,
  customPrompt?: string
): Promise<ConsolidatedResponse> {
  const allTeachers: TeacherRecord[] = [];
  const schoolsMap = new Map<string, SchoolSummary>();
  const processedFiles: string[] = [];

  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const file = files[fileIdx];
    processedFiles.push(file.name);

    try {
      const parsed = await parseExcelBrowser(file);
      const uniqueActivities = Array.from(new Set(parsed.teachers.map((t) => t.activity.trim()))).filter(Boolean);

      // Clasificación híbrida (Diccionario chileno + Gemini AI)
      const classification = await classifyActivitiesHybrid(
        uniqueActivities,
        apiKey,
        modelName,
        customPrompt
      );

      let schoolAula = 0;
      let schoolDirectiva = 0;
      let schoolTecnica = 0;
      const teacherNames = new Set<string>();

      parsed.teachers.forEach((t, itemIdx) => {
        teacherNames.add(t.teacher_name);
        const classResult = classification[t.activity.trim()] || {
          category: 'AULA',
          source: 'Regla por Defecto (Atención Alumnos)',
          confidence: 0.7,
        };

        const cat = (classResult.category as 'AULA' | 'TECNICA' | 'DIRECTIVA') || 'AULA';
        const hours = Math.round(t.hours * 100) / 100;

        if (cat === 'AULA') schoolAula += hours;
        else if (cat === 'DIRECTIVA') schoolDirectiva += hours;
        else if (cat === 'TECNICA') schoolTecnica += hours;

        allTeachers.push({
          id: `${parsed.rbd}-${fileIdx}-${itemIdx}`,
          file_name: file.name,
          rbd: parsed.rbd,
          establishment: parsed.establishment,
          rut: t.rut,
          teacher_name: t.teacher_name,
          activity: t.activity,
          hours: hours,
          category: cat,
          source: classResult.source,
          total_declared: t.total_declared,
        });
      });

      const totalEE = Math.round((schoolAula + schoolDirectiva + schoolTecnica) * 100) / 100;

      // Validación de cuadratura
      let hasDiscrepancy = false;
      let discrepancyNote = '';

      // Comparar con horas contractuales totales declaradas si existen
      const declaredSum = parsed.teachers.reduce((acc, t) => acc + (t.total_declared || 0), 0);
      if (declaredSum > 0 && Math.abs(declaredSum - totalEE) > 1.0) {
        hasDiscrepancy = true;
        discrepancyNote = `Descuadre: Suma calculada (${totalEE}h) vs Contrato (${Math.round(declaredSum)}h)`;
      }

      const schoolKey = parsed.rbd || file.name;
      schoolsMap.set(schoolKey, {
        rbd: parsed.rbd,
        establishment: parsed.establishment,
        matricula: parsed.matricula,
        horas_aula: Math.round(schoolAula * 100) / 100,
        horas_directivas: Math.round(schoolDirectiva * 100) / 100,
        horas_tecnicas: Math.round(schoolTecnica * 100) / 100,
        total_horas_ee: totalEE,
        teachers_count: teacherNames.size,
        has_discrepancy: hasDiscrepancy,
        discrepancy_note: discrepancyNote,
        source_file: file.name,
      });
    } catch (err) {
      console.error(`Error procesando archivo ${file.name}:`, err);
    }
  }

  const schools = Array.from(schoolsMap.values());

  // Calcular KPIs
  const totalSchools = schools.length;
  const totalTeachersSet = new Set(allTeachers.map((t) => t.teacher_name || t.rut));
  const totalTeachers = totalTeachersSet.size;
  const totalMatricula = schools.reduce((acc, s) => acc + (s.matricula || 0), 0);
  const totalAula = Math.round(schools.reduce((acc, s) => acc + s.horas_aula, 0) * 100) / 100;
  const totalDirectivas = Math.round(schools.reduce((acc, s) => acc + s.horas_directivas, 0) * 100) / 100;
  const totalTecnicas = Math.round(schools.reduce((acc, s) => acc + s.horas_tecnicas, 0) * 100) / 100;
  const totalGeneral = Math.round((totalAula + totalDirectivas + totalTecnicas) * 100) / 100;

  const pctAula = totalGeneral > 0 ? Math.round((totalAula / totalGeneral) * 1000) / 10 : 0;
  const pctDirectivas = totalGeneral > 0 ? Math.round((totalDirectivas / totalGeneral) * 1000) / 10 : 0;
  const pctTecnicas = totalGeneral > 0 ? Math.round((totalTecnicas / totalGeneral) * 1000) / 10 : 0;
  const discrepanciesCount = schools.filter((s) => s.has_discrepancy).length;

  const kpis: KpiStats = {
    total_schools: totalSchools,
    total_teachers: totalTeachers,
    total_matricula: totalMatricula,
    total_horas_general: totalGeneral,
    total_horas_aula: totalAula,
    total_horas_directivas: totalDirectivas,
    total_horas_tecnicas: totalTecnicas,
    pct_aula: pctAula,
    pct_directivas: pctDirectivas,
    pct_tecnicas: pctTecnicas,
    discrepancies_count: discrepanciesCount,
  };

  return {
    schools,
    teachers: allTeachers,
    kpis,
    processed_files: processedFiles,
  };
}

export function recalculateSchoolTotals(teachers: TeacherRecord[], currentSchools: SchoolSummary[]): {
  schools: SchoolSummary[];
  kpis: KpiStats;
} {
  const updatedSchools = currentSchools.map((school) => {
    const schoolTeachers = teachers.filter((t) => t.rbd === school.rbd || t.establishment === school.establishment);

    let aula = 0;
    let directiva = 0;
    let tecnica = 0;
    const teacherNames = new Set<string>();

    schoolTeachers.forEach((t) => {
      teacherNames.add(t.teacher_name);
      if (t.category === 'AULA') aula += t.hours;
      else if (t.category === 'DIRECTIVA') directiva += t.hours;
      else if (t.category === 'TECNICA') tecnica += t.hours;
    });

    const totalEE = Math.round((aula + directiva + tecnica) * 100) / 100;

    return {
      ...school,
      horas_aula: Math.round(aula * 100) / 100,
      horas_directivas: Math.round(directiva * 100) / 100,
      horas_tecnicas: Math.round(tecnica * 100) / 100,
      total_horas_ee: totalEE,
      teachers_count: teacherNames.size,
    };
  });

  const totalAula = Math.round(updatedSchools.reduce((acc, s) => acc + s.horas_aula, 0) * 100) / 100;
  const totalDirectivas = Math.round(updatedSchools.reduce((acc, s) => acc + s.horas_directivas, 0) * 100) / 100;
  const totalTecnicas = Math.round(updatedSchools.reduce((acc, s) => acc + s.horas_tecnicas, 0) * 100) / 100;
  const totalGeneral = Math.round((totalAula + totalDirectivas + totalTecnicas) * 100) / 100;

  const pctAula = totalGeneral > 0 ? Math.round((totalAula / totalGeneral) * 1000) / 10 : 0;
  const pctDirectivas = totalGeneral > 0 ? Math.round((totalDirectivas / totalGeneral) * 1000) / 10 : 0;
  const pctTecnicas = totalGeneral > 0 ? Math.round((totalTecnicas / totalGeneral) * 1000) / 10 : 0;

  const kpis: KpiStats = {
    total_schools: updatedSchools.length,
    total_teachers: new Set(teachers.map((t) => t.teacher_name || t.rut)).size,
    total_matricula: updatedSchools.reduce((acc, s) => acc + (s.matricula || 0), 0),
    total_horas_general: totalGeneral,
    total_horas_aula: totalAula,
    total_horas_directivas: totalDirectivas,
    total_horas_tecnicas: totalTecnicas,
    pct_aula: pctAula,
    pct_directivas: pctDirectivas,
    pct_tecnicas: pctTecnicas,
    discrepancies_count: updatedSchools.filter((s) => s.has_discrepancy).length,
  };

  return { schools: updatedSchools, kpis };
}
