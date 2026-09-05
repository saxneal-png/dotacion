import React from 'react';
import { School, BookOpen, Wrench, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { KpiStats } from '../types';

interface KpiCardsProps {
  kpis: KpiStats;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ kpis }) => {
  const over44Count = kpis.teachers_over_44_count || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* Total Establecimientos */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Establecimientos</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-slate-900">{kpis.total_schools}</span>
            <span className="text-xs text-slate-500 font-medium">({kpis.total_teachers} docentes)</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Matrícula total: <strong className="text-slate-700">{kpis.total_matricula.toLocaleString()}</strong>
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          <School className="w-5 h-5" />
        </div>
      </div>

      {/* Horas Aula */}
      <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Horas Aula</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-blue-900">{kpis.total_horas_aula.toFixed(1)}</span>
              <span className="text-xs font-semibold text-blue-600">hrs ({kpis.pct_aula}%)</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Atención pedagógica directa</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(kpis.pct_aula, 100)}%` }}
          />
        </div>
      </div>

      {/* Horas Técnicas */}
      <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Horas Técnicas</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-emerald-900">{kpis.total_horas_tecnicas.toFixed(1)}</span>
              <span className="text-xs font-semibold text-emerald-600">hrs ({kpis.pct_tecnicas}%)</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Gestión pedagógica y apoyos</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
        </div>
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-emerald-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(kpis.pct_tecnicas, 100)}%` }}
          />
        </div>
      </div>

      {/* Horas Directivas */}
      <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Horas Directivas</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-purple-900">{kpis.total_horas_directivas.toFixed(1)}</span>
              <span className="text-xs font-semibold text-purple-600">hrs ({kpis.pct_directivas}%)</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Liderazgo y dirección escolar</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
        </div>
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-purple-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(kpis.pct_directivas, 100)}%` }}
          />
        </div>
      </div>

      {/* Límite Legal 44h (Art. 80) */}
      <div className={`p-4 rounded-xl border shadow-xs transition-colors ${
        over44Count > 0 ? 'bg-amber-50/80 border-amber-300' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${
              over44Count > 0 ? 'text-amber-800' : 'text-slate-500'
            }`}>
              Tope Legal 44h
            </p>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className={`text-2xl font-bold ${
                over44Count > 0 ? 'text-amber-950' : 'text-slate-900'
              }`}>
                {over44Count}
              </span>
              <span className={`text-xs font-semibold ${
                over44Count > 0 ? 'text-amber-700' : 'text-slate-500'
              }`}>
                {over44Count === 1 ? 'docente excede' : 'docentes exceden'}
              </span>
            </div>
            <p className={`text-[11px] mt-1 ${
              over44Count > 0 ? 'text-amber-800 font-medium' : 'text-emerald-700 font-medium'
            }`}>
              {over44Count > 0 ? 'Error de cálculo detectado' : '100% dentro del marco legal'}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            over44Count > 0 ? 'bg-amber-200 text-amber-900' : 'bg-emerald-50 text-emerald-700'
          }`}>
            {over44Count > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
        </div>
      </div>
    </div>
  );
};
