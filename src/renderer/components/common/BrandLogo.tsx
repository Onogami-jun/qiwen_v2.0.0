import React from 'react';
import { motion } from 'framer-motion';

interface BrandLogoProps {
  size?: number;
  variant?: 'dark' | 'light' | 'color';
  animate?: boolean;
  showText?: boolean;
  showSlogan?: boolean;
  className?: string;
}

/**
 * 启文官方商标组件
 * 还原：书本 + 毛笔 + 橙色笔锋 + 火花
 * Slogan: 启于思，行于文
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 48,
  variant = 'dark',
  animate = false,
  showText = false,
  showSlogan = false,
}) => {
  const isDark = variant === 'dark';
  const isColor = variant === 'color';

  const bookColor    = isDark ? 'rgba(255,255,255,0.9)' : '#1B4F8C';
  const bookFill     = isDark ? 'rgba(255,255,255,0.08)' : '#EBF2FB';
  const spineColor   = isDark ? 'rgba(255,255,255,0.3)'  : 'rgba(27,79,140,0.3)';
  const pageColor    = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(27,79,140,0.05)';
  const brushColor   = isDark ? 'rgba(255,255,255,0.85)' : '#1B4F8C';
  const tipMain      = '#E8A020';
  const tipLight     = '#F4B830';
  const sparkColor   = '#FFCE55';
  const textColor    = isDark ? '#FFFFFF' : '#1B4F8C';
  const sloganColor  = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(27,79,140,0.45)';

  const logoEl = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 书本外框 */}
      <rect x="18" y="14" width="50" height="66" rx="6"
        fill={bookFill} stroke={bookColor} strokeWidth="2.5"/>

      {/* 书页区域（左半） */}
      <rect x="25" y="14" width="22" height="66" rx="0"
        fill={pageColor}/>

      {/* 书脊线 */}
      <line x1="25" y1="16" x2="25" y2="78"
        stroke={spineColor} strokeWidth="1.5"/>

      {/* 书页内容线条（装饰） */}
      <rect x="30" y="26" width="13" height="2" rx="1" fill={bookColor} opacity="0.25"/>
      <rect x="30" y="32" width="20" height="2" rx="1" fill={bookColor} opacity="0.15"/>
      <rect x="30" y="38" width="16" height="2" rx="1" fill={bookColor} opacity="0.15"/>
      <rect x="30" y="44" width="19" height="2" rx="1" fill={bookColor} opacity="0.12"/>
      <rect x="30" y="50" width="14" height="2" rx="1" fill={bookColor} opacity="0.1"/>

      {/* 毛笔杆 */}
      <line x1="52" y1="78" x2="82" y2="20"
        stroke={brushColor} strokeWidth="2.8" strokeLinecap="round"/>

      {/* 笔头竹节 */}
      <circle cx="55.5" cy="74" r="2.5" fill={brushColor} opacity="0.4"/>

      {/* 毛笔锋（橙色） */}
      <path d="M47 86 Q53 78 59 74 L56 71 Q51 74 45 84 Z"
        fill={tipMain}/>
      <path d="M47 86 Q50 82 53 79 L51 77 Q48 80 46 85 Z"
        fill={tipLight}/>

      {/* 墨迹落点 */}
      <ellipse cx="44" cy="88" rx="4" ry="2.5"
        fill={tipMain} opacity="0.45" transform="rotate(-15 44 88)"/>

      {/* 火花 · 大 */}
      <circle cx="78" cy="15" r="3.5" fill={sparkColor}/>
      {/* 火花 · 中 */}
      <circle cx="85" cy="23" r="2.2" fill={sparkColor} opacity="0.65"/>
      {/* 火花 · 小 */}
      <circle cx="73" cy="10" r="1.8" fill={sparkColor} opacity="0.45"/>
    </svg>
  );

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {animate ? (
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {logoEl}
        </motion.div>
      ) : logoEl}

      {showText && (
        <div style={{
          fontFamily: '"Noto Serif SC", "STKaiti", serif',
          fontSize: size * 0.35,
          fontWeight: 700,
          color: textColor,
          letterSpacing: size * 0.08,
          lineHeight: 1.2,
          marginTop: 4,
        }}>
          启文
        </div>
      )}

      {showSlogan && (
        <div style={{
          fontFamily: '"Noto Sans SC", sans-serif',
          fontSize: size * 0.18,
          color: sloganColor,
          letterSpacing: size * 0.04,
          marginTop: showText ? 2 : 4,
          whiteSpace: 'nowrap',
        }}>
          启于思，行于文
        </div>
      )}
    </div>
  );
};

export default BrandLogo;
