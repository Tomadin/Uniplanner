import { useState } from 'react';
import { T } from '../../design/tokens';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const SIZES = {
  sm: { padding: '6px 12px',  fontSize: 13, gap: 6,  iconSize: 14 },
  md: { padding: '9px 16px',  fontSize: 14, gap: 8,  iconSize: 16 },
  lg: { padding: '12px 22px', fontSize: 15, gap: 10, iconSize: 18 },
};
const VARIANTS: Record<Variant, { bg: string; fg: string; border: string; hoverBg: string }> = {
  primary:   { bg: T.accent,     fg: '#FBFAF5',    border: 'transparent', hoverBg: T.accentInk },
  secondary: { bg: T.surface,    fg: T.ink,        border: T.line,        hoverBg: T.bgAlt },
  ghost:     { bg: 'transparent',fg: T.ink,        border: 'transparent', hoverBg: T.bgAlt },
  soft:      { bg: T.accentSoft, fg: T.accentInk,  border: 'transparent', hoverBg: T.accentDim },
  danger:    { bg: T.dangerSoft, fg: T.danger,     border: 'transparent', hoverBg: T.danger + '22' },
};

interface ButtonProps {
  children?: React.ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconRight?: string;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  type?: 'button' | 'submit';
}

export function Button({ children, variant = 'primary', size = 'md', icon, iconRight, onClick, disabled, style, type = 'button' }: ButtonProps) {
  const [hover, setHover] = useState(false);
  const s = SIZES[size], v = VARIANTS[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: s.gap,
        padding: s.padding, fontSize: s.fontSize, fontWeight: 500, letterSpacing: 0.1,
        fontFamily: T.fontUI,
        background: hover && !disabled ? v.hoverBg : v.bg,
        color: v.fg,
        border: `1px solid ${v.border}`,
        borderRadius: T.rFull,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 150ms ease', whiteSpace: 'nowrap',
        ...style,
      }}>
      {icon && <Icon name={icon} size={s.iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={s.iconSize} />}
    </button>
  );
}

export function IconButton({ icon, onClick, title, size = 32, style }: {
  icon: string; onClick?: () => void; title?: string; size?: number; style?: React.CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? T.bgAlt : 'transparent', border: 'none',
        borderRadius: T.rFull, color: T.ink, cursor: 'pointer',
        transition: 'background 150ms ease', flexShrink: 0,
        ...style,
      }}>
      <Icon name={icon} size={size * 0.55} />
    </button>
  );
}

export function Checkbox({ checked, onChange, size = 20 }: {
  checked: boolean; onChange?: (v: boolean) => void; size?: number;
}) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onChange?.(!checked); }}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: checked ? T.accent : 'transparent',
        border: `1.5px solid ${checked ? T.accent : T.line}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 0, transition: 'all 150ms ease', flexShrink: 0,
      }}>
      {checked && (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 20 20" fill="none"
          stroke="#FBFAF5" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 10.5l4 4 8-9"/>
        </svg>
      )}
    </button>
  );
}
