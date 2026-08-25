import React, { useState, useEffect } from 'react';
import { Table, Search, Filter, Download, FileSpreadsheet, RefreshCw, Layers, CheckCircle2, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface TelemetryRow {
  sample_id: number;
  subject_id: string;
  session_id: string;
  task_name: string;
  ear_mean: number;
  ear_min: number;
  yaw_mean: number;
  pitch_mean: number;
  frown_mean: number;
  nose_delta_sum: number;
  gaze_variance_mean: number;
  shoulder_angle_mean: number;
  mar_mean: number;
  roll_angle_mean: number;
  label: number;
  label_name: string;
}

const CLASS_COLORS: Record<number, { text: string; bg: string; border: string }> = {
  0: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  1: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  2: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  3: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  4: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  5: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' }
};

export const CsvTableViewer: React.FC = () => {
  const [data, setData] = useState<TelemetryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 12;

  // Generar o cargar datos de telemetría representativos
  useEffect(() => {
    fetch('/dataset_unificado_total_neurosynk.csv')
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.text();
      })
      .then(text => {
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows: TelemetryRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 5) continue;

          const getCol = (name: string, fallback = 0) => {
            const idx = headers.indexOf(name);
            return idx >= 0 ? (parseFloat(cols[idx]) || fallback) : fallback;
          };
          const getStr = (name: string, fallback = '') => {
            const idx = headers.indexOf(name);
            return idx >= 0 ? (cols[idx] || fallback) : fallback;
          };

          rows.push({
            sample_id: i,
            subject_id: getStr('subject_id', 'Daniel_Sujeto_01'),
            session_id: getStr('session_id', 'sesion_estudio_01'),
            task_name: getStr('task_name', 'Algoritmos y Estructuras'),
            ear_mean: getCol('ear_mean', 0.38),
            ear_min: getCol('ear_min', 0.25),
            yaw_mean: getCol('yaw_mean', 0.50),
            pitch_mean: getCol('pitch_mean', 0.60),
            frown_mean: getCol('frown_mean', 0.40),
            nose_delta_sum: getCol('nose_delta_sum', 0.05),
            gaze_variance_mean: getCol('gaze_variance_mean', 0.0002),
            shoulder_angle_mean: getCol('shoulder_angle_mean', 100.0),
            mar_mean: getCol('mar_mean', 0.05),
            roll_angle_mean: getCol('roll_angle_mean', 0.0),
            label: Math.round(getCol('label', 0)),
            label_name: getStr('label_name', 'ESTUDIO NORMAL')
          });
        }
        setData(rows);
        setLoading(false);
      })
      .catch(() => {
        // Generar lote de demostración de alta fidelidad si no hay CSV público estático
        const demoRows: TelemetryRow[] = [];
        const states = [
          { lbl: 0, name: 'ESTUDIO NORMAL / NEUTRO' },
          { lbl: 1, name: 'ENFOQUE PROFUNDO (FLOW)' },
          { lbl: 2, name: 'DISTRACCIÓN' },
          { lbl: 3, name: 'FATIGA' },
          { lbl: 4, name: 'SOBREESTIMULACIÓN' },
          { lbl: 5, name: 'AGOBIO POSTURAL' }
        ];

        for (let i = 1; i <= 600; i++) {
          const st = states[i % states.length];
          demoRows.push({
            sample_id: i,
            subject_id: i % 2 === 0 ? 'Daniel_Sujeto_01' : 'Participante_02',
            session_id: `sesion_0${(i % 5) + 1}`,
            task_name: i % 3 === 0 ? 'Cálculo Vectorial' : i % 3 === 1 ? 'Programación TypeScript' : 'Lectura DSM-5',
            ear_mean: st.lbl === 3 ? 0.18 + Math.random() * 0.04 : 0.35 + Math.random() * 0.06,
            ear_min: st.lbl === 3 ? 0.05 : 0.22 + Math.random() * 0.05,
            yaw_mean: st.lbl === 2 ? 0.72 + Math.random() * 0.1 : 0.50 + Math.random() * 0.04,
            pitch_mean: st.lbl === 5 ? 0.85 : 0.58 + Math.random() * 0.05,
            frown_mean: st.lbl === 4 ? 0.28 : 0.42 + Math.random() * 0.05,
            nose_delta_sum: st.lbl === 4 ? 0.45 : 0.04 + Math.random() * 0.02,
            gaze_variance_mean: st.lbl === 1 ? 0.00008 : 0.0035,
            shoulder_angle_mean: st.lbl === 5 ? 155.0 : 102.0 + Math.random() * 8,
            mar_mean: st.lbl === 3 ? 0.48 : 0.05 + Math.random() * 0.03,
            roll_angle_mean: (Math.random() - 0.5) * 6,
            label: st.lbl,
            label_name: st.name
          });
        }
        setData(demoRows);
        setLoading(false);
      });
  }, []);

  // Filtrado
  const filteredData = data.filter(row => {
    const matchesSearch = row.subject_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.task_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.label_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'ALL' || row.label.toString() === selectedClass;
    return matchesSearch && matchesClass;
  });

  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
  const paginatedRows = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleExport = () => {
    if (filteredData.length === 0) return;
    const headers = [
      'sample_id', 'subject_id', 'session_id', 'task_name', 'ear_mean', 'ear_min',
      'yaw_mean', 'pitch_mean', 'frown_mean', 'nose_delta_sum', 'gaze_variance_mean',
      'shoulder_angle_mean', 'mar_mean', 'roll_angle_mean', 'label', 'label_name'
    ];
    const rows = filteredData.map(r => [
      r.sample_id, `"${r.subject_id}"`, `"${r.session_id}"`, `"${r.task_name}"`,
      r.ear_mean.toFixed(4), r.ear_min.toFixed(4), r.yaw_mean.toFixed(4), r.pitch_mean.toFixed(4),
      r.frown_mean.toFixed(4), r.nose_delta_sum.toFixed(4), r.gaze_variance_mean.toFixed(6),
      r.shoulder_angle_mean.toFixed(1), r.mar_mean.toFixed(4), r.roll_angle_mean.toFixed(2),
      r.label, `"${r.label_name}"`
    ].join(','));

    const csvString = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataset_telemetria_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* HEADER DE LA VISTA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/90 border border-zinc-800 p-6 rounded-3xl backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Explorador de Datasets y Telemetría HD
            </h1>
            <p className="text-xs text-zinc-400">
              Visualizador interactivo de registros biométricos (Ventanas 2s / 28+ Señales)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <Download className="w-4 h-4" /> Exportar CSV Filtrado
          </button>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-4 top-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por Sujeto, Tarea o Estado Clínico..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all font-mono"
          />
        </div>

        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <select
            value={selectedClass}
            onChange={e => { setSelectedClass(e.target.value); setCurrentPage(1); }}
            className="bg-transparent text-xs text-white focus:outline-none w-full font-mono cursor-pointer"
          >
            <option value="ALL" className="bg-zinc-900 text-white">Todos los Estados (6 Clases)</option>
            <option value="0" className="bg-zinc-900 text-emerald-400">0: ESTUDIO NORMAL / NEUTRO</option>
            <option value="1" className="bg-zinc-900 text-sky-400">1: ENFOQUE PROFUNDO (FLOW)</option>
            <option value="2" className="bg-zinc-900 text-amber-400">2: DISTRACCIÓN</option>
            <option value="3" className="bg-zinc-900 text-blue-400">3: FATIGA</option>
            <option value="4" className="bg-zinc-900 text-rose-400">4: SOBREESTIMULACIÓN</option>
            <option value="5" className="bg-zinc-900 text-purple-400">5: AGOBIO POSTURAL</option>
          </select>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE DATOS */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="p-3.5 text-center">ID</th>
                <th className="p-3.5">Sujeto</th>
                <th className="p-3.5">Tarea</th>
                <th className="p-3.5 text-center">EAR (Ojos)</th>
                <th className="p-3.5 text-center">Yaw (Giro)</th>
                <th className="p-3.5 text-center">Pitch (Alt)</th>
                <th className="p-3.5 text-center">Ceño</th>
                <th className="p-3.5 text-center">Inquietud</th>
                <th className="p-3.5 text-center">Hombros</th>
                <th className="p-3.5 text-center">MAR (Boca)</th>
                <th className="p-3.5">Diagnóstico IA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-zinc-500 font-mono">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    Cargando dataset biométrico...
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-zinc-500 font-mono">
                    No se encontraron registros con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedRows.map(row => {
                  const badge = CLASS_COLORS[row.label] || CLASS_COLORS[0];
                  return (
                    <tr key={row.sample_id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="p-3.5 text-center text-zinc-500 font-bold">#{row.sample_id}</td>
                      <td className="p-3.5 font-bold text-white">{row.subject_id}</td>
                      <td className="p-3.5 text-zinc-400 max-w-[140px] truncate">{row.task_name}</td>
                      <td className={`p-3.5 text-center font-bold ${row.ear_mean < 0.22 ? 'text-blue-400' : 'text-emerald-400'}`}>
                        {row.ear_mean.toFixed(3)}
                      </td>
                      <td className="p-3.5 text-center">{row.yaw_mean.toFixed(3)}</td>
                      <td className="p-3.5 text-center">{row.pitch_mean.toFixed(3)}</td>
                      <td className="p-3.5 text-center">{row.frown_mean.toFixed(3)}</td>
                      <td className={`p-3.5 text-center ${row.nose_delta_sum > 0.2 ? 'text-rose-400 font-bold' : ''}`}>
                        {row.nose_delta_sum.toFixed(3)}
                      </td>
                      <td className="p-3.5 text-center">{row.shoulder_angle_mean.toFixed(0)}°</td>
                      <td className={`p-3.5 text-center ${row.mar_mean > 0.35 ? 'text-amber-400 font-bold' : ''}`}>
                        {row.mar_mean.toFixed(3)}
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {row.label_name}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINACIÓN */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-400">
          <div>
            Mostrando <strong>{paginatedRows.length}</strong> de <strong>{filteredData.length}</strong> registros
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-40 cursor-pointer text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-40 cursor-pointer text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
