import React, { useState, useEffect } from 'react';
import { X, Sparkles, RotateCcw, Save, Copy, Check } from 'lucide-react';
import { DEFAULT_GEMINI_PROMPT } from '../services/classifier';

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
      const saved = localStorage.getItem('gemini_custom_prompt');
      if (saved) {
        setPrompt(saved);
        setLoading(false);
        return;
      }

      // Try fetching from backend if available
      const res = await fetch('/api/prompt');
      if (res.ok) {
        const data = await res.json();
        setPrompt(data.prompt);
      } else {
        setPrompt(DEFAULT_GEMINI_PROMPT);
      }
    } catch {
      setPrompt(DEFAULT_GEMINI_PROMPT);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('gemini_custom_prompt', prompt);

      try {
        await fetch('/api/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
      } catch {}

      onNotify('¡Prompt del sistema actualizado correctamente!');
      onClose();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      localStorage.removeItem('gemini_custom_prompt');
      setPrompt(DEFAULT_GEMINI_PROMPT);

      try {
        await fetch('/api/prompt/reset', { method: 'POST' });
      } catch {}

      onNotify('Prompt restablecido a la versión oficial SLEP');
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
    onNotify('Prompt copiado al portapapeles');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Prompt de Clasificación IA
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Transparencia Total
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Este es el prompt que analiza tus planillas y clasifica las funciones en Aula, Técnica o Directiva.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Puedes editar este prompt y tus cambios se guardarán automáticamente en tu navegador.</span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center space-x-1.5 text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar prompt'}</span>
            </button>
          </div>

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading || saving}
              rows={16}
              className="w-full font-mono text-xs text-slate-800 bg-slate-900/5 p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all resize-none leading-relaxed"
              placeholder="Cargando prompt..."
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={handleReset}
            disabled={loading || saving}
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restablecer Oficial SLEP</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="inline-flex items-center space-x-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar y Aplicar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
