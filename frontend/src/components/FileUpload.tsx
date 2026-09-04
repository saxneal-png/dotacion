import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Trash2, Play, Sparkles, FolderUp, BookOpen, Wrench, Shield, Code, Cpu } from 'lucide-react';
import type { GeminiModel } from '../types';

interface FileUploadProps {
  onProcessFiles: (files: File[]) => Promise<void>;
  loading: boolean;
  onOpenPromptModal: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  models: GeminiModel[];
  onOpenKeyModal: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onProcessFiles,
  loading,
  onOpenPromptModal,
  selectedModel,
  onSelectModel,
  models,
  onOpenKeyModal,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter((f) =>
        /\.(xlsx|xls|csv)$/i.test(f.name)
      );
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
        /\.(xlsx|xls|csv)$/i.test(f.name)
      );
      setSelectedFiles((prev) => [...prev, ...droppedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartProcessing = () => {
    if (selectedFiles.length > 0) {
      onProcessFiles(selectedFiles);
    }
  };

  return (
    <div className="space-y-6">
      {/* Informative Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <div className="inline-flex items-center space-x-2 bg-blue-500/20 text-blue-200 px-3 py-1 rounded-full text-xs font-semibold border border-blue-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Motor Inteligente SLEP</span>
            </div>

            <div className="inline-flex items-center space-x-2 bg-indigo-500/30 text-indigo-100 px-3 py-1 rounded-full text-xs font-semibold border border-indigo-400/40">
              <Cpu className="w-3.5 h-3.5 text-amber-300" />
              <span>Modelo de IA:</span>
              <select
                value={selectedModel}
                onChange={(e) => onSelectModel(e.target.value)}
                className="bg-slate-900/80 text-white text-xs font-bold rounded px-2 py-0.5 border border-indigo-400/50 focus:outline-none cursor-pointer"
                title="Cambiar modelo de IA a utilizar"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                    {m.display_name || m.id} {m.badge ? `(${m.badge})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Consolidación Automática de Dotación Docente
          </h2>
          <p className="text-blue-100/90 text-sm leading-relaxed mb-4">
            Carga tus planillas de dotación escolar en formato <strong>.xlsx, .xls o .csv</strong>.
            La aplicación interpreta la estructura de cada planilla, clasifica cada función docente en{' '}
            <span className="font-bold text-amber-300">Aula</span>,{' '}
            <span className="font-bold text-emerald-300">Técnica</span> o{' '}
            <span className="font-bold text-purple-300">Directiva</span> mediante el motor híbrido (Reglas chilenas + Gemini AI), y genera
            el consolidado institucional oficial.
          </p>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={onOpenPromptModal}
              className="inline-flex items-center space-x-2 bg-blue-800/60 hover:bg-blue-800 text-blue-100 font-semibold px-3.5 py-1.5 rounded-lg text-xs border border-blue-400/30 transition-colors"
            >
              <Code className="w-3.5 h-3.5 text-blue-300" />
              <span>Ver / Configurar Prompt Oficial de IA</span>
            </button>

            <button
              onClick={onOpenKeyModal}
              className="inline-flex items-center space-x-2 bg-indigo-800/60 hover:bg-indigo-800 text-indigo-100 font-semibold px-3.5 py-1.5 rounded-lg text-xs border border-indigo-400/30 transition-colors"
            >
              <Cpu className="w-3.5 h-3.5 text-amber-300" />
              <span>Mapear Modelos / Configurar Key</span>
            </button>
          </div>
        </div>
      </div>

      {/* Classification Rules Quick Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-xs">
          <div className="flex items-center space-x-2 font-bold text-blue-900 mb-1">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>1. Horas Aula (Frente a Estudiantes)</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Asignaturas (Lenguaje, Matemática, Historia, Ciencias, etc.), Formación Ciudadana, talleres JEC/SEP, extraescolares, PIE en aula, codocencia, aula de recursos.
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs">
          <div className="flex items-center space-x-2 font-bold text-emerald-900 mb-1">
            <Wrench className="w-4 h-4 text-emerald-600" />
            <span>2. Horas Técnicas (Gestión y No Lectivas)</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Toda actividad fuera del aula que no sea directiva: Jefe(a) UTP, apoyo técnico, CRA, Enlaces/TIC, recreos (60/40, 65/35), horas no lectivas, comunidades CAP.
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-xs">
          <div className="flex items-center space-x-2 font-bold text-purple-900 mb-1">
            <Shield className="w-4 h-4 text-purple-600" />
            <span>3. Horas Directivas (Liderazgo)</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Regla estricta: <strong>Solo Director(a), Subdirector(a), Inspector(a) General y Encargado(a) de Escuela</strong> constituyen horas directivas.
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all bg-white ${
          dragOver
            ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept=".xlsx,.xls,.csv"
          className="hidden"
        />
        <input
          type="file"
          ref={folderInputRef}
          onChange={handleFileChange}
          // @ts-ignore
          webkitdirectory=""
          // @ts-ignore
          directory=""
          multiple
          className="hidden"
        />

        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <Upload className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-800">
              Arrastra y suelta tus archivos Excel aquí
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Soporta múltiples planillas <span className="font-mono font-medium">.xlsx</span>,{' '}
              <span className="font-mono font-medium">.xls</span> o <span className="font-mono font-medium">.csv</span>
            </p>
          </div>

          <div className="flex justify-center items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Seleccionar Archivos</span>
            </button>

            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <FolderUp className="w-4 h-4" />
              <span>Cargar Carpeta Completa</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-800 text-sm">Archivos Listos para Procesar</span>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">
                {selectedFiles.length}
              </span>
            </div>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium"
            >
              Limpiar lista
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-800 truncate">{file.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                  title="Eliminar de la lista"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              onClick={handleStartProcessing}
              disabled={loading}
              className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{loading ? 'Procesando Planillas...' : 'Procesar y Clasificar con Motor Híbrido'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
