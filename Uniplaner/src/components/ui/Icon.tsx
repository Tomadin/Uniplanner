interface IconProps {
  name: string;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

const PATHS: Record<string, React.ReactNode> = {
  home:      <><path d="M3 10.5L10 4l7 6.5V16a1 1 0 01-1 1h-3v-5H9v5H6a1 1 0 01-1-1v-4.5z"/></>,
  calendar:  <><rect x="3" y="4.5" width="14" height="13" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3"/></>,
  list:      <><path d="M7 5h10M7 10h10M7 15h10M3.5 5h.01M3.5 10h.01M3.5 15h.01"/></>,
  tree:      <><path d="M5 4v3a2 2 0 002 2h8M7 14v-5M12 14h3M12 9v5"/><circle cx="5" cy="4" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="7" cy="14" r="1.2"/><circle cx="15" cy="14" r="1.2"/></>,
  book:      <><path d="M4 4v12a1 1 0 001 1h11V4H5a1 1 0 00-1 1zM8 4v13M4 14h12"/></>,
  note:      <><path d="M5 3h7l3 3v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1zM12 3v3h3M7 10h6M7 13h6"/></>,
  plus:      <><path d="M10 4v12M4 10h12"/></>,
  check:     <><path d="M4 10.5l4 4 8-9"/></>,
  x:         <><path d="M5 5l10 10M15 5L5 15"/></>,
  clock:     <><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/></>,
  flag:      <><path d="M5 3v14M5 4h9l-2 3 2 3H5"/></>,
  chevRight: <><path d="M8 5l5 5-5 5"/></>,
  chevDown:  <><path d="M5 8l5 5 5-5"/></>,
  chevLeft:  <><path d="M12 5l-5 5 5 5"/></>,
  search:    <><circle cx="9" cy="9" r="5"/><path d="M13 13l3 3"/></>,
  filter:    <><path d="M3 5h14M6 10h8M9 15h2"/></>,
  sync:      <><path d="M4 7.5A6 6 0 0115 5M16 12.5A6 6 0 015 15M4 4v3h3M16 16v-3h-3"/></>,
  wifi:      <><path d="M2 7.5a12 12 0 0116 0M5 10.5a8 8 0 0110 0M7.5 13.5a4 4 0 015 0"/><circle cx="10" cy="16" r="0.8"/></>,
  wifiOff:   <><path d="M3 4l14 14M8.5 12a3 3 0 013-0.5M5 9a9 9 0 012-1.5M14 8.5a8 8 0 011.5 1"/><circle cx="10" cy="16" r="0.8"/></>,
  dots:      <><circle cx="5" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.3" fill="currentColor" stroke="none"/></>,
  pencil:    <><path d="M4 16l3-1 9-9-2-2-9 9-1 3zM12 5l2 2"/></>,
  trash:     <><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/></>,
  google:    <><path d="M17 10.2c0-.65-.06-1.28-.17-1.88H10v3.56h3.92c-.17.9-.68 1.67-1.45 2.18v1.82h2.35c1.37-1.27 2.18-3.13 2.18-5.68z" fill="#4285F4" stroke="none"/><path d="M10 17.5c1.96 0 3.61-.65 4.82-1.76l-2.35-1.82c-.65.44-1.49.7-2.47.7-1.9 0-3.5-1.28-4.08-3H3.47v1.87A7.5 7.5 0 0010 17.5z" fill="#34A853" stroke="none"/><path d="M5.92 11.62A4.5 4.5 0 015.68 10c0-.56.1-1.1.24-1.62V6.51H3.47A7.5 7.5 0 002.5 10c0 1.21.29 2.36.97 3.49l2.45-1.87z" fill="#FBBC04" stroke="none"/><path d="M10 5.46c1.07 0 2.03.37 2.79 1.09l2.09-2.09A7.5 7.5 0 0010 2.5a7.5 7.5 0 00-6.53 4.01l2.45 1.87C6.5 6.74 8.1 5.46 10 5.46z" fill="#EA4335" stroke="none"/></>,
  heart:     <><path d="M10 16.5s-6-3.5-6-8a3.5 3.5 0 016-2.5 3.5 3.5 0 016 2.5c0 4.5-6 8-6 8z"/></>,
  upload:    <><path d="M10 13V3M6 7l4-4 4 4M4 17h12"/></>,
};

export function Icon({ name, size = 20, stroke = 'currentColor', strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 20 20" fill="none"
      stroke={stroke} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
    >
      {PATHS[name] ?? null}
    </svg>
  );
}
