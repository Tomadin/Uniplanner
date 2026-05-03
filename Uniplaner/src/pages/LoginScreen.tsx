import { T } from '../design/tokens';
import { Icon } from '../components/ui/Icon';
import { SectionTitle } from '../components/ui/Misc';
import { useAuth } from '../auth/GoogleAuthProvider';

export function LoginScreen() {
  const { login } = useAuth();
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      backgroundImage: `radial-gradient(circle at 20% 20%, ${T.accentSoft} 0%, transparent 50%), radial-gradient(circle at 80% 80%, ${T.accentDim}33 0%, transparent 50%)`,
    }}>
      <div style={{
        background: T.surface, borderRadius: T.r4,
        padding: 44, maxWidth: 400, width: '100%',
        border: `1px solid ${T.line}`, boxShadow: T.shadowLg, textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, margin: '0 auto 18px',
          borderRadius: 18, background: T.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fontDisplay, fontSize: 34, color: '#FBFAF5', fontWeight: 500,
        }}>U</div>

        <SectionTitle size="lg" style={{ marginBottom: 8 }}>UniPlanner</SectionTitle>

        <div style={{
          fontSize: 14, color: T.inkSoft, fontFamily: T.fontDisplay,
          fontStyle: 'italic', marginBottom: 28, lineHeight: 1.5,
        }}>
          Tu espacio tranquilo para organizar<br/>la universidad y un poco más.
        </div>

        <button onClick={login} style={{
          width: '100%', padding: '12px 18px',
          background: T.surface, border: `1px solid ${T.line}`,
          borderRadius: T.rFull, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          fontSize: 14, fontFamily: T.fontUI, color: T.ink, fontWeight: 500,
        }}>
          <Icon name="google" size={18} strokeWidth={0} />
          Continuar con Google
        </button>

        <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 20, lineHeight: 1.5, fontFamily: T.fontUI }}>
          Tus datos se guardan en tu Google Drive.<br/>
          UniPlanner no tiene servidores propios.
        </div>
      </div>
    </div>
  );
}
