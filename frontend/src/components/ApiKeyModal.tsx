import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle, AlertCircle, Loader2, Sparkles, ExternalLink, Cpu, Info, Check, RefreshCw } from 'lucide-react';
import type { GeminiModel } from '../types';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveKey: (key: string) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  models: GeminiModel[];
  onUpdateModels: (models: GeminiModel[]) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveKey,
  selectedModel,
  onSelectModel,
  models,
  onUpdateModels,
}) => {
  const [keyInput, setKeyInput] = useState(apiKey);
  const [currentModel, setCurrentModel] = useState(selectedModel || 'gemini-2.5-flash');
  const [loadingModels, setLoadingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; modelTested?: string } | null>(null);

  useEffect(() => {
    setKeyInput(apiKey);
    setCurrentModel(selectedModel || 'gemini-2.5-flash');
    setTestResult(null);
  }, [apiKey, selectedModel, isOpen]);

  // Load models on open if not already loaded
  useEffect(() => {
    if (!isOpen) return;

    const autoFetch = async () => {
      if (models.length === 0) {
        await handleMapModels(apiKey);
      }
    };
    autoFetch();
  }, [isOpen, apiKey]);

  if (!isOpen) return null;

  const handleMapModels = async (keyToUse?: string) => {
    const key = (keyToUse !== undefined ? keyToUse : keyInput).trim();
    setLoadingModels(true);
    setTestResult(null);

    try {
      if (key.length >= 10) {
        const res = await fetch('/api/gemini-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: key }),
        });
        const data = await res.json();
        if (res.ok && data.models && data.models.length > 0) {
          onUpdateModels(data.models);
          setTestResult({
            success: true,
            message: `¡Mapeo exitoso! Se encontraron ${data.models.length} modelos autorizados por tu API Key. Elige el que prefieras a continuación.`,
          });
          return;
        } else if (!res.ok) {
          throw new Error(data.detail || 'Error al consultar modelos con esta API Key.');
        }
      }

      // If no key or short key, fetch defaults
      const resDef = await fetch('/api/gemini-models/default');
      if (resDef.ok) {
        const data = await resDef.json();
        if (data.models) onUpdateModels(data.models);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'No se pudieron mapear los modelos. Verifica que la API Key sea correcta.',
      });
    } finally {
      setLoadingModels(false);
    }
  };

  const handleTestKeyAndModel = async () => {
    if (!keyInput.trim()) {
      setTestResult({ success: false, message: 'Por favor ingresa una clave API antes de probar.' });
      return;
    }
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/test-gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: keyInput.trim(),
          model: currentModel,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({
          success: true,
          message: `¡Conexión exitosa! El modelo "${data.model_tested || currentModel}" respondió correctamente y está listo para clasificar.`,
          modelTested: data.model_tested,
        });
        if (data.models && data.models.length > 0) {
          onUpdateModels(data.models);
        }
        if (data.model_tested) {
          setCurrentModel(data.model_tested);
          onSelectModel(data.model_tested);
        }
        onSaveKey(keyInput.trim());
      } else {
        setTestResult({ success: false, message: data.detail || 'Error al validar la clave o el modelo.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: 'No se pudo conectar al servidor: ' + err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSelectAndApply = (modelId: string) => {
    setCurrentModel(modelId);
    onSelectModel(modelId);
  };

  const handleSave = () => {
    onSaveKey(keyInput.trim());
    onSelectModel(currentModel);
    fetch('/api/model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: currentModel }),
    }).catch(() => {});
    onClose();
  };

  const getBadgeStyle = (badge?: string) => {
    switch (badge) {
      case 'Recomendado':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Alta Precisión':
      case 'Pro':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Rápido':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Económico':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Razonamiento':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const activeModelObj = models.find((m) => m.id === currentModel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150 my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-5 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Mapeo y Elección de Modelo de IA</h3>
              <p className="text-xs text-blue-200">Google Gemini API • Consulta y selecciona el modelo de trabajo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white rounded-lg p-1.5 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Informative banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Ingresa o valida tu <strong>Google Gemini API Key</strong>. Al hacer clic en <strong>"Mapear Modelos Disponibles"</strong>,
              el sistema consultará a la API de Google para detectar exactamente qué modelos tiene habilitados tu cuenta para trabajar.
            </p>
          </div>

          {/* API Key Input + Mapear Button */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              1. Tu Google Gemini API Key
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Key className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono shadow-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => handleMapModels()}
                disabled={loadingModels || !keyInput.trim()}
                className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50"
              >
                {loadingModels ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Mapear Modelos Disponibles</span>
              </button>
            </div>
          </div>

          {/* Model Selector Dropdown */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                <Cpu className="w-4 h-4 text-indigo-600" />
                <span>2. Elegir Modelo de IA a Utilizar ({models.length} disponibles)</span>
              </label>
              {activeModelObj && (
                <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Seleccionado: {activeModelObj.display_name}
                </span>
              )}
            </div>

            <select
              value={currentModel}
              onChange={(e) => handleSelectAndApply(e.target.value)}
              className="w-full p-2.5 text-sm font-semibold text-slate-800 bg-white border-2 border-blue-500 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-600 cursor-pointer"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name || m.id} {m.badge ? `(${m.badge})` : ''} - [{m.id}]
                </option>
              ))}
              {!models.some((m) => m.id === currentModel) && (
                <option value={currentModel}>
                  {currentModel} (Personalizado)
                </option>
              )}
            </select>

            <div className="mt-2 flex items-center space-x-2">
              <input
                type="text"
                placeholder="O escribe un ID de modelo (ej. gemini-3.8-flash, gemini-3.7-flash)..."
                value={currentModel}
                onChange={(e) => handleSelectAndApply(e.target.value.trim())}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              />
            </div>
          </div>

          {/* Model Selection Cards */}
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-slate-500">
              O haz clic directamente en cualquiera de las siguientes opciones para seleccionarlo:
            </label>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {models.map((m) => {
                const isSelected = currentModel === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelectAndApply(m.id)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-start justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-400/30'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1 flex-1 pr-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-slate-900">{m.display_name || m.id}</span>
                        {m.badge && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getBadgeStyle(m.badge)}`}>
                            {m.badge}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">({m.id})</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        {m.description || 'Modelo de procesamiento de lenguaje natural de Google.'}
                      </p>
                    </div>

                    <div className="shrink-0 mt-1">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'border-blue-600 bg-blue-600 text-white shadow-xs' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test Result Feedback */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start space-x-2.5 animate-in fade-in duration-150 ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed font-medium">{testResult.message}</span>
            </div>
          )}

          {/* Helper link */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-500 space-y-1">
            <div className="flex items-center space-x-1 font-semibold text-slate-700">
              <span>¿No tienes una clave todavía?</span>
            </div>
            <p>
              Puedes obtener una clave gratuita en{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-medium"
              >
                Google AI Studio <ExternalLink className="w-3 h-3" />
              </a>
              . Una vez creada, pégala arriba y presiona <strong>"Mapear Modelos Disponibles"</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex flex-wrap gap-2 justify-between items-center border-t border-slate-200">
          <button
            type="button"
            onClick={handleTestKeyAndModel}
            disabled={testing || !keyInput.trim()}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 disabled:opacity-50 transition-colors"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
            <span>Probar Modelo ({currentModel})</span>
          </button>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all active:scale-95 flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Guardar y Trabajar con este Modelo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


