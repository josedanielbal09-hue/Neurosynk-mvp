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
    auraGradient: string;
    shadowGlow: string;
    animClass: string;
    eyes: 'ojos_verdes.png' | 'ojos_ambar.png' | 'ojos_cansados.png';
    badgeColor: string;
  }
> = {
  ENFOQUE: {
    auraGradient: 'radial-gradient(circle, rgba(16, 185, 129, 0.45) 0%, rgba(16, 185, 129, 0.15) 50%, rgba(16, 185, 129, 0) 75%)',
    shadowGlow: '0 0 30px rgba(16, 185, 129, 0.50)',
    animClass: styles.animateFocus,
    eyes: 'ojos_verdes.png',
    badgeColor: 'border-emerald-500/50 text-emerald-300 bg-emerald-950/70',
  },
  CELEBRACION: {
    auraGradient: 'radial-gradient(circle, rgba(52, 211, 153, 0.65) 0%, rgba(16, 185, 129, 0.25) 55%, rgba(16, 185, 129, 0) 80%)',
    shadowGlow: '0 0 45px rgba(52, 211, 153, 0.75)',
    animClass: styles.animateCelebration,
    eyes: 'ojos_verdes.png',
    badgeColor: 'border-emerald-400/70 text-emerald-100 bg-emerald-900/80',
  },
  ALERTA_SUAVE: {
    auraGradient: 'radial-gradient(circle, rgba(245, 158, 11, 0.50) 0%, rgba(245, 158, 11, 0.15) 50%, rgba(245, 158, 11, 0) 75%)',
    shadowGlow: '0 0 30px rgba(245, 158, 11, 0.45)',
    animClass: styles.animateAlert,
    eyes: 'ojos_ambar.png',
    badgeColor: 'border-amber-500/50 text-amber-300 bg-amber-950/70',
  },
  FATIGA: {
    auraGradient: 'radial-gradient(circle, rgba(249, 115, 22, 0.40) 0%, rgba(249, 115, 22, 0.12) 50%, rgba(249, 115, 22, 0) 75%)',
    shadowGlow: '0 0 25px rgba(249, 115, 22, 0.35)',
    animClass: styles.animateFatigue,
    eyes: 'ojos_cansados.png',
    badgeColor: 'border-orange-500/50 text-orange-300 bg-orange-950/70',
  },
  PARALISIS: {
    auraGradient: 'radial-gradient(circle, rgba(168, 85, 247, 0.45) 0%, rgba(168, 85, 247, 0.15) 50%, rgba(168, 85, 247, 0) 75%)',
    shadowGlow: '0 0 30px rgba(168, 85, 247, 0.40)',
    animClass: styles.animateFatigue,
    eyes: 'ojos_cansados.png',
    badgeColor: 'border-purple-500/50 text-purple-300 bg-purple-950/70',
  },
  PAUSA: {
    auraGradient: 'radial-gradient(circle, rgba(148, 163, 184, 0.30) 0%, rgba(148, 163, 184, 0.10) 50%, rgba(148, 163, 184, 0) 70%)',
    shadowGlow: '0 0 20px rgba(148, 163, 184, 0.25)',
    animClass: styles.animateFocus,
    eyes: 'ojos_cansados.png',
    badgeColor: 'border-slate-500/50 text-slate-300 bg-slate-900/80',
  },
};

export const Avatar: React.FC<AvatarProps> = React.memo(({ state, message, className = '', size = 320 }) => {
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // 1. Mensaje dinámico de Body Doubling
  useEffect(() => {
    if (message !== undefined) {
      setCurrentMessage(message || '');
    } else {
      setCurrentMessage(getRandomStateMessage(state));
    }
  }, [state, message]);

  // 2. Earcon de audio sintetizado WebAudio
  useEffect(() => {
    audioService.playStateSound(state);
  }, [state]);

  // 3. Parpadeo orgánico con doble parpadeo ocasional
  useEffect(() => {
    let blinkTimer: NodeJS.Timeout;
    let resetTimer: NodeJS.Timeout;

    const triggerBlinkCycle = () => {
      const randomInterval = Math.random() * 2200 + 2600;
      blinkTimer = setTimeout(() => {
        setIsBlinking(true);
        resetTimer = setTimeout(() => {
          setIsBlinking(false);
          // 25% de probabilidad de hacer un parpadeo doble rápido
          if (Math.random() < 0.25) {
            setTimeout(() => {
              setIsBlinking(true);
              setTimeout(() => {
                setIsBlinking(false);
                triggerBlinkCycle();
              }, 120);
            }, 100);
          } else {
            triggerBlinkCycle();
          }
        }, 140);
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
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative flex flex-col items-center justify-center p-2 select-none cursor-pointer transition-transform duration-300 ${isHovered ? 'scale-105' : 'scale-100'} ${className}`}
    >
      {/* Globo de Diálogo HUD Body Doubling */}
      {currentMessage && (
        <div className="relative mb-4 z-20 max-w-[280px] sm:max-w-sm animate-fadeIn transition-all duration-300">
          <div className={`backdrop-blur-xl border shadow-2xl rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-center tracking-wide leading-snug ${visuals.badgeColor}`}>
            {currentMessage}
          </div>
          <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-0 h-0 border-x-6 border-x-transparent border-t-6 border-t-zinc-900" />
        </div>
      )}

      {/* Contenedor del Robot FocusBud con aceleración GPU */}
      <div
        style={size ? { width: `${size}px`, height: `${size}px`, maxWidth: '100%' } : undefined}
        className="relative aspect-square flex items-center justify-center"
      >
        {/* Capa 0: Aura Lumínica Radial que respira y pulsa */}
        <div
          style={{
            background: visuals.auraGradient,
            transition: 'background 0.5s ease-in-out',
          }}
          className={`absolute inset-0 rounded-full pointer-events-none -z-10 ${styles.animateAura}`}
        />

        {/* Capa 1: Chasis animado proceduralmente con rebote vivo */}
        <div className={`relative w-full h-full flex items-center justify-center ${visuals.animClass}`}>
          {/* Base Cuerpo */}
          <img
            src={cuerpoImg}
            alt="FocusBud Robot Body"
            className="w-full h-full object-contain pointer-events-none select-none transition-[filter] duration-500 ease-in-out"
            style={{
              filter: `drop-shadow(${visuals.shadowGlow})`,
            }}
          />

          {/* Ojos Verdes */}
          <img
            src={ojosVerdesImg}
            alt="FocusBud Ojos Verdes"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none z-10 transition-opacity duration-300 ease-in-out ${
              visuals.eyes === 'ojos_verdes.png' && !isBlinking ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Ojos Ámbar */}
          <img
            src={ojosAmbarImg}
            alt="FocusBud Ojos Ámbar"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none z-10 transition-opacity duration-300 ease-in-out ${
              visuals.eyes === 'ojos_ambar.png' && !isBlinking ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Ojos Cansados */}
          <img
            src={ojosCansadosImg}
            alt="FocusBud Ojos Cansados"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none z-10 transition-opacity duration-300 ease-in-out ${
              visuals.eyes === 'ojos_cansados.png' && !isBlinking ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </div>
    </div>
  );
});

Avatar.displayName = 'Avatar';
