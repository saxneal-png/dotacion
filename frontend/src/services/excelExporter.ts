import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { SchoolSummary, TeacherRecord } from '../types';

export function exportConsolidatedExcelBrowser(schools: SchoolSummary[], teachers: TeacherRecord[]) {
  const wb = XLSX.utils.book_new();

  // 1. Hoja Consolidado
  const consolidatedHeaders = [
    ['SERVICIO LOCAL DE EDUCACIÓN PÚBLICA (SLEP) - DOTACIÓN DOCENTE'],
    ['CONSOLIDADO DE HORAS DOCENTES: AULA, TÉCNICAS Y DIRECTIVAS'],
    [''],
    [
      'RBD',
      'ESTABLECIMIENTO',
      'MATRÍCULA',
      'HORAS DOCENTES AULA',
      'HORAS DOCENTES DIRECTIVAS',
      'HORAS DOCENTES TÉCNICAS',
      'TOTAL HORAS EE',
    ],
  ];

  const consolidatedRows = schools.map((s) => [
    s.rbd,
    s.establishment,
    s.matricula,
    s.horas_aula,
    s.horas_directivas,
    s.horas_tecnicas,
    s.total_horas_ee,
  ]);

  const totalMatricula = schools.reduce((acc, s) => acc + (s.matricula || 0), 0);
  const totalAula = schools.reduce((acc, s) => acc + (s.horas_aula || 0), 0);
  const totalDirectivas = schools.reduce((acc, s) => acc + (s.horas_directivas || 0), 0);
  const totalTecnicas = schools.reduce((acc, s) => acc + (s.horas_tecnicas || 0), 0);
  const totalHoras = schools.reduce((acc, s) => acc + (s.total_horas_ee || 0), 0);

  const totalRow = [
    'TOTAL GENERAL',
    '',
    totalMatricula,
    Math.round(totalAula * 100) / 100,
    Math.round(totalDirectivas * 100) / 100,
    Math.round(totalTecnicas * 100) / 100,
    Math.round(totalHoras * 100) / 100,
  ];

  const wsConsolidado = XLSX.utils.aoa_to_sheet([
    ...consolidatedHeaders,
    ...consolidatedRows,
    totalRow,
  ]);

  // Ajuste de anchos de columna
  wsConsolidado['!cols'] = [
    { wch: 12 },
    { wch: 45 },
    { wch: 14 },
    { wch: 22 },
    { wch: 26 },
    { wch: 24 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, wsConsolidado, 'CONSOLIDADO SLEP');

  // 2. Hoja Auditoría Detallada
  const auditHeaders = [
    [
      'RBD',
      'ESTABLECIMIENTO',
      'DOCENTE',
      'RUT',
      'ACTIVIDAD / ASIGNATURA',
      'HORAS',
      'CATEGORÍA',
      'ORIGEN CLASIFICACIÓN',
    ],
  ];

  const auditRows = teachers.map((t) => [
    t.rbd,
    t.establishment,
    t.teacher_name,
    t.rut,
    t.activity,
    t.hours,
    t.category,
    t.source,
  ]);

  const wsAuditoria = XLSX.utils.aoa_to_sheet([...auditHeaders, ...auditRows]);
  wsAuditoria['!cols'] = [
    { wch: 12 },
    { wch: 35 },
    { wch: 30 },
    { wch: 15 },
    { wch: 35 },
    { wch: 12 },
    { wch: 15 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, wsAuditoria, 'AUDITORÍA DETALLADA');

  // Generar buffer y descargar archivo
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'consolidado_horas_aula_tecnicas_directivas.xlsx');
}

export function exportCsvBrowser(schools: SchoolSummary[]) {
  const headers = ['RBD', 'ESTABLECIMIENTO', 'MATRICULA', 'HORAS_AULA', 'HORAS_DIRECTIVAS', 'HORAS_TECNICAS', 'TOTAL_HORAS_EE'];
  const rows = schools.map((s) => [
    s.rbd,
    s.establishment,
    s.matricula,
    s.horas_aula,
    s.horas_directivas,
    s.horas_tecnicas,
    s.total_horas_ee,
  ]);

  const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, 'consolidado_dotacion_slep.csv');
}
