import React from 'react';
import { Key, CheckCircle, Sparkles, FileSpreadsheet, Layers, Users, ShieldCheck, Code, Trash2, Cpu } from 'lucide-react';
import type { GeminiModel } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  geminiKey: string;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  models: GeminiModel[];
  openKeyModal: () => void;
  openPromptModal: () => void;
  onClearData: () => void;
  schoolsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  geminiKey,
  selectedModel,
  onSelectModel,
  models,
  openKeyModal,
  openPromptModal,
  onClearData,
  schoolsCount,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center text-white shadow-sm font-bold text-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-slate-900 text-lg tracking-tight">Dotación Uyuy!! 🤠</span>
                <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-semibold border border-amber-300">
                  SLEP
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Servicio Local de Educación Pública • Clasificador Híbrido Aula / Técnica / Directiva
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Direct Model Selection in Header */}
            <div className="hidden sm:flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-300">
              <Cpu className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <select
                value={selectedModel}
                onChange={(e) => onSelectModel(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[150px] truncate"
                title="Elegir modelo de IA activo"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name || m.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Prompt Exposure Button */}
            <button
              onClick={openPromptModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors"
              title="Ver y editar el prompt oficial de Google Gemini"
            >
              <Code className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden md:inline">Prompt de IA</span>
            </button>

            {/* API Key & Map Models Modal Button */}
            <button
              onClick={openKeyModal}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                geminiKey
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100 shadow-2xs'
                  : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
              }`}
              title="Mapear modelos de IA y configurar API Key"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{geminiKey ? 'Mapear / Configurar IA' : 'Configurar API Key'}</span>
              {geminiKey ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              )}
            </button>

            {/* Clear Data Button */}
            {schoolsCount > 0 && (
              <button
                onClick={onClearData}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors"
                title="Limpiar datos y comenzar nuevo análisis"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Limpiar</span>
              </button>
            )}
          </div>
        </div>

        <nav className="flex space-x-2 border-t border-slate-100 py-2 -mb-px overflow-x-auto">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>1. Carga de Planillas</span>
          </button>

          <button
            onClick={() => setActiveTab('consolidated')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all relative ${
              activeTab === 'consolidated'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2. Consolidado SLEP</span>
            {schoolsCount > 0 && (
              <span className={`text-xs px-1.5 py-0.2 rounded-full ${activeTab === 'consolidated' ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'}`}>
                {schoolsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('teachers')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'teachers'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3. Detalle por Docente</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>4. Auditoría & Exportación</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
