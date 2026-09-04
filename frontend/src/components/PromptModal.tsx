import React, { useState, useEffect } from 'react';
import { X, Sparkles, RotateCcw, Save, Copy, Check } from 'lucide-react';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  onClose,
  onNotify,
}) => {
  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      fetchPrompt();
    }
  }, [isOpen]);

  const fetchPrompt = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/prompt');
      if (res.ok) {
        const data = await res.json();
        setPrompt(data.prompt);
      }
    } catch (err: any) {
      onNotify('Error al cargar el prompt: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (res.ok) {
        onNotify('¡Prompt del sistema actualizado correctamente!');
        onClose();
      } else {
        const err = await res.json();
        throw new Error(err.detail || 'Error al guardar prompt');
      }
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/prompt/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPrompt(data.prompt);
        onNotify('Prompt restablecido a la versión oficial SLEP');
      }
    } catch (err: any) {
      onNotify('Error al restablecer: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600/50 flex items-center justify-center border border-blue-400/30">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-base">Prompt del Sistema IA (Google Gemini 2.5)</h3>
              <p className="text-xs text-blue-200">
                Instrucciones oficiales para clasificar horas en Aula, Técnicas y Directivas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white rounded-lg p-1 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Plantilla de Instrucciones Enviada a Gemini
            </span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded-md hover:bg-blue-50 border border-blue-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado al portapapeles' : 'Copiar Prompt'}</span>
            </button>
          </div>

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              rows={16}
              className="w-full p-3.5 text-xs font-mono bg-slate-950 text-slate-100 rounded-xl border border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 leading-relaxed resize-y"
              placeholder="Cargando prompt del sistema..."
            />
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <p className="font-bold text-slate-800">
              💡 Parámetro dinámico: <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded font-mono">{'{activities_json}'}</code>
            </p>
            <p>
              El motor reemplaza automáticamente <code className="font-mono">{'{activities_json}'}</code> con el lote de actividades o funciones no reconocidas por el diccionario local. La IA analiza abreviaturas chilenas (ej: <em>coord pie</em>, <em>taller sep</em>) y retorna la clasificación estricta en formato JSON.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-4 flex justify-between items-center border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving || loading}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer Oficial SLEP</span>
          </button>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios en Prompt'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
