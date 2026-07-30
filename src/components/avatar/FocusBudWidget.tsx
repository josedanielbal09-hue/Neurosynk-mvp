import React, { useEffect } from 'react';
import { Avatar, FocusBudState } from '../Avatar';
import { AvatarMessage } from './AvatarMessage';
import { audioService } from '../../services/audioService';

export interface FocusBudWidgetProps {
  state: FocusBudState;
  message?: string | null;
  className?: string;
}

/**
 * FocusBudWidget: Black Box Pattern Component
 * Encapsula la UI de FocusBud, el bocadillo flotante AvatarMessage
 * y la reproducción de audioService al cambiar de estado biométrico.
 */
export const FocusBudWidget: React.FC<FocusBudWidgetProps> = ({
  state,
  message,
  className = '',
}) => {
  // Reproducción automática de sonido al cambiar de estado biométrico
  useEffect(() => {
    if (state) {
      audioService.playStateSound(state);
    }
  }, [state]);

  return (
    <div className={`relative w-64 h-64 sm:w-80 sm:h-80 max-w-full flex items-center justify-center p-2 select-none ${className}`}>
      {/* 1. FocusBud Robot Avatar */}
      <div className="w-full h-full flex items-center justify-center relative z-10">
        <Avatar state={state} />
      </div>

      {/* 2. Bocadillo de Mensaje Flotante (Ranura dedicada con espacio de seguridad) */}
      {message && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-full max-w-[90%] flex justify-center">
          <AvatarMessage message={message} />
        </div>
      )}
    </div>
  );
};

export default FocusBudWidget;
