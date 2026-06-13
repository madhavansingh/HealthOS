import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles, CheckCircle, ShieldAlert, ArrowRight, Upload,
  Stethoscope, Zap, TrendingUp, TrendingDown
} from 'lucide-react';
import { getHealthTwin } from '../api/client';

/* ── Utilities ────────────────────────────────────────────────────────────── */
const scoreColor = (s) => s >= 80 ? '#10B981' : s >= 60 ? '#F59E0B' : '#EF4444';
const statusColor = { low: '#3B82F6', high: '#F59E0B', critical_low: '#EF4444', critical_high: '#EF4444', normal: '#10B981' };
const statusLabel = { low: 'Low', high: 'High', critical_low: 'Critical', critical_high: 'Critical', normal: 'Normal' };

const fadeUp = {
  hidden:  { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };
const IV = { once: true, amount: 0.15 };

/* ── Score Pillar (light) ─────────────────────────────────────────────────── */
function ScorePillar({ label, value, color }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => {
    const target = value || 0;
    let cur = 0;
    const step = () => { cur = Math.min(cur + 2, target); setAnim(cur); if (cur < target) requestAnimationFrame(step); };
    const t = setTimeout(() => requestAnimationFrame(step), 400);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 32, height: 72, borderRadius: 7, background: '#F1F5F9', position: 'relative', overflow: 'hidden', border: '1px solid #E5EAF2' }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${anim}%`, background: color, borderRadius: 6, transition: 'height 0.1s ease', opacity: 0.85 }} />
      </div>
      <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 13.5, fontWeight: 800, color, letterSpacing: '-0.5px' }}>{anim}</div>
      <div style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: 600, letterSpacing: '0.3px', textAlign: 'center', maxWidth: 50 }}>{label}</div>
    </div>
  );
}

/* ── Health Score Ring ────────────────────────────────────────────────────── */
function ScoreRing({ score, bioAge, chronAge }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => {
    const target = score || 0;
    let cur = 0;
    const step = () => { cur = Math.min(cur + 1, target); setAnim(cur); if (cur < target) requestAnimationFrame(step); };
    const t = setTimeout(() => requestAnimationFrame(step), 300);
    return () => clearTimeout(t);
  }, [score]);

  const r    = 70;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - anim / 100);
  const col  = scoreColor(anim);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg width="176" height="176" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="88" cy="88" r={r} fill="none" stroke="#F1F5F9" strokeWidth="9" />
        <circle cx="88" cy="88" r={r} fill="none" stroke={col}
          strokeWidth="9" strokeDasharray={circ} strokeDashoffset={dash}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.05s linear, stroke 0.4s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 44, fontWeight: 800, color: col, lineHeight: 1, letterSpacing: '-0.04em' }}>{anim}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginTop: 2 }}>Health Score</div>
        {bioAge && (
          <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, color: bioAge < (chronAge || 30) ? '#10B981' : '#F59E0B' }}>
            Bio Age: {bioAge}
            {bioAge < (chronAge || 30) ? ' ↓ Younger' : ' ↑ Older'}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Watchlist Item ───────────────────────────────────────────────────────── */
function WatchlistItem({ name, value, unit, status, trend, guidance }) {
  const [open, setOpen] = useState(false);
  const sc = statusColor[status] || '#F59E0B';
  const sl = statusLabel[status] || 'Review';
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${sc}20`, background: '#FFFFFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          {value != null && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>{value} {unit}</div>}
        </div>
        <span style={{ padding: '3px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 700, color: sc, background: `${sc}12`, border: `1px solid ${sc}25`, flexShrink: 0 }}>{sl}</span>
      </button>
      {open && guidance && (
        <div style={{ padding: '10px 14px 13px 30px', borderTop: `1px solid ${sc}15`, fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
          {guidance}
        </div>
      )}
    </div>
  );
}

/* ── Strength Item ────────────────────────────────────────────────────────── */
function StrengthItem({ text }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 0', borderBottom: '1px solid #F1F5F9' }}>
      <CheckCircle size={14} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.55 }}>{text}</span>
    </div>
  );
}

/* ── Empty State ──────────────────────────────────────────────────────────── */
function EmptyState({ navigate }) {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 440, textAlign: 'center' }}
      >
        <div style={{ width: 72, height: 72, borderRadius: 20, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Sparkles size={28} color="#4F46E5" />
        </div>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 24, fontWeight: 800, color: '#0F172A', marginBottom: 12, letterSpacing: '-0.03em' }}>
          Your Health Twin awaits.
        </h2>
        <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.7, marginBottom: 28 }}>
          Upload your first medical report. HealthOS will extract every health metric and build your personalised Health Twin in under 60 seconds.
        </p>
        <button onClick={() => navigate('/onboarding')} className="btn-primary">
          <Upload size={14} /> Upload My First Report <ArrowRight size={13} />
        </button>
        <div style={{ marginTop: 18, fontSize: 12.5, color: '#94A3B8' }}>
          Supported: Blood reports, vitamin panels, thyroid, lipid profiles, prescriptions
        </div>
      </motion.div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function HealthTwinReveal() {
  const navigate = useNavigate();
  const [loading, setLoading]    = useState(true);
  const [twinData, setTwinData]  = useState(null);

  useEffect(() => {
    let active = true;
    getHealthTwin()
      .then(data => { if (!active) return; setTwinData(data); setLoading(false); })
      .catch(() => setLoading(false));
    return () => { active = false; };
  }, []);

  /* Loading */
  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #E5EAF2', borderTopColor: '#4F46E5', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 14, color: '#94A3B8' }}>Loading your Health Twin…</div>
      </div>
    );
  }

  /* No data */
  const hasData = twinData && (twinData.overallScore > 0 || (twinData.biomarkers && twinData.biomarkers.length > 0));
  if (!hasData) return <EmptyState navigate={navigate} />;

  /* Derived values */
  const score       = twinData.overallScore || 0;
  const bioAge      = twinData.biologicalAge;
  const chronAge    = twinData.chronologicalAge;
  const story       = twinData.healthStory || '';
  const pillars     = twinData.pillars || {};
  const biomarkers  = twinData.biomarkers || [];
  const abnormal    = biomarkers.filter(b => b.status !== 'normal');
  const normal      = biomarkers.filter(b => b.status === 'normal');
  const strengths   = twinData.strengths || normal.slice(0, 5).map(b => `${b.name} is within healthy range (${b.value} ${b.unit || ''})`);
  const watchlist   = abnormal.slice(0, 6);

  const PILLARS_DEF = [
    { key: 'cardiovascular', label: 'Heart', color: '#EF4444' },
    { key: 'metabolic',      label: 'Metabolic', color: '#F59E0B' },
    { key: 'nutritional',    label: 'Nutrition', color: '#10B981' },
    { key: 'thyroid',        label: 'Thyroid', color: '#6366F1' },
    { key: 'immune',         label: 'Immunity', color: '#8B5CF6' },
    { key: 'hepatic',        label: 'Liver', color: '#3B82F6' },
  ].filter(p => pillars[p.key] != null);

  return (
    <div style={{ background: '#F8FAFC', fontFamily: 'var(--font-body)' }}>

      {/* ── SECTION 1: Score Hero ──────────────────────────────────────────── */}
      <section style={{ background: '#FFFFFF', padding: '48px 0 0' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 32px' }}>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.div variants={fadeUp} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4F46E5', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Your Digital Health Twin
              </div>
            </motion.div>
            <motion.h1 variants={fadeUp} style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.04em', color: '#0F172A', marginBottom: 8, lineHeight: 1.15 }}>
              Health Overview
            </motion.h1>

            {/* Score + pillars row */}
            <motion.div variants={fadeUp} style={{ display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap', paddingBottom: 40, marginTop: 32 }}>
              <div style={{ flexShrink: 0 }}>
                <ScoreRing score={score} bioAge={bioAge} chronAge={chronAge} />
              </div>

              {/* Pillars */}
              {PILLARS_DEF.length > 0 && (
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 16 }}>Health Pillars</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {PILLARS_DEF.map(p => <ScorePillar key={p.key} label={p.label} value={pillars[p.key]} color={p.color} />)}
                  </div>
                </div>
              )}

              {/* Quick stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 180 }}>
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', border: '1px solid #E5EAF2' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Biomarkers</div>
                  <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 26, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{biomarkers.length}</div>
                  <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>metrics tracked</div>
                </div>
                <div style={{ background: abnormal.length > 0 ? '#FFFBEB' : '#ECFDF5', borderRadius: 12, padding: '14px 16px', border: `1px solid ${abnormal.length > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Watchlist</div>
                  <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 26, fontWeight: 800, color: abnormal.length > 0 ? '#D97706' : '#059669', lineHeight: 1 }}>{abnormal.length}</div>
                  <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>need attention</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Section nav tabs */}
        <div style={{ borderTop: '1px solid #E5EAF2' }}>
          <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 0 }}>
            {['Strengths', 'Watchlist', 'Health Story', 'Biomarkers'].map((tab, i) => (
              <a key={tab} href={`#section-${i}`} style={{ padding: '13px 20px', fontSize: 13, fontWeight: 600, color: '#64748B', textDecoration: 'none', borderBottom: '2px solid transparent', transition: 'all 0.15s ease', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#4F46E5'; e.currentTarget.style.borderBottomColor = '#4F46E5'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderBottomColor = 'transparent'; }}
              >
                {tab}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: Strengths ──────────────────────────────────────────── */}
      <section id="section-0" style={{ background: '#F8FAFC', padding: '48px 0' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          {/* Strengths */}
          <motion.div initial="hidden" whileInView="visible" viewport={IV} variants={stagger}>
            <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#10B981', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>Strengths</div>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em' }}>What's working well</h2>
            </motion.div>
            <motion.div variants={fadeUp} style={{ background: '#FFFFFF', borderRadius: 16, padding: '8px 20px', border: '1px solid #E5EAF2', boxShadow: '0 2px 10px rgba(15,23,42,0.05)' }}>
              {strengths.length > 0
                ? strengths.slice(0, 6).map((s, i) => <StrengthItem key={i} text={typeof s === 'string' ? s : s.text || s} />)
                : <div style={{ padding: '20px 0', fontSize: 14, color: '#94A3B8', textAlign: 'center' }}>Upload a report to see your strengths.</div>
              }
            </motion.div>
          </motion.div>

          {/* Watchlist */}
          <motion.div id="section-1" initial="hidden" whileInView="visible" viewport={IV} variants={stagger}>
            <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#F59E0B', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>Watchlist</div>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em' }}>Needs attention</h2>
            </motion.div>
            <motion.div variants={fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {watchlist.length > 0
                ? watchlist.map((b, i) => <WatchlistItem key={i} name={b.name} value={b.value} unit={b.unit} status={b.status} guidance={b.guidance || b.aiAnalysis} />)
                : <div style={{ background: '#ECFDF5', borderRadius: 14, padding: '24px', textAlign: 'center', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <CheckCircle size={24} color="#10B981" style={{ margin: '0 auto 10px' }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>All values in healthy range</div>
                  </div>
              }
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 3: Health Story ───────────────────────────────────────── */}
      {story && (
        <section id="section-2" style={{ background: '#FFFFFF', padding: '48px 0' }}>
          <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 32px', display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 40, alignItems: 'start' }}>
            <motion.div initial="hidden" whileInView="visible" viewport={IV} variants={stagger}>
              <motion.div variants={fadeUp}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4F46E5', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>Health Story</div>
                <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 12 }}>
                  What your reports say about you
                </h2>
                <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7 }}>
                  AI-generated clinical narrative from your health data. Always verify with your doctor.
                </p>
              </motion.div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={IV}
              transition={{ duration: 0.5 }}
              style={{ background: '#F8FAFC', borderRadius: 16, padding: '24px 26px', border: '1px solid #E5EAF2', fontSize: 14.5, color: '#334155', lineHeight: 1.8, borderLeft: '3px solid #4F46E5' }}
            >
              {story}
            </motion.div>
          </div>
        </section>
      )}

      {/* ── SECTION 4: Biomarkers table ───────────────────────────────────── */}
      {biomarkers.length > 0 && (
        <section id="section-3" style={{ background: '#F8FAFC', padding: '48px 0 64px' }}>
          <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 32px' }}>
            <motion.div initial="hidden" whileInView="visible" viewport={IV} variants={stagger}>
              <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4F46E5', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>Biomarkers</div>
                <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em' }}>All tracked metrics</h2>
              </motion.div>
              <motion.div variants={fadeUp} style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5EAF2', overflow: 'hidden', boxShadow: '0 2px 12px rgba(15,23,42,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E5EAF2' }}>
                      {['Biomarker', 'Value', 'Reference Range', 'Status', 'Trend'].map(h => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.4px', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {biomarkers.slice(0, 20).map((b, i) => {
                      const sc = statusColor[b.status] || '#10B981';
                      const sl = statusLabel[b.status] || 'Normal';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#FAFBFD'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: '#0F172A' }}>{b.name}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: sc }}>{b.value} {b.unit || ''}</td>
                          <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#94A3B8' }}>{b.referenceRange || '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '3px 9px', borderRadius: 9999, fontSize: 11.5, fontWeight: 700, color: sc, background: `${sc}12`, border: `1px solid ${sc}25` }}>{sl}</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#94A3B8' }}>
                            {b.trend === 'up' ? <TrendingUp size={14} color="#F59E0B" /> : b.trend === 'down' ? <TrendingDown size={14} color="#10B981" /> : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── SECTION 5: Action links ───────────────────────────────────────── */}
      <section style={{ background: '#EEF4FF', padding: '48px 0 56px' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4F46E5', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 20 }}>Next Steps</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {[
              { icon: Stethoscope, color: '#4F46E5', bg: '#EEF2FF', label: 'Doctor Copilot', sub: 'Questions & visit brief', to: '/doctor-copilot' },
              { icon: Zap, color: '#F59E0B', bg: '#FFFBEB', label: 'Future Simulator', sub: 'Predict health outcomes', to: '/simulator' },
              { icon: Upload, color: '#10B981', bg: '#ECFDF5', label: 'Add Another Report', sub: 'Expand your twin', to: '/onboarding' },
            ].map(({ icon: Icon, color, bg, label, sub, to }) => (
              <button key={to} onClick={() => navigate(to)} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '18px 20px', borderRadius: 16, background: '#FFFFFF', border: '1px solid #E5EAF2', boxShadow: '0 2px 10px rgba(15,23,42,0.05)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', transition: 'all 0.2s ease' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(15,23,42,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(15,23,42,0.05)'; }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 11, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{label}</div>
                  <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2 }}>{sub}</div>
                </div>
                <ArrowRight size={16} color="#CBD5E1" />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
