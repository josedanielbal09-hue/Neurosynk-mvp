import React, { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Download, RefreshCw, Send, Terminal, X } from 'lucide-react';
import { sessionTelemetry, SessionDiagnosticReport } from '../services/sessionTelemetry';

interface TelemetryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TelemetryDrawer: React.FC<TelemetryDrawerProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<SessionDiagnosticReport | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<boolean | null>(null);

  const refreshReport = () => {
    const current = sessionTelemetry.generateReport();
    setReport(current);
    setSendSuccess(null);
  };

  const handleExportToBackend = async () => {
    setIsSending(true);
    const ok = await sessionTelemetry.exportReportToBackend();
    setIsSending(false);
    setSendSuccess(ok);
  };

  const handleDownloadJSON = () => {
    const current = report || sessionTelemetry.generateReport();
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neurosynk_diagnostics_${Date.now()}.json`;
    a.click();
  };

  if (!isOpen) return null;

  const currentReport = report || sessionTelemetry.generateReport();

  return (
    <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex justify-end">
      <div className="w-full max-w-xl bg-zinc-950 border-l border-zinc-800 h-full flex flex-col shadow-2xl p-6 overflow-y-auto no-scrollbar space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <Terminal className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">Caja Negra & Diagnóstico de Sesión</h3>
              <p className="text-xs text-zinc-400">Flight Recorder y Detección de Anomalías</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Duración</span>
            <span className="text-lg font-mono font-bold text-white">{currentReport.durationSeconds}s</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Frames</span>
            <span className="text-lg font-mono font-bold text-white">{currentReport.totalFrames}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Promedio Foco</span>
            <span className="text-lg font-mono font-bold text-emerald-400">{currentReport.averageFocus}%</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Subdivisiones</span>
            <span className="text-lg font-mono font-bold text-cyan-400">{currentReport.subdivisionCount}</span>
          </div>
        </div>

        {/* Panel de Anomalías Detectadas */}
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-2 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Anomalías Detectadas en Vivo
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-black/50 border border-zinc-800 flex justify-between">
              <span className="text-zinc-400">Jitter de Enfoque:</span>
              <span className={currentReport.anomaliesDetected.jitterCount > 0 ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                {currentReport.anomaliesDetected.jitterCount}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/50 border border-zinc-800 flex justify-between">
              <span className="text-zinc-400">Saltos Rápidos:</span>
              <span className={currentReport.anomaliesDetected.rapidClassFlips > 0 ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                {currentReport.anomaliesDetected.rapidClassFlips}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/50 border border-zinc-800 flex justify-between">
              <span className="text-zinc-400">Falsa Fatiga:</span>
              <span className={currentReport.anomaliesDetected.falseFatigueSpikes > 0 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                {currentReport.anomaliesDetected.falseFatigueSpikes}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/50 border border-zinc-800 flex justify-between">
              <span className="text-zinc-400">Subdivisiones Rápidas:</span>
              <span className="text-zinc-300 font-bold">{currentReport.anomaliesDetected.prematureSubdivisions}</span>
            </div>
          </div>
        </div>

        {/* Log de Eventos de la Sesión */}
        <div className="space-y-2 flex-1 flex flex-col min-h-0">
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Historial de Eventos del Sistema:</span>
          <div className="flex-1 min-h-[160px] max-h-[220px] overflow-y-auto p-3.5 rounded-2xl bg-black border border-zinc-800 font-mono text-[11px] space-y-1.5 no-scrollbar">
            {currentReport.eventLog.map((ev, i) => (
              <div key={i} className="text-zinc-300 leading-relaxed border-b border-zinc-900/60 pb-1">
                {ev}
              </div>
            ))}
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
          <button
            onClick={refreshReport}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono flex items-center gap-2 transition-colors cursor-pointer border border-zinc-800"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
          <button
            onClick={handleDownloadJSON}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono flex items-center gap-2 transition-colors cursor-pointer border border-zinc-800"
          >
            <Download className="w-3.5 h-3.5" /> Descargar JSON
          </button>
          <button
            onClick={handleExportToBackend}
            disabled={isSending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {isSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sendSuccess === true ? "¡Diagnóstico Guardado!" : "Enviar a FastAPI"}
          </button>
        </div>

      </div>
    </div>
  );
};
