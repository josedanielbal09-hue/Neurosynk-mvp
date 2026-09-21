import React, { useState } from 'react';

interface GroundingBreakProps {
  remainingSeconds: number;
  onSkipBreak: () => void;
  formatTime: (sec: number) => string;
}

type GroundingCategory = 'menu' | '54321' | 'propiocepcion' | 'termico' | 'mental' | 'realidad';

export const GroundingBreak: React.FC<GroundingBreakProps> = ({
  remainingSeconds,
  onSkipBreak,
  formatTime
}) => {
  const [activeTab, setActiveTab] = useState<GroundingCategory>('menu');

  return (
    <div className="flex flex-col items-center justify-between p-6 h-full text-zinc-200 animate-fadeIn">
      {/* Encabezado del Descanso */}
      <div className="text-center">
        <span className="px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
          ☕ Pausa de Restauración
        </span>
        <h2 className="text-4xl font-bold font-mono text-white mt-3 tracking-wider">
          {formatTime(remainingSeconds)}
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Momento de desconectar la mente para recargar la atención.
        </p>
      </div>

      {/* Contenido Dinámico de Grounding */}
      <div className="w-full max-w-md my-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 text-sm backdrop-blur-sm min-h-[190px] flex flex-col justify-center">
        {activeTab === 'menu' && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400 text-center mb-3">
              Selecciona una técnica rápida o simplemente descansa en silencio:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveTab('54321')}
                className="p-2.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 text-left transition-colors cursor-pointer"
              >
                <div className="font-semibold text-emerald-300 text-xs">👀 Técnica 5-4-3-2-1</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Anclaje sensorial guiado</div>
              </button>
              <button
                onClick={() => setActiveTab('propiocepcion')}
                className="p-2.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 text-left transition-colors cursor-pointer"
              >
                <div className="font-semibold text-cyan-300 text-xs">🧘 Anclaje Físico</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Pies, palmas y hombros</div>
              </button>
              <button
                onClick={() => setActiveTab('termico')}
                className="p-2.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 text-left transition-colors cursor-pointer"
              >
                <div className="font-semibold text-sky-300 text-xs">❄️ Contraste Térmico</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Reset sensorial fresco</div>
              </button>
              <button
                onClick={() => setActiveTab('mental')}
                className="p-2.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 text-left transition-colors cursor-pointer"
              >
                <div className="font-semibold text-amber-300 text-xs">🧠 Conteo Neutro</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Categorización visual</div>
              </button>
            </div>
            <button
              onClick={() => setActiveTab('realidad')}
              className="w-full mt-2 py-1.5 text-center text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              🌿 Descriptores de Realidad Presente
            </button>
          </div>
        )}

        {activeTab === '54321' && (
          <div className="space-y-1.5 text-xs text-zinc-300">
            <div className="font-semibold text-emerald-400 text-sm mb-1">Técnica Sensorial 5-4-3-2-1</div>
            <div>• <strong className="text-white">5 cosas</strong> que puedas ver en tu entorno.</div>
            <div>• <strong className="text-white">4 cosas</strong> que puedas tocar (ropa, mesa, silla).</div>
            <div>• <strong className="text-white">3 sonidos</strong> que percibas a la distancia.</div>
            <div>• <strong className="text-white">2 aromas</strong> en el ambiente.</div>
            <div>• <strong className="text-white">1 sabor</strong> actual en tu boca.</div>
            <button onClick={() => setActiveTab('menu')} className="text-xs text-emerald-400 underline mt-2 block cursor-pointer">← Volver al menú</button>
          </div>
        )}

        {activeTab === 'propiocepcion' && (
          <div className="space-y-2 text-xs text-zinc-300">
            <div className="font-semibold text-cyan-400 text-sm mb-1">Anclaje Propioceptivo</div>
            <p>1. Apoya firmemente ambas plantas de los pies contra el suelo sintiendo el peso de tu cuerpo.</p>
            <p>2. Presiona suavemente las palmas de tus manos planas sobre el escritorio por 5 segundos.</p>
            <p>3. Sube los hombros hacia las orejas, inhala hondo y suéltalos de golpe exhalando.</p>
            <button onClick={() => setActiveTab('menu')} className="text-xs text-cyan-400 underline mt-2 block cursor-pointer">← Volver al menú</button>
          </div>
        )}

        {activeTab === 'termico' && (
          <div className="space-y-2 text-xs text-zinc-300">
            <div className="font-semibold text-sky-400 text-sm mb-1">Reset Térmico Seguro</div>
            <p>• Sostén un vaso con agua fresca o toca una superficie metálica/fresca de tu mesa.</p>
            <p>• Siente la diferencia de temperatura en las yemas de tus dedos durante 15 segundos.</p>
            <p>• Si lo prefieres, levántate a lavarte las manos con agua fría para despejar la vista.</p>
            <button onClick={() => setActiveTab('menu')} className="text-xs text-sky-400 underline mt-2 block cursor-pointer">← Volver al menú</button>
          </div>
        )}

        {activeTab === 'mental' && (
          <div className="space-y-2 text-xs text-zinc-300">
            <div className="font-semibold text-amber-400 text-sm mb-1">Categorización Neutra</div>
            <p>• Elige un color (ej. verde o azul) y localiza 4 objetos de ese color a tu alrededor.</p>
            <p>• Observa un objeto cualquiera y describe mentalmente: su forma geométrica, su textura y su peso aproximado.</p>
            <button onClick={() => setActiveTab('menu')} className="text-xs text-amber-400 underline mt-2 block cursor-pointer">← Volver al menú</button>
          </div>
        )}

        {activeTab === 'realidad' && (
          <div className="space-y-2 text-xs text-zinc-300">
            <div className="font-semibold text-purple-400 text-sm mb-1">Hechos del Entorno</div>
            <p className="italic text-zinc-300">
              "Estoy sentado en mi silla. El suelo sostiene mis pies. Esta es mi mesa de trabajo y la habitación está tranquila."
            </p>
            <p className="text-[11px] text-zinc-400">Repite mentalmente afirmaciones fácticas y neutrales del espacio físico presente.</p>
            <button onClick={() => setActiveTab('menu')} className="text-xs text-purple-400 underline mt-2 block cursor-pointer">← Volver al menú</button>
          </div>
        )}
      </div>

      {/* Botón para saltar o terminar descanso */}
      <div className="w-full flex justify-between items-center pt-2">
        <span className="text-[11px] text-zinc-500">¿Listo antes de tiempo?</span>
        <button
          onClick={onSkipBreak}
          className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span>Continuar sesión</span> ▶️
        </button>
      </div>
    </div>
  );
};
