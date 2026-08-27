import React, { useState, useEffect } from 'react';
import { FocusState, getRandomStateMessage } from '../config/avatarConfig';
import { audioService } from '../services/audioService';

import cuerpoImg from '../assets/cuerpo.png';
import ojosVerdesImg from '../assets/ojos_verdes.png';
import ojosAmbarImg from '../assets/ojos_ambar.png';
import ojosCansadosImg from '../assets/ojos_cansados.png';

export type { FocusState };
export type FocusBudState = FocusState;

export interface AvatarProps {
  state: FocusState;
  message?: string;
  className?: string;
  size?: number;
}

export const Avatar: React.FC<AvatarProps> = React.memo(({ state, message, className = '', size = 360 }) => {
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [currentMessage, setCurrentMessage] = useState<string>('');

  // 1. Selección dinámica de mensaje desde avatarConfig si no se provee por prop manual
  useEffect(() => {
    if (message !== undefined) {
      setCurrentMessage(message || '');
    } else {
      setCurrentMessage(getRandomStateMessage(state));
    }
  }, [state, message]);

  // 2. Emisión de earcon de audio sintetizado según el estado
  useEffect(() => {
    audioService.playStateSound(state);
  }, [state]);

  // 3. Temporizador de Parpadeo Natural Procedural (breves pulsos de 150ms cada 3.5s - 6s)
  useEffect(() => {
    let blinkTimer: NodeJS.Timeout;
    let resetTimer: NodeJS.Timeout;

    const triggerBlinkCycle = () => {
      const randomInterval = Math.random() * 2500 + 3500;
      blinkTimer = setTimeout(() => {
        setIsBlinking(true);
        resetTimer = setTimeout(() => {
          setIsBlinking(false);
          triggerBlinkCycle();
        }, 150);
      }, randomInterval);
    };

    triggerBlinkCycle();

    return () => {
      clearTimeout(blinkTimer);
      clearTimeout(resetTimer);
    };
  }, []);

  const getActiveEye = (focusState: FocusState): 'verdes' | 'ambar' | 'cansados' => {
    switch (focusState) {
      case 'ENFOQUE':
      case 'CELEBRACION':
        return 'verdes';
      case 'ALERTA_SUAVE':
        return 'ambar';
      case 'FATIGA':
      case 'PARALISIS':
      case 'PAUSA':
      default:
        return 'cansados';
    }
  };

  const getAuraStyles = (focusState: FocusState) => {
    switch (focusState) {
      case 'ENFOQUE':
        return 'bg-emerald-500/30';
      case 'ALERTA_SUAVE':
        return 'bg-amber-500/40 animate-pulse';
      case 'FATIGA':
        return 'bg-orange-500/30';
      case 'PARALISIS':
        return 'bg-purple-600/40';
      case 'CELEBRACION':
        return 'bg-green-400/50 animate-bounce';
      case 'PAUSA':
      default:
        return 'bg-slate-500/25';
    }
  };

  const activeEye = getActiveEye(state);
  const auraClass = getAuraStyles(state);

  return (
    <div className={`relative flex flex-col items-center justify-center w-full h-full p-4 select-none ${className}`}>
      {/* Estilos CSS Inline para Animaciones Procedurales */}
      <style>{`
        @keyframes floatBreathing {
          0%, 100% {
            transform: translateY(-5px);
          }
          50% {
            transform: translateY(5px);
          }
        }
        @keyframes hudFadeIn {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-breathing-float {
          animation: floatBreathing 4s ease-in-out infinite;
        }
        .animate-hud-fadeIn {
          animation: hudFadeIn 0.3s ease-out forwards;
        }
      `}</style>

      {/* Globo de Notificación HUD (Speech Bubble Body Doubling) */}
      {currentMessage && (
        <div className="relative mb-3 z-30 animate-hud-fadeIn">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/70 shadow-2xl rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-200 text-center max-w-xs sm:max-w-sm tracking-wide">
            {currentMessage}
          </div>
          {/* Apuntador del globo de diálogo */}
          <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-slate-900/90" />
        </div>
      )}

      {/* Robot Chassis Container (Animación de Flotación Procedural -5px a +5px en ciclo de 4s) */}
      <div
        style={size ? { width: `${size}px`, height: `${size}px`, maxWidth: '100%' } : undefined}
        className="relative w-full max-w-[380px] aspect-square animate-breathing-float flex items-center justify-center"
      >
        {/* Aura Ambient Glow */}
        <div
          className={`absolute inset-2 rounded-full filter blur-3xl transition-all duration-700 pointer-events-none opacity-60 ${auraClass}`}
        />

        {/* Capa 1: Base Cuerpo PNG (Fijo a opacity-100) */}
        <img
          src={cuerpoImg}
          alt="FocusBud Cuerpo Base"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-0 opacity-100 drop-shadow-[0_10px_25px_rgba(0,0,0,0.7)]"
        />

        {/* Capa 2a: Ojos Verdes (ENFOQUE / CELEBRACION) */}
        <img
          src={ojosVerdesImg}
          alt="FocusBud Ojos Verdes"
          className={`absolute inset-0 w-full h-full object-contain pointer-events-none z-10 transition-opacity duration-500 ease-in-out ${
            activeEye === 'verdes' && !isBlinking ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Capa 2b: Ojos Ámbar (ALERTA_SUAVE) */}
        <img
          src={ojosAmbarImg}
          alt="FocusBud Ojos Ámbar"
          className={`absolute inset-0 w-full h-full object-contain pointer-events-none z-10 transition-opacity duration-500 ease-in-out ${
            activeEye === 'ambar' && !isBlinking ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Capa 2c: Ojos Cansados (FATIGA / PARALISIS / PAUSA) */}
        <img
          src={ojosCansadosImg}
          alt="FocusBud Ojos Cansados"
          className={`absolute inset-0 w-full h-full object-contain pointer-events-none z-10 transition-opacity duration-500 ease-in-out ${
            activeEye === 'cansados' && !isBlinking ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    </div>
  );
});

Avatar.displayName = 'Avatar';
