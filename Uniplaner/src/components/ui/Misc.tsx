import { T } from '../../design/tokens';

export function Card({ children, style, onClick, padding = 20 }: {
  children: React.ReactNode; style?: React.CSSProperties;
  onClick?: () => void; padding?: number;
}) {
  return (
    <div onClick={onClick} style={{
      background: T.surface, border: `1px solid ${T.line}`,
      borderRadius: T.r3, padding, cursor: onClick ? 'pointer' : 'default', ...style,
    }}>{children}</div>
  );
}

export function SectionTitle({ children, size = 'md', style }: {
  children: React.ReactNode; size?: 'sm'|'md'|'lg'|'xl'; style?: React.CSSProperties;
}) {
  const sizes = { sm: 18, md: 22, lg: 28, xl: 36 };
  return (
    <h2 style={{
      fontFamily: T.fontDisplay, fontWeight: 400, color: T.ink,
      margin: 0, letterSpacing: -0.3, fontSize: sizes[size], ...style,
    }}>{children}</h2>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: 0.8,
      textTransform: 'uppercase', color: T.inkMuted, fontFamily: T.fontUI, ...style,
    }}>{children}</div>
  );
}

export function Avatar({ name = '?', size = 32 }: { name?: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: T.accent, color: '#FBFAF5',
      fontSize: size * 0.42, fontWeight: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: T.fontUI, flexShrink: 0,
    }}>{name.charAt(0).toUpperCase()}</div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      padding: '24px 8px', textAlign: 'center',
      color: T.inkMuted, fontFamily: T.fontDisplay,
      fontStyle: 'italic', fontSize: 15,
    }}>{text}</div>
  );
}
