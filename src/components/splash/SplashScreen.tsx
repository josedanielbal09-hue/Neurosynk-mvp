import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Avatar } from '../Avatar';

interface SplashScreenProps {
  onComplete?: () => void;
  duration?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  duration = 2500,
}) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [mascotExpression, setMascotExpression] = useState<'normal' | 'blink' | 'happy'>('normal');

  useEffect(() => {
    const intervalTime = 25;
    const step = 100 / (duration / intervalTime);

    const timer = setInterval(() => {
      setLoadingProgress((prev) => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(timer);
          setMascotExpression('happy');
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 600);
          return 100;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [duration, onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        key="splash-screen"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, y: -50, transition: { duration: 0.5, ease: 'easeInOut' } }}
        className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col items-center justify-center select-none"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-900">
          <motion.div
            className="h-full bg-green-500 shadow-[0_0_10px_#22c55e]"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: [0.8, 1.05, 1],
            opacity: 1,
            y: [0, -4, 0],
          }}
          transition={{
            scale: { duration: 0.6, ease: 'easeOut' },
            opacity: { duration: 0.4 },
            y: { repeat: Infinity, duration: 4, ease: 'easeInOut' },
          }}
          className="flex flex-col items-center gap-6"
        >
          <div className="w-[130px] h-[130px] flex items-center justify-center">
            <Avatar state="ENFOQUE" />
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <span className="font-mono text-xs tracking-[0.25em] text-green-500 uppercase font-semibold animate-pulse">
              Conectando Enlaces...
            </span>
            <span className="font-mono text-[10px] text-zinc-600 tracking-wider">
              {Math.round(loadingProgress)}%
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
