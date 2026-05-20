import { useRef } from 'react';

interface DateInputProps {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  title?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
}

export function DateInput({ value, onChange, style, title, autoFocus, onKeyDown, onBlur }: DateInputProps) {
  const nativeRef = useRef<HTMLInputElement>(null);

  const display = value.length >= 10
    ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
    : '';

  const openPicker = () => {
    try { nativeRef.current?.showPicker(); } catch { /* no soportado */ }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <input
        type="text"
        readOnly
        value={display}
        placeholder="DD/MM/AAAA"
        title={title}
        autoFocus={autoFocus}
        onClick={openPicker}
        onKeyDown={e => {
          if (e.key === ' ') { e.preventDefault(); openPicker(); }
          onKeyDown?.(e);
        }}
        onBlur={onBlur}
        style={{ ...style, cursor: 'pointer' }}
      />
      <input
        ref={nativeRef}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        tabIndex={-1}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          opacity: 0, pointerEvents: 'none',
        }}
      />
    </div>
  );
}
