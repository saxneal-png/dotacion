import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ApiKeyModal } from './components/ApiKeyModal';
import { PromptModal } from './components/PromptModal';
import { FileUpload } from './components/FileUpload';
import { KpiCards } from './components/KpiCards';
import { ConsolidatedTable } from './components/ConsolidatedTable';
import { TeacherDetailTable } from './components/TeacherDetailTable';
import { AuditAndExport } from './components/AuditAndExport';
import type { SchoolSummary, TeacherRecord, KpiStats, ConsolidatedResponse, GeminiModel } from './types';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { processDotacionFilesClient, recalculateSchoolTotals } from './services/dotacionProcessor';
import { exportConsolidatedExcelBrowser, exportCsvBrowser } from './services/excelExporter';

const FALLBACK_MODELS: GeminiModel[] = [
  {
    id: "gemini-3.8-flash",
    display_name: "Gemini 3.8 Flash",
    description: "Modelo de última generación. Velocidad extrema, alta precisión y optimizado para clasificación masiva.",
    badge: "Nueva Generación",
    is_recommended: true,
  },
  {
    id: "gemini-3.8-pro",
    display_name: "Gemini 3.8 Pro",
    description: "Máxima capacidad multimodal y razonamiento de última generación.",
    badge: "Alta Precisión",
    is_recommended: false,
  },
  {
    id: "gemini-3.7-flash",
    display_name: "Gemini 3.7 Flash",
    description: "Modelo híbrido de razonamiento ágil y procesamiento textual ultrarrápido.",
    badge: "Recomendado",
    is_recommended: true,
  },
  {
    id: "gemini-3.7-pro",
    display_name: "Gemini 3.7 Pro",
    description: "Razonamiento profundo para análisis y extracción de entidades complejas.",
    badge: "Alta Precisión",
    is_recommended: false,
  },
  {
    id: "gemini-3.6-flash",
    display_name: "Gemini 3.6 Flash",
    description: "Alta velocidad y exactitud para clasificación de texto pedagógico.",
    badge: "Rápido",
    is_recommended: false,
  },
  {
    id: "gemini-2.5-flash",
    display_name: "Gemini 2.5 Flash",
    description: "Modelo consolidado, rápido, económico y óptimo para planillas escolares.",
    badge: "Estable",
    is_recommended: false,
  },
  {
    id: "gemini-2.5-pro",
    display_name: "Gemini 2.5 Pro",
    description: "Capacidad avanzada de razonamiento y análisis contextual profundo.",
    badge: "Alta Precisión",
    is_recommended: false,
  },
  {
    id: "gemini-2.0-flash",
    display_name: "Gemini 2.0 Flash",
    description: "Alta velocidad y excelente precisión para procesamiento de texto escolar.",
    badge: "Rápido",
    is_recommended: false,
  },
  {
    id: "gemini-2.0-flash-lite",
    display_name: "Gemini 2.0 Flash Lite",
    description: "Modelo ultra ligero diseñado para máxima eficiencia y bajo consumo de cuota.",
    badge: "Económico",
    is_recommended: false,
  },
  {
    id: "gemini-1.5-flash",
    display_name: "Gemini 1.5 Flash",
    description: "Modelo clásico de alta estabilidad para tareas rápidas.",
    badge: "Clásico",
    is_recommended: false,
  },
  {
    id: "gemini-1.5-pro",
    display_name: "Gemini 1.5 Pro",
    description: "Modelo clásico avanzado para análisis exhaustivo.",
    badge: "Pro",
    is_recommended: false,
  }
];

export function App() {
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('gemini_model') || 'gemini-3.7-flash');
  const [models, setModels] = useState<GeminiModel[]>(() => {
    try {
      const saved = localStorage.getItem('gemini_models');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return FALLBACK_MODELS;
  });
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [schools, setSchools] = useState<SchoolSummary[]>(() => {
    try {
      const saved = localStorage.getItem('dotacion_schools');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [teachers, setTeachers] = useState<TeacherRecord[]>(() => {
    try {
      const saved = localStorage.getItem('dotacion_teachers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [kpis, setKpis] = useState<KpiStats>(() => {
    try {
      const saved = localStorage.getItem('dotacion_kpis');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      total_schools: 0,
      total_teachers: 0,
      total_matricula: 0,
      total_horas_general: 0,
      total_horas_aula: 0,
      total_horas_directivas: 0,
      total_horas_tecnicas: 0,
      pct_aula: 0,
      pct_directivas: 0,
      pct_tecnicas: 0,
      discrepancies_count: 0,
    };
  });

  const [selectedRbd, setSelectedRbd] = useState<string>('ALL');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    showToast('Clave de Gemini guardada correctamente.');
  };

  const handleSelectModel = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('gemini_model', model);
    showToast(`Modelo de IA seleccionado: ${model}`);
  };

  const handleUpdateModels = (newModels: GeminiModel[]) => {
    setModels(newModels);
    try {
      localStorage.setItem('gemini_models', JSON.stringify(newModels));
    } catch (e) {}
  };

  useEffect(() => {
    const fetchInitial = async () => {
      // Intentar sincronizar con backend si está disponible y el cliente no tiene datos
      if (schools.length === 0) {
        try {
          const res = await fetch('/api/consolidated');
          if (res.ok) {
            const data: ConsolidatedResponse = await res.json();
            if (data.schools.length > 0) {
              setSchools(data.schools);
              setTeachers(data.teachers);
              setKpis(data.kpis);
              localStorage.setItem('dotacion_schools', JSON.stringify(data.schools));
              localStorage.setItem('dotacion_teachers', JSON.stringify(data.teachers));
              localStorage.setItem('dotacion_kpis', JSON.stringify(data.kpis));
              setActiveTab('consolidated');
            }
          }
        } catch (e) {}
      }

      try {
        const resModel = await fetch('/api/model');
        if (resModel.ok) {
          const mData = await resModel.json();
          if (mData.selected_model) {
            setSelectedModel((prev) => prev || mData.selected_model);
          }
        }
      } catch (e) {}

      // Si tenemos clave, mapear modelos silenciosamente
      if (apiKey && apiKey.length >= 10 && models.length === FALLBACK_MODELS.length) {
        try {
          const googleRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          if (googleRes.ok) {
            const gData = await googleRes.json();
            if (gData.models && Array.isArray(gData.models)) {
              const mapped = gData.models
                .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                .map((m: any) => {
                  const id = m.name.replace('models/', '');
                  return {
                    id,
                    display_name: m.displayName || id,
                    description: m.description || 'Modelo Gemini',
                    badge: id.includes('flash') ? 'Rápido' : id.includes('pro') ? 'Precisión' : undefined,
                    is_recommended: id.includes('flash'),
                  };
                });
              if (mapped.length > 0) handleUpdateModels(mapped);
            }
          }
        } catch (e) {}
      }
    };
    fetchInitial();
  }, []);

  const handleProcessFiles = async (files: File[]) => {
    setLoading(true);
    try {
      const customPrompt = localStorage.getItem('gemini_custom_prompt') || undefined;

      // 1. Procesamiento en el navegador (100% independiente, funciona en GitHub Pages)
      const clientResult = await processDotacionFilesClient(files, apiKey, selectedModel, customPrompt);

      setSchools(clientResult.schools);
      setTeachers(clientResult.teachers);
      setKpis(clientResult.kpis);

      try {
        localStorage.setItem('dotacion_schools', JSON.stringify(clientResult.schools));
        localStorage.setItem('dotacion_teachers', JSON.stringify(clientResult.teachers));
        localStorage.setItem('dotacion_kpis', JSON.stringify(clientResult.kpis));
      } catch {}

      // 2. Envío silencioso al backend si está disponible (para auditoría o persistencia en servidor local)
      try {
        const formData = new FormData();
        files.forEach((f) => formData.append('files', f));
        if (apiKey) formData.append('gemini_api_key', apiKey);
        if (selectedModel) formData.append('gemini_model', selectedModel);
        fetch('/api/upload', { method: 'POST', body: formData }).catch(() => {});
      } catch {}

      setActiveTab('consolidated');
      showToast(`¡Se procesaron exitosamente ${clientResult.schools.length} establecimientos en tu navegador!`);
    } catch (err: any) {
      showToast(err.message || 'Error al procesar los archivos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('¿Estás seguro de que deseas limpiar todos los datos y reiniciar el análisis?')) {
      return;
    }
    setLoading(true);
    try {
      setSchools([]);
      setTeachers([]);
      setKpis({
        total_schools: 0,
        total_teachers: 0,
        total_matricula: 0,
        total_horas_general: 0,
        total_horas_aula: 0,
        total_horas_directivas: 0,
        total_horas_tecnicas: 0,
        pct_aula: 0,
        pct_directivas: 0,
        pct_tecnicas: 0,
        discrepancies_count: 0,
      });

      localStorage.removeItem('dotacion_schools');
      localStorage.removeItem('dotacion_teachers');
      localStorage.removeItem('dotacion_kpis');

      try {
        await fetch('/api/clear', { method: 'POST' });
      } catch {}

      setActiveTab('upload');
      showToast('Datos limpiados. Listo para un nuevo análisis.');
    } catch (err: any) {
      showToast('Error al limpiar datos: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReclassify = async (teacherIndex: number, newCategory: string) => {
    try {
      const updated = [...teachers];
      if (updated[teacherIndex]) {
        updated[teacherIndex] = {
          ...updated[teacherIndex],
          category: newCategory as 'AULA' | 'TECNICA' | 'DIRECTIVA',
          source: 'Ajuste Manual de Usuario',
        };

        const recalculated = recalculateSchoolTotals(updated, schools);
        setTeachers(updated);
        setSchools(recalculated.schools);
        setKpis(recalculated.kpis);

        try {
          localStorage.setItem('dotacion_teachers', JSON.stringify(updated));
          localStorage.setItem('dotacion_schools', JSON.stringify(recalculated.schools));
          localStorage.setItem('dotacion_kpis', JSON.stringify(recalculated.kpis));
        } catch {}

        try {
          fetch('/api/reclassify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              teacher_index: teacherIndex,
              new_category: newCategory,
              reason: 'Ajuste manual de usuario',
            }),
          }).catch(() => {});
        } catch {}

        showToast('Actividad reclasificada y totales actualizados.');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleExportExcel = () => {
    if (schools.length === 0) {
      showToast('No hay datos procesados para exportar.', 'error');
      return;
    }
    exportConsolidatedExcelBrowser(schools, teachers);
    showToast('¡Descarga de Excel consolidado completada!');
  };

  const handleExportCsv = () => {
    if (schools.length === 0) {
      showToast('No hay datos procesados para exportar.', 'error');
      return;
    }
    exportCsvBrowser(schools);
    showToast('¡Descarga de CSV completada!');
  };

  const handleSelectSchool = (rbd: string) => {
    setSelectedRbd(rbd);
    setActiveTab('teachers');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        geminiKey={apiKey}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        models={models}
        openKeyModal={() => setIsKeyModalOpen(true)}
        openPromptModal={() => setIsPromptModalOpen(true)}
        onClearData={handleClearData}
        schoolsCount={schools.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {schools.length > 0 && <KpiCards kpis={kpis} />}

        {activeTab === 'upload' && (
          <FileUpload
            onProcessFiles={handleProcessFiles}
            loading={loading}
            onOpenPromptModal={() => setIsPromptModalOpen(true)}
            selectedModel={selectedModel}
            onSelectModel={handleSelectModel}
            models={models}
            onOpenKeyModal={() => setIsKeyModalOpen(true)}
          />
        )}

        {activeTab === 'consolidated' && (
          <ConsolidatedTable
            schools={schools}
            kpis={kpis}
            onSelectSchool={handleSelectSchool}
            onExportExcel={handleExportExcel}
            onExportCsv={handleExportCsv}
          />
        )}

        {activeTab === 'teachers' && (
          <TeacherDetailTable
            teachers={teachers}
            schools={schools}
            selectedRbd={selectedRbd}
            onSelectRbd={setSelectedRbd}
            onReclassify={handleReclassify}
          />
        )}

        {activeTab === 'audit' && (
          <AuditAndExport
            schools={schools}
            teachers={teachers}
            onExportExcel={handleExportExcel}
            onExportCsv={handleExportCsv}
          />
        )}
      </main>

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center space-y-3">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
            <h4 className="font-bold text-slate-800 text-sm">Procesando Dotaciones Docentes...</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Analizando asignaturas, funciones directivas, talleres y horas pedagógicas mediante el motor híbrido SLEP ({selectedModel}).
            </p>
          </div>
        </div>
      )}

      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveKey={handleSaveApiKey}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        models={models}
        onUpdateModels={handleUpdateModels}
      />

      <PromptModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        onNotify={showToast}
      />
    </div>
  );
}

export default App;

