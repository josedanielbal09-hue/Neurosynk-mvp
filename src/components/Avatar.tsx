import React from 'react';
import styles from './Avatar.module.css';

import cuerpoImg from '../assets/cuerpo.png';
import ojosVerdesImg from '../assets/ojos_verdes.png';
import ojosAmbarImg from '../assets/ojos_ambar.png';
import ojosCansadosImg from '../assets/ojos_cansados.png';

import { FocusState } from '../config/avatarConfig';

export type { FocusState };
export type FocusBudState = FocusState;

interface AvatarProps {
  state: FocusState;
  className?: string;
}

export const Avatar = React.memo<AvatarProps>(({ state, className = '' }) => {
  const getStateConfig = () => {
    switch (state) {
      case 'ENFOQUE':
        return {
          primary: '#22c55e',      // Emerald Green
          secondary: '#4ade80',    // Soft Green
          glow: 'rgba(34, 197, 94, 0.45)',
          badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          label: 'FLUJO OPTIMO (ENFOQUE)',
          activeEye: 'verdes' as const,
        };
      case 'ALERTA_SUAVE':
        return {
          primary: '#f59e0b',      // Amber
          secondary: '#fbbf24',    // Bright Amber
          glow: 'rgba(245, 158, 11, 0.55)',
          badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          label: 'ALERTA: DESVIACION DETECTADA',
          activeEye: 'ambar' as const,
        };
      case 'FATIGA':
        return {
          primary: '#818cf8',      // Indigo / Soft Purple
          secondary: '#a78bfa',    // Soft Violet
          glow: 'rgba(129, 140, 248, 0.4)',
          badgeBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
          label: 'FATIGA O SOBRECARGA DETECTADA',
          activeEye: 'cansados' as const,
        };
      case 'PARALISIS':
        return {
          primary: '#f43f5e',      // Rose / Crimson
          secondary: '#fb7185',    // Soft Red
          glow: 'rgba(244, 63, 94, 0.65)',
          badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30 border-dashed animate-pulse',
          label: 'BLOQUEO / PARALISIS COGNITIVA',
          activeEye: 'cansados' as const,
        };
      case 'CELEBRACION':
        return {
          primary: '#06b6d4',      // Cyan / Bright Blue
          secondary: '#38bdf8',
          glow: 'rgba(6, 182, 212, 0.65)',
          badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-bold animate-bounce',
          label: '¡OBJETIVO CUMPLIDO! (CELEBRACION)',
          activeEye: 'verdes' as const,
        };
      case 'PAUSA':
        return {
          primary: '#64748b',      // Slate / Muted
          secondary: '#94a3b8',
          glow: 'rgba(100, 116, 139, 0.3)',
          badgeBg: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
          label: 'MODO PAUSA / DESCANSO',
          activeEye: 'cansados' as const,
        };
    }
  };

  const config = getStateConfig();
  const animationClass = styles[`state${state}`] || styles.stateENFOQUE;

  return (
    <div className={`relative flex flex-col items-center justify-center w-full h-full p-6 select-none ${className}`}>
      
      {/* Background Ambient Glow aura */}
      <div 
        className="absolute w-72 h-72 rounded-full filter blur-3xl transition-all duration-700 pointer-events-none opacity-30"
        style={{ backgroundColor: config.primary }}
      />

      {/* Main FocusBud Avatar PNG Layers Container */}
      <div className={`relative w-64 h-64 sm:w-72 sm:h-72 transition-all duration-500 ${styles.avatarContainer} ${animationClass}`}>
        
        {/* Layer 1: Body (Cuerpo PNG) */}
        <img 
          src={cuerpoImg} 
          alt="FocusBud Cuerpo Base"
          className={`absolute inset-0 w-full h-full object-contain pointer-events-none drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)] z-0 ${styles.layerCuerpo}`}
        />

        {/* Layer 2a: Eyes Verdes Layer */}
        <img 
          src={ojosVerdesImg} 
          alt="FocusBud Ojos Verdes"
          className={`absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-300 ease-in-out z-10 ${styles.layerOjos} ${
            config.activeEye === 'verdes' ? 'opacity-100' : 'opacity-0'
          } ${state === 'ENFOQUE' || state === 'CELEBRACION' ? styles.proceduralBlink : ''}`}
        />

        {/* Layer 2b: Eyes Ambar Layer */}
        <img 
          src={ojosAmbarImg} 
          alt="FocusBud Ojos Ambar"
          className={`absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-300 ease-in-out z-10 ${styles.layerOjos} ${
            config.activeEye === 'ambar' ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Layer 2c: Eyes Cansados Layer */}
        <img 
          src={ojosCansadosImg} 
          alt="FocusBud Ojos Cansados"
          className={`absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-300 ease-in-out z-10 ${styles.layerOjos} ${
            config.activeEye === 'cansados' ? 'opacity-100' : 'opacity-0'
          }`}
        />

      </div>

      {/* FocusBud State Badge */}
      <div className={`mt-4 px-4 py-1.5 rounded-full border font-mono text-xs tracking-wider uppercase backdrop-blur-md shadow-lg transition-all duration-300 z-20 ${config.badgeBg}`}>
        {config.label}
      </div>
    </div>
  );
});
