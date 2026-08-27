import React, { useState, useEffect } from 'react';
import { FocusState, getRandomStateMessage } from '../config/avatarConfig';
import { audioService } from '../services/audioService';
import styles from './Avatar.module.css';

import cuerpoImg from '../assets/cuerpo_clean2.png';
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

const STATE_VISUALS: Record<
  FocusState,
  {
    dropShadow: string;
    ambientGlow: string;
    animClass: string;
    eyes: 'ojos_verdes.png' | 'ojos_ambar.png' | 'ojos_cansados.png';
  }
> = {
  ENFOQUE: {
    dropShadow: 'drop-shadow(0 0 14px rgba(16, 185, 129, 0.45)) drop-shadow(0 0 32px rgba(16, 185, 129, 0.20))',
    ambientGlow: 'bg-emerald-500/15',
    animClass: styles.animateFocus,
    eyes: 'ojos_verdes.png',
  },
  CELEBRACION: {
    dropShadow: 'drop-shadow(0 0 20px rgba(52, 211, 153, 0.8)) drop-shadow(0 0 45px rgba(16, 185, 129, 0.45))',
    ambientGlow: 'bg-emerald-400/30',
    animClass: styles.animateCelebration,
    eyes: 'ojos_verdes.png',
  },
  ALERTA_SUAVE: {
    dropShadow: 'drop-shadow(0 0 16px rgba(245, 158, 11, 0.55)) drop-shadow(0 0 36px rgba(245, 158, 11, 0.25))',
    ambientGlow: 'bg-amber-500/20',
    animClass: styles.animateAlert,
    eyes: 'ojos_ambar.png',
  },
  FATIGA: {
    dropShadow: 'drop-shadow(0 0 12px rgba(249, 115, 22, 0.35)) drop-shadow(0 0 28px rgba(249, 115, 22, 0.15))',
    ambientGlow: 'bg-orange-500/15',
    animClass: styles.animateFatigue,
    eyes: 'ojos_cansados.png',
  },
  PARALISIS: {
    dropShadow: 'drop-shadow(0 0 15px rgba(168, 85, 247, 0.45)) drop-shadow(0 0 35px rgba(168, 85, 247, 0.20))',
    ambientGlow: 'bg-purple-600/20',
    animClass: styles.animateFatigue,
    eyes: 'ojos_cansados.png',
  },
  PAUSA: {
    dropShadow: 'drop-shadow(0 0 10px rgba(148, 163, 184, 0.25))',
    ambientGlow: 'bg-slate-500/10',
    animClass: styles.animateFocus,
    eyes: 'ojos_cansados.png',
  },
};

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

  const visuals = STATE_VISUALS[state] || STATE_VISUALS.ENFOQUE;

  return (
    <div className={`relative flex flex-col items-center justify-center w-full h-full p-4 select-none ${className}`}>
      {/* Estilos CSS Inline para Animaciones de Mensajes HUD */}
      <style>{`
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

      {/* Contenedor del Robot FocusBud */}
      <div
        style={size ? { width: `${size}px`, height: `${size}px`, maxWidth: '100%' } : undefined}
        className="relative w-full max-w-[380px] aspect-square flex items-center justify-center"
      >
        {/* Capa 0: Aura Atmosférica Orgánica desenfocada detrás */}
        <div
          style={{ filter: 'blur(50px)', transition: 'all 0.7s ease-in-out' }}
          className={`absolute inset-2 rounded-full pointer-events-none opacity-60 -z-10 ${visuals.ambientGlow}`}
        />

        {/* Capa 1: Chasis + Ojos animados juntos con Glow de contorno */}
        <div
          style={{ filter: visuals.dropShadow }}
          className={`relative w-full h-full flex items-center justify-center transition-[filter] duration-700 ${visuals.animClass}`}
        >
          {/* Base Cuerpo PNG Limpio */}
          <img
            src={cuerpoImg}
            alt="FocusBud Body"
            className="w-full h-full object-contain pointer-events-none select-none"
          />

          {/* Capa 2a: Ojos Verdes (ENFOQUE / CELEBRACION) */}
          <img
            src={ojosVerdesImg}
            alt="FocusBud Ojos Verdes"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none z-10 transition-opacity duration-500 ease-in-out ${
              visuals.eyes === 'ojos_verdes.png' && !isBlinking ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Capa 2b: Ojos Ámbar (ALERTA_SUAVE) */}
          <img
            src={ojosAmbarImg}
            alt="FocusBud Ojos Ámbar"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none z-10 transition-opacity duration-500 ease-in-out ${
              visuals.eyes === 'ojos_ambar.png' && !isBlinking ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Capa 2c: Ojos Cansados (FATIGA / PARALISIS / PAUSA) */}
          <img
            src={ojosCansadosImg}
            alt="FocusBud Ojos Cansados"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none z-10 transition-opacity duration-500 ease-in-out ${
              visuals.eyes === 'ojos_cansados.png' && !isBlinking ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </div>
    </div>
  );
});

Avatar.displayName = 'Avatar';
