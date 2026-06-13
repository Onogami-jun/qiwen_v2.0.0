import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  onFinished: () => void;
}

const STAGES = ['init', 'logo', 'text', 'done'] as const;
type Stage = typeof STAGES[number];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinished }) => {
  const [stage, setStage] = useState<Stage>('init');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('正在初始化...');

  useEffect(() => {
    const timeline = [
      { delay: 100,  action: () => setStage('logo') },
      { delay: 600,  action: () => setStage('text') },
      { delay: 900,  action: () => { setProgress(30); setStatusText('加载数据库...'); } },
      { delay: 1400, action: () => { setProgress(60); setStatusText('初始化工作区...'); } },
      { delay: 1900, action: () => { setProgress(85); setStatusText('准备就绪...'); } },
      { delay: 2300, action: () => { setProgress(100); setStatusText('启动完成'); } },
      { delay: 2700, action: () => setStage('done') },
      { delay: 3100, action: () => onFinished() },
    ];

    const timers = timeline.map(({ delay, action }) => setTimeout(action, delay));
    return () => timers.forEach(clearTimeout);
  }, [onFinished]);

  return (
    <AnimatePresence>
      {stage !== 'done' && (
        <motion.div
          key="splash"
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#08080e',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Ambient background */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `
              radial-gradient(ellipse 60% 50% at 50% 40%, rgba(200,169,110,0.07) 0%, transparent 70%),
              radial-gradient(ellipse 40% 40% at 20% 80%, rgba(74,158,255,0.04) 0%, transparent 60%),
              radial-gradient(ellipse 40% 40% at 80% 20%, rgba(184,138,240,0.04) 0%, transparent 60%)
            `,
          }} />

          {/* Particle ring */}
          <ParticleRing active={stage !== 'init'} />

          {/* Logo */}
          <AnimatePresence>
            {stage !== 'init' && (
              <motion.div
                initial={{ scale: 0.3, opacity: 0, rotateY: -90 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                style={{ position: 'relative', marginBottom: 28 }}
              >
                {/* Glow ring */}
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute', inset: -16,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(200,169,110,0.25) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Logo box */}
                <div style={{
                  width: 88, height: 88,
                  background: 'linear-gradient(145deg, #d4b47a 0%, #a07840 40%, #6b4e28 100%)',
                  borderRadius: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 44,
                  fontFamily: '"Noto Serif SC", "STKaiti", serif',
                  color: '#fff',
                  boxShadow: '0 0 60px rgba(200,169,110,0.35), 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)',
                  position: 'relative',
                  letterSpacing: -2,
                }}>
                  文
                  {/* Shine */}
                  <motion.div
                    initial={{ x: -120, skewX: -20 }}
                    animate={{ x: 120 }}
                    transition={{ delay: 0.8, duration: 0.6, ease: 'easeOut' }}
                    style={{
                      position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0, width: 40,
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
                      transform: 'skewX(-20deg)',
                    }} />
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* App name */}
          <AnimatePresence>
            {stage === 'text' ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ textAlign: 'center', marginBottom: 48 }}
              >
                <div style={{
                  fontSize: 32, fontWeight: 300, letterSpacing: 8,
                  color: '#e8e6e0',
                  fontFamily: '"Noto Serif SC", serif',
                  marginBottom: 8,
                }}>
                  启 文
                </div>
                <div style={{
                  fontSize: 12, letterSpacing: '4px',
                  color: 'rgba(200,169,110,0.6)',
                  textTransform: 'uppercase',
                  fontWeight: 400,
                }}>
                  QIWEN STUDIO
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Progress bar */}
          <AnimatePresence>
            {stage === 'text' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                style={{ width: 200, textAlign: 'center' }}
              >
                <div style={{
                  height: 2, borderRadius: 1,
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden', marginBottom: 12,
                }}>
                  <motion.div
                    style={{ height: '100%', borderRadius: 1 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    initial={{ width: '0%' }}
                  >
                    <div style={{
                      height: '100%',
                      background: 'linear-gradient(90deg, #c8a96e, #e8c98e)',
                      boxShadow: '0 0 8px rgba(200,169,110,0.6)',
                    }} />
                  </motion.div>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(200,169,110,0.5)', letterSpacing: '0.5px' }}>
                  {statusText}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Version */}
          <div style={{
            position: 'absolute', bottom: 24,
            fontSize: 11, color: 'rgba(255,255,255,0.1)',
            letterSpacing: '1px',
          }}>
            v1.0.0
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Rotating particle ring
const ParticleRing: React.FC<{ active: boolean }> = ({ active }) => {
  const particles = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div style={{
      position: 'absolute', width: 280, height: 280,
      top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
    }}>
      {active && particles.map((i) => {
        const angle = (i / 12) * 360;
        const delay = i * 0.08;
        const size = i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1.5;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 0.6, 0.3, 0.6],
              scale: [0, 1, 0.8, 1],
              rotate: [angle, angle + 360],
            }}
            transition={{
              opacity: { duration: 2, delay, repeat: Infinity, ease: 'easeInOut' },
              scale: { duration: 0.5, delay },
              rotate: { duration: 12, repeat: Infinity, ease: 'linear' },
            }}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: size, height: size,
              borderRadius: '50%',
              background: i % 4 === 0 ? '#b88af0' : '#c8a96e',
              transformOrigin: '0 0',
              transform: `rotate(${angle}deg) translateX(120px) translateY(-${size / 2}px)`,
            }}
          />
        );
      })}
    </div>
  );
};
