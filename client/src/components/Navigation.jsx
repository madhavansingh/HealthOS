import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Sparkles, Stethoscope, Zap, Upload } from 'lucide-react';

export default function Navigation() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navStyle = {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    height: 60,
    background: '#FFFFFF',
    borderBottom: scrolled ? '1px solid #E5EAF2' : '1px solid transparent',
    boxShadow: scrolled ? '0 1px 12px rgba(15,23,42,0.06)' : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 32px',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
  };

  return (
    <nav style={navStyle}>
      <div style={{ width: '100%', maxWidth: 1100, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo */}
        <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', userSelect: 'none' }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(79,70,229,0.3)',
          }}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <path d="M10 3L13.5 8H16.5L10 17L3.5 8H6.5L10 3Z" fill="white" opacity="0.95"/>
              <circle cx="10" cy="10.5" r="2.5" fill="white" opacity="0.4"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.4px', lineHeight: 1.1 }}>HealthOS</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#94A3B8', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Digital Twin</div>
          </div>
        </div>

        {/* Nav Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#F3F4F6', borderRadius: 9999, padding: '3px' }}>
          {[
            { to: '/twin', icon: Sparkles, label: 'Health Twin' },
            { to: '/doctor-copilot', icon: Stethoscope, label: 'Doctor Copilot' },
            { to: '/simulator', icon: Zap, label: 'Simulator' },
          ].map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 16px', borderRadius: 9999,
              fontSize: 13, fontWeight: isActive ? 600 : 500,
              color: isActive ? '#4F46E5' : '#64748B',
              textDecoration: 'none',
              background: isActive ? '#FFFFFF' : 'transparent',
              boxShadow: isActive ? '0 1px 4px rgba(15,23,42,0.08)' : 'none',
              border: isActive ? '1px solid #E5EAF2' : '1px solid transparent',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            })}>
              <Icon size={12} />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/onboarding')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 9999,
              fontSize: 13, fontWeight: 600,
              background: '#4F46E5', color: '#FFFFFF',
              border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              boxShadow: '0 2px 10px rgba(79,70,229,0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#4338CA'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#4F46E5'; }}
          >
            <Upload size={12} /> Upload Report
          </button>

          {/* Avatar */}
          <div
            onClick={() => navigate('/twin')}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(79,70,229,0.25)',
              fontFamily: "'Sora', sans-serif",
              userSelect: 'none',
            }}
          >
            HT
          </div>
        </div>
      </div>
    </nav>
  );
}
