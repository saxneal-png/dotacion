import React, { useState } from 'react';
import { Search, BookOpen, Wrench, Shield, Edit2, Sparkles } from 'lucide-react';
import type { TeacherRecord, SchoolSummary } from '../types';

interface TeacherDetailTableProps {
  teachers: TeacherRecord[];
  schools: SchoolSummary[];
  selectedRbd: string;
  onSelectRbd: (rbd: string) => void;
  onReclassify: (teacherIndex: number, newCategory: string) => Promise<void>;
}

export const TeacherDetailTable: React.FC<TeacherDetailTableProps> = ({
  teachers,
  schools,
  selectedRbd,
  onSelectRbd,
  onReclassify,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const filteredTeachers = teachers.filter((t) => {
    if (selectedRbd && selectedRbd !== 'ALL' && t.rbd !== selectedRbd) {
      return false;
    }
    if (categoryFilter !== 'ALL' && t.category !== categoryFilter) {
      return false;
    }
    const matchText = `${t.teacher_name} ${t.rut} ${t.activity} ${t.establishment}`.toLowerCase();
    return matchText.includes(searchTerm.toLowerCase());
  });

  const handleCategoryChange = async (originalIdx: number, newCat: string) => {
    setEditingIndex(null);
    await onReclassify(originalIdx, newCat);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Filter toolbar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* School Selector */}
          <div className="relative">
            <select
              value={selectedRbd}
              onChange={(e) => onSelectRbd(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 max-w-xs truncate"
            >
              <option value="ALL">Todos los Establecimientos ({schools.length})</option>
              {schools.map((s) => (
                <option key={s.rbd} value={s.rbd}>
                  {s.establishment} (RBD: {s.rbd})
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-1 bg-white p-0.5 rounded-lg border border-slate-300 text-xs">
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                categoryFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todos ({teachers.length})
            </button>
            <button
              onClick={() => setCategoryFilter('AULA')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                categoryFilter === 'AULA' ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              Aula
            </button>
            <button
              onClick={() => setCategoryFilter('TECNICA')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                categoryFilter === 'TECNICA' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              Técnica
            </button>
            <button
              onClick={() => setCategoryFilter('DIRECTIVA')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                categoryFilter === 'DIRECTIVA' ? 'bg-purple-600 text-white' : 'text-purple-700 hover:bg-purple-50'
              }`}
            >
              Directiva
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar docente, RUT o asignatura..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Teachers Detail Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-800 text-white uppercase text-[11px] font-bold tracking-wider">
            <tr>
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4">DOCENTE / RUT</th>
              <th className="py-3 px-4">ESTABLECIMIENTO</th>
              <th className="py-3 px-4">ACTIVIDAD / FUNCIÓN</th>
              <th className="py-3 px-4 text-right w-20">HORAS</th>
              <th className="py-3 px-4 text-center w-32">CLASIFICACIÓN</th>
              <th className="py-3 px-4 text-left w-48">ORIGEN MOTOR</th>
              <th className="py-3 px-4 text-center w-24">ACCIÓN</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTeachers.map((t, idx) => {
              const originalIndex = teachers.findIndex((item) => item.id === t.id);
              const isEditing = editingIndex === originalIndex;

              return (
                <tr key={t.id || idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[11px]">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">
                    <div>{t.teacher_name}</div>
                    {t.rut && <div className="text-[11px] font-mono text-slate-400">{t.rut}</div>}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">
                    <span className="font-medium text-slate-700">{t.establishment}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">RBD: {t.rbd}</span>
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">
                    {t.activity}
                  </td>
                  <td className="py-2.5 px-4 text-right font-black text-slate-800 text-sm">
                    {t.hours.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleCategoryChange(originalIndex, 'AULA')}
                          className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Aula
                        </button>
                        <button
                          onClick={() => handleCategoryChange(originalIndex, 'TECNICA')}
                          className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Técnica
                        </button>
                        <button
                          onClick={() => handleCategoryChange(originalIndex, 'DIRECTIVA')}
                          className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-600 text-white hover:bg-purple-700"
                        >
                          Directiva
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          t.category === 'AULA'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : t.category === 'TECNICA'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {t.category === 'AULA' && <BookOpen className="w-3 h-3" />}
                        {t.category === 'TECNICA' && <Wrench className="w-3 h-3" />}
                        {t.category === 'DIRECTIVA' && <Shield className="w-3 h-3" />}
                        <span>{t.category}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-[11px] text-slate-500">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                        t.source.includes('Gemini')
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : t.source.includes('Manual')
                          ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {t.source.includes('Gemini') && <Sparkles className="w-2.5 h-2.5 inline mr-1 text-amber-600" />}
                      {t.source}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <button
                      onClick={() => setEditingIndex(isEditing ? null : originalIndex)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                      title="Modificar clasificación"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
        <span>Mostrando {filteredTeachers.length} de {teachers.length} registros docentes</span>
        <span className="text-[11px] text-slate-400">
          * Puedes hacer clic en el lápiz para reclasificar manualmente cualquier actividad si es necesario.
        </span>
      </div>
    </div>
  );
};
