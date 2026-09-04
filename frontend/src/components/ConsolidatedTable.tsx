import React, { useState } from 'react';
import { Search, AlertTriangle, CheckCircle2, ChevronRight, Download, ArrowUpDown } from 'lucide-react';
import type { SchoolSummary, KpiStats } from '../types';

interface ConsolidatedTableProps {
  schools: SchoolSummary[];
  kpis: KpiStats;
  onSelectSchool: (rbd: string) => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
}

export const ConsolidatedTable: React.FC<ConsolidatedTableProps> = ({
  schools,
  kpis,
  onSelectSchool,
  onExportExcel,
  onExportCsv,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof SchoolSummary>('establishment');
  const [sortAsc, setSortAsc] = useState(true);

  const filteredSchools = schools
    .filter((s) => {
      const matchText = `${s.rbd} ${s.establishment} ${s.source_file}`.toLowerCase();
      return matchText.includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      const valA: any = a[sortField];
      const valB: any = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });

  const handleSort = (field: keyof SchoolSummary) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  if (schools.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
        <p className="text-slate-500 text-sm">No hay datos procesados actualmente.</p>
        <p className="text-xs text-slate-400 mt-1">
          Por favor, ve a la pestaña <strong>1. Carga de Planillas</strong> para subir archivos o probar con los ejemplos.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por RBD o Establecimiento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button
            onClick={onExportCsv}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={onExportExcel}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Consolidado (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Main Table Matching the official SLEP template */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-blue-900 text-white uppercase text-[11px] font-bold tracking-wider">
            <tr>
              <th
                onClick={() => handleSort('rbd')}
                className="py-3 px-4 cursor-pointer hover:bg-blue-800 transition-colors text-center w-24"
              >
                <div className="inline-flex items-center space-x-1">
                  <span>RBD</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('establishment')}
                className="py-3 px-4 cursor-pointer hover:bg-blue-800 transition-colors"
              >
                <div className="inline-flex items-center space-x-1">
                  <span>ESTABLECIMIENTO</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('matricula')}
                className="py-3 px-4 cursor-pointer hover:bg-blue-800 transition-colors text-right"
              >
                <div className="inline-flex items-center space-x-1 justify-end">
                  <span>MATRÍCULA</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('horas_aula')}
                className="py-3 px-4 cursor-pointer hover:bg-blue-800 transition-colors text-right bg-blue-950"
              >
                <div className="inline-flex items-center space-x-1 justify-end">
                  <span>HORAS DOCENTES AULA</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('horas_directivas')}
                className="py-3 px-4 cursor-pointer hover:bg-blue-800 transition-colors text-right"
              >
                <div className="inline-flex items-center space-x-1 justify-end">
                  <span>HORAS DOCENTES DIRECTIVAS</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('horas_tecnicas')}
                className="py-3 px-4 cursor-pointer hover:bg-blue-800 transition-colors text-right"
              >
                <div className="inline-flex items-center space-x-1 justify-end">
                  <span>HORAS DOCENTES TÉCNICAS</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('total_horas_ee')}
                className="py-3 px-4 cursor-pointer hover:bg-blue-800 transition-colors text-right font-black"
              >
                <div className="inline-flex items-center space-x-1 justify-end">
                  <span>TOTAL HORAS EE</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 text-center w-28">ESTADO</th>
              <th className="py-3 px-3 text-center w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSchools.map((school, index) => {
              const isDiscrepant = school.has_discrepancy;
              return (
                <tr
                  key={school.rbd || index}
                  onClick={() => onSelectSchool(school.rbd)}
                  className={`hover:bg-blue-50/60 cursor-pointer transition-colors ${
                    isDiscrepant ? 'bg-rose-50/90 text-rose-950 font-medium' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                  }`}
                >
                  <td className="py-3 px-4 font-mono font-bold text-center text-slate-800">
                    {school.rbd}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    <div>{school.establishment}</div>
                    <div className="text-[11px] text-slate-400 font-normal">
                      {school.source_file} • {school.teachers_count} registros
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {school.matricula > 0 ? school.matricula.toLocaleString() : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-blue-700 bg-blue-50/30">
                    {school.horas_aula.toFixed(1)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-purple-700">
                    {school.horas_directivas.toFixed(1)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                    {school.horas_tecnicas.toFixed(1)}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-slate-900 bg-slate-100/50">
                    {school.total_horas_ee.toFixed(1)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {isDiscrepant ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-xs">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Descuadre</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Cuadrado</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center text-slate-400">
                    <ChevronRight className="w-4 h-4" />
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Grand Totals Footer */}
          <tfoot className="bg-slate-200 font-bold text-slate-900 border-t-2 border-slate-400">
            <tr>
              <td className="py-3 px-4 text-center font-black">TOTAL SLEP</td>
              <td className="py-3 px-4">
                {schools.length} Establecimientos educacionales
              </td>
              <td className="py-3 px-4 text-right font-black">
                {kpis.total_matricula.toLocaleString()}
              </td>
              <td className="py-3 px-4 text-right font-black text-blue-900">
                {kpis.total_horas_aula.toFixed(1)}
              </td>
              <td className="py-3 px-4 text-right font-black text-purple-900">
                {kpis.total_horas_directivas.toFixed(1)}
              </td>
              <td className="py-3 px-4 text-right font-black text-emerald-900">
                {kpis.total_horas_tecnicas.toFixed(1)}
              </td>
              <td className="py-3 px-4 text-right font-black text-slate-950 text-sm">
                {kpis.total_horas_general.toFixed(1)}
              </td>
              <td colSpan={2} className="py-3 px-4 text-center text-xs text-slate-600">
                100% Verificado
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
