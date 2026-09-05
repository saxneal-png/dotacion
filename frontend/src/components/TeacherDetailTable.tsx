import React, { useState } from 'react';
import { Search, BookOpen, Wrench, Shield, Edit2, Sparkles, CheckSquare, Square, ChevronDown } from 'lucide-react';
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const filteredTeachers = teachers.filter((t) => {
    if (selectedRbd && selectedRbd !== 'ALL' && t.rbd !== selectedRbd) return false;
    if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
    const matchText = `${t.teacher_name} ${t.rut} ${t.activity} ${t.establishment}`.toLowerCase();
    return matchText.includes(searchTerm.toLowerCase());
  });

  const handleCategoryChange = async (originalIdx: number, newCat: string) => {
    setEditingIndex(null);
    await onReclassify(originalIdx, newCat);
  };

  const allFilteredIds = filteredTeachers.map((t, idx) => t.id || String(idx));
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const someSelected = allFilteredIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleBulkReclassify = async (newCategory: string) => {
    setBulkLoading(true);
    try {
      const tasks: Array<{ originalIndex: number }> = [];
      filteredTeachers.forEach((t, idx) => {
        const id = t.id || String(idx);
        if (selectedIds.has(id)) {
          // Use object reference to reliably find the original index
          // (findIndex by id fails when multiple teachers have undefined ids)
          const originalIndex = teachers.indexOf(t);
          if (originalIndex >= 0) tasks.push({ originalIndex });
        }
      });
      for (const task of tasks) {
        await onReclassify(task.originalIndex, newCategory);
      }
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  const selectedCount = allFilteredIds.filter((id) => selectedIds.has(id)).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Filter toolbar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative">
            <select
              value={selectedRbd}
              onChange={(e) => onSelectRbd(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 max-w-xs truncate"
            >
              <option value="ALL">Todos los Establecimientos ({schools.length})</option>
              {schools.map((s) => (
                <option key={s.rbd} value={s.rbd}>{s.establishment} (RBD: {s.rbd})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-1 bg-white p-0.5 rounded-lg border border-slate-300 text-xs">
            <button onClick={() => setCategoryFilter('ALL')} className={`px-2.5 py-1 rounded-md font-medium transition-colors ${categoryFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Todos ({teachers.length})</button>
            <button onClick={() => setCategoryFilter('AULA')} className={`px-2.5 py-1 rounded-md font-medium transition-colors ${categoryFilter === 'AULA' ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-50'}`}>Aula</button>
            <button onClick={() => setCategoryFilter('TECNICA')} className={`px-2.5 py-1 rounded-md font-medium transition-colors ${categoryFilter === 'TECNICA' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'}`}>Técnica</button>
            <button onClick={() => setCategoryFilter('DIRECTIVA')} className={`px-2.5 py-1 rounded-md font-medium transition-colors ${categoryFilter === 'DIRECTIVA' ? 'bg-purple-600 text-white' : 'text-purple-700 hover:bg-purple-50'}`}>Directiva</button>
          </div>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input type="text" placeholder="Buscar docente, RUT o asignatura..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-b border-indigo-200">
          <span className="text-xs font-bold text-indigo-800">{selectedCount} fila{selectedCount !== 1 ? 's' : ''} seleccionada{selectedCount !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-indigo-600 font-medium mr-1">Mover a:</span>
            <button disabled={bulkLoading} onClick={() => handleBulkReclassify('AULA')} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"><BookOpen className="w-3 h-3" /> Aula</button>
            <button disabled={bulkLoading} onClick={() => handleBulkReclassify('TECNICA')} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"><Wrench className="w-3 h-3" /> Técnica</button>
            <button disabled={bulkLoading} onClick={() => handleBulkReclassify('DIRECTIVA')} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"><Shield className="w-3 h-3" /> Directiva</button>
            <button onClick={() => setSelectedIds(new Set())} className="ml-2 px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-800 text-white uppercase text-[11px] font-bold tracking-wider">
            <tr>
              <th className="py-3 px-3 w-9 text-center">
                <button onClick={toggleSelectAll} className="flex items-center justify-center text-white/80 hover:text-white transition-colors" title={allSelected ? 'Deseleccionar todo' : 'Seleccionar todos'}>
                  {allSelected ? <CheckSquare className="w-4 h-4" /> : someSelected ? <ChevronDown className="w-4 h-4 opacity-60" /> : <Square className="w-4 h-4" />}
                </button>
              </th>
              <th className="py-3 px-2 w-10 text-center">#</th>
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
              const rowId = t.id || String(idx);
              const originalIndex = teachers.indexOf(t);
              const isEditing = editingIndex === originalIndex;
              const isSelected = selectedIds.has(rowId);
              return (
                <tr key={t.id || idx} className={`transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-slate-50/80'}`} onClick={() => toggleSelectRow(rowId)}>
                  <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => toggleSelectRow(rowId)} className={`flex items-center justify-center transition-colors ${isSelected ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}>
                      {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">
                    <div>{t.teacher_name}</div>
                    {t.rut && <div className="text-[11px] font-mono text-slate-400">{t.rut}</div>}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">
                    <span className="font-medium text-slate-700">{t.establishment}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">RBD: {t.rbd}</span>
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{t.activity}</td>
                  <td className="py-2.5 px-4 text-right">
                    <span className={`font-black text-sm ${t.is_over_legal_limit ? 'text-amber-800' : 'text-slate-800'}`}>{t.hours.toFixed(1)}</span>
                    {t.is_over_legal_limit && (
                      <span title={t.legal_limit_warning || `Supera el tope legal de 44 hrs (Docente registra ${t.total_teacher_hours}h)`} className="block text-[10px] text-amber-900 font-bold bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5 mt-0.5 text-center cursor-help">
                        ⚠️ &gt;44h ({t.total_teacher_hours?.toFixed(1) || t.hours.toFixed(1)}h)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    {isEditing ? (
                      <div className="flex items-center justify-center space-x-1">
                        <button onClick={() => handleCategoryChange(originalIndex, 'AULA')} className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-600 text-white hover:bg-blue-700">Aula</button>
                        <button onClick={() => handleCategoryChange(originalIndex, 'TECNICA')} className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700">Técnica</button>
                        <button onClick={() => handleCategoryChange(originalIndex, 'DIRECTIVA')} className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-600 text-white hover:bg-purple-700">Directiva</button>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${t.category === 'AULA' ? 'bg-blue-100 text-blue-800 border border-blue-200' : t.category === 'TECNICA' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-purple-100 text-purple-800 border border-purple-200'}`}>
                        {t.category === 'AULA' && <BookOpen className="w-3 h-3" />}
                        {t.category === 'TECNICA' && <Wrench className="w-3 h-3" />}
                        {t.category === 'DIRECTIVA' && <Shield className="w-3 h-3" />}
                        <span>{t.category}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-[11px] text-slate-500">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${t.source.includes('Gemini') ? 'bg-amber-100 text-amber-900 border border-amber-200' : t.source.includes('Manual') ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' : 'bg-slate-100 text-slate-700'}`}>
                      {t.source.includes('Gemini') && <Sparkles className="w-2.5 h-2.5 inline mr-1 text-amber-600" />}
                      {t.source}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setEditingIndex(isEditing ? null : originalIndex)} className="p-1 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors" title="Modificar clasificación">
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
        <span>
          Mostrando {filteredTeachers.length} de {teachers.length} registros docentes
          {selectedCount > 0 && <span className="ml-2 text-indigo-600 font-semibold">· {selectedCount} seleccionada{selectedCount !== 1 ? 's' : ''}</span>}
        </span>
        <span className="text-[11px] text-slate-400">* Clic en una fila para seleccionarla o usa el lápiz para editar individualmente.</span>
      </div>
    </div>
  );
};
