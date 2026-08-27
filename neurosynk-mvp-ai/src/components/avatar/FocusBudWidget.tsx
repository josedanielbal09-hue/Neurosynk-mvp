import React, { useEffect, useState } from 'react';
import { Avatar, FocusBudState } from '../Avatar';
import { audioService } from '../../services/audioService';
import { getRandomStateMessage } from '../../config/avatarConfig';

export interface FocusBudWidgetProps {
  state: FocusBudState;
  message?: string | null;
  className?: string;
  size?: number;
}

/**
 * FocusBudWidget: Componente protagonista para el robot FocusBud.
 * Integra el Avatar reactivo de 60 FPS y el bocadillo estilizado de acompañamiento empático (Body Doubling).
 */
export const FocusBudWidget: React.FC<FocusBudWidgetProps> = ({
  state,
  message,
  className = '',
  size = 320,
}) => {
  const [currentMessage, setCurrentMessage] = useState<string>('');

  // Reproducción automática de sonido al cambiar de estado biométrico
  useEffect(() => {
    if (state) {
      audioService.playStateSound(state);
    }
  }, [state]);

  // Selección dinámica de la frase de acompañamiento empático (Body Doubling)
  useEffect(() => {
    if (message !== undefined && message !== null) {
      setCurrentMessage(message);
    } else {
      setCurrentMessage(getRandomStateMessage(state));
    }
  }, [state, message]);

  return (
    <div className={`relative flex flex-col items-center justify-center w-full max-w-[420px] select-none ${className}`}>
      {/* Bocadillo de Diálogo Estilizado de FocusBud */}
      {currentMessage && (
        <div className="relative mb-3 z-30 animate-fadeIn pointer-events-none">
          <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700/70 shadow-2xl rounded-2xl px-5 py-2.5 text-xs sm:text-sm font-medium text-zinc-200 text-center max-w-xs sm:max-w-sm tracking-wide leading-relaxed">
            {currentMessage}
          </div>
          {/* Apuntador hacia la cabeza del robot */}
          <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-zinc-900/95" />
        </div>
      )}

      {/* Chasis y Capas del Robot FocusBud */}
      <div className="w-full flex items-center justify-center relative z-10">
        <Avatar state={state} size={size} message="" />
      </div>
    </div>
  );
};

export default FocusBudWidget;
