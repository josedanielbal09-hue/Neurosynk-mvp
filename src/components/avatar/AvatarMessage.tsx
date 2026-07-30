import React from 'react';

export interface AvatarMessageProps {
  message: string | null;
  className?: string;
}

export const AvatarMessage: React.FC<AvatarMessageProps> = ({ message, className = '' }) => {
  if (!message) return null;

  return (
    <div className={`relative flex flex-col items-center justify-center z-30 transition-all duration-300 ${className}`}>
      <style>{`
        @keyframes avatarMessageFadeUp {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-avatar-message-up {
          animation: avatarMessageFadeUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Speech Bubble Container (Normalized rounded-xl, font-sans) */}
      <div className="relative px-4 py-2.5 max-w-xs bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-xl shadow-2xl shadow-black/70 text-zinc-100 font-sans font-medium text-xs sm:text-sm tracking-wide text-center animate-avatar-message-up select-none">
        {/* Top Pointer Indicator pointing UP to FocusBud above */}
        <div
          className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-900 border-l border-t border-zinc-700/80 rotate-45 shadow-sm"
          aria-hidden="true"
        />
        {message}
      </div>
    </div>
  );
};
