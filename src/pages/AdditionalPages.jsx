// Future Simulator — Premium Light Redesign

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ArrowRight, Upload, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react';
import { runSimulation, getHealthTwin } from '../api/client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };
const IV = { once: true, amount: 0.15 };

const SCENARIOS = [
  { id: 'combined',           label: 'All Lifestyle Changes', emoji: '🚀', color: '#4F46E5' },
  { id: 'exercise_increase',  label: 'Add Daily Exercise',    emoji: '🏃', color: '#10B981' },
  { id: 'diet_optimization',  label: 'Diet Optimisation',     emoji: '🥗', color: '#3B82F6' },
  { id: 'sleep_improvement',  label: 'Improve Sleep',         emoji: '😴', color: '#8B5CF6' },
  { id: 'supplement_protocol',label: 'Supplement Protocol',   emoji: '💊', color: '#F59E0B' },
];

/* ── Custom tooltip for recharts ──────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5EAF2', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(15,23,42,0.08)', fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#64748B' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          {p.name}: <span style={{ fontWeight: 700, color: '#0F172A' }}>{Math.round(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Outcome card ─────────────────────────────────────────────────────────── */
function OutcomeCard({ metric, change, color, bg, timeframe }) {
  const isPos = !String(change).includes('-');
  return (
    <motion.div variants={fadeUp} style={{
      padding: '18px 20px', borderRadius: 14, background: bg,
      border: `1px solid ${color}22`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {isPos
          ? <TrendingUp size={14} color={color} />
          : <TrendingDown size={14} color={color} />
        }
        <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, color, letterSpacing: '-0.03em' }}>{change}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>{metric}</div>
      <div style={{ fontSize: 11.5, color: '#94A3B8' }}>in {timeframe}</div>
    </motion.div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────────────── */
function EmptyState({ navigate }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ width: 68, height: 68, borderRadius: 20, background: '#FFFBEB', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
          <Zap size={28} color="#F59E0B" />
        </div>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 10, letterSpacing: '-0.03em' }}>
          Simulator needs your health data.
        </h2>
        <p style={{ fontSize: 14.5, color: '#64748B', lineHeight: 1.7, marginBottom: 24 }}>
          Upload a blood report or lab result. HealthOS will model how diet, exercise, sleep, and supplements affect your health over 3, 6, and 12 months.
        </p>
        <button onClick={() => navigate('/onboarding')} className="btn-primary">
          <Upload size={14} /> Upload Report <ArrowRight size={13} />
        </button>
      </motion.div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export function FutureSimulator() {
  const navigate     = useNavigate();
  const [scenario, setScenario]       = useState('combined');
  const [forecast, setForecast]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [hasData, setHasData]         = useState(true);
  const [checkingData, setChecking]   = useState(true);

  useEffect(() => {
    getHealthTwin()
      .then(twin => { if (!twin || twin.overallScore === 0) setHasData(false); })
      .catch(() => setHasData(false))
      .finally(() => setChecking(false));
  }, []);

  const runForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runSimulation(scenario);
      setForecast(result);
    } catch (err) {
      setError(err.message || 'Simulation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid #E5EAF2', borderTopColor: '#4F46E5', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 14, color: '#94A3B8' }}>Syncing simulation engine…</span>
      </div>
    );
  }

  if (!hasData) return <EmptyState navigate={navigate} />;

  const activeScenario = SCENARIOS.find(s => s.id === scenario);
  const chartData = forecast?.chartData || forecast?.trajectory || [];
  const outcomes  = forecast?.outcomes  || forecast?.projectedChanges || [];
  const narrative = forecast?.narrative || forecast?.summary || '';
  const recommendations = forecast?.recommendations || [];

  return (
    <div style={{ background: '#F8FAFC', fontFamily: 'var(--font-body)' }}>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <section style={{ background: '#FFFFFF', borderBottom: '1px solid #E5EAF2', padding: '32px 0' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 32px' }}>
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} style={{ fontSize: 11.5, fontWeight: 700, color: '#4F46E5', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>
              Future Simulator
            </motion.div>
            <motion.h1 variants={fadeUp} style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(26px, 3vw, 36px)', fontWeight: 800, letterSpacing: '-0.04em', color: '#0F172A', marginBottom: 8, lineHeight: 1.15 }}>
              Model your health future.
            </motion.h1>
            <motion.p variants={fadeUp} style={{ fontSize: 15, color: '#64748B', lineHeight: 1.65, maxWidth: 540 }}>
              Choose a lifestyle scenario and see the projected impact on your biomarkers and health score over 3, 6, and 12 months — personalised to your Health Twin.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 32px 72px' }}>

        {/* ── Scenario Selector ─────────────────────────────────────────── */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          style={{ marginBottom: 28 }}
        >
          <motion.div variants={fadeUp} style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 12 }}>
            Choose a Scenario
          </motion.div>
          <motion.div variants={fadeUp} style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {SCENARIOS.map(s => {
              const isActive = scenario === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => { setScenario(s.id); setForecast(null); setError(null); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '10px 18px', borderRadius: 9999, fontSize: 13.5, fontWeight: 600,
                    background: isActive ? s.color : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : '#64748B',
                    border: `1.5px solid ${isActive ? s.color : '#E5EAF2'}`,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                    boxShadow: isActive ? `0 4px 14px ${s.color}30` : '0 1px 4px rgba(15,23,42,0.04)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <span>{s.emoji}</span> {s.label}
                </button>
              );
            })}
          </motion.div>
        </motion.div>

        {/* ── Run button ────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 32 }}>
          <button
            onClick={runForecast}
            disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '13px 28px', borderRadius: 9999,
              background: loading ? '#E5EAF2' : '#4F46E5',
              color: loading ? '#94A3B8' : '#FFFFFF',
              fontSize: 14.5, fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 18px rgba(79,70,229,0.28)',
              fontFamily: 'var(--font-body)', transition: 'all 0.2s ease',
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2.5px solid rgba(148,163,184,0.3)', borderTopColor: '#94A3B8', animation: 'spin 0.8s linear infinite' }} />
                Simulating with Gemini…
              </>
            ) : (
              <>
                <Zap size={15} />
                Simulate {activeScenario?.label}
                <ArrowRight size={13} />
              </>
            )}
          </button>
        </motion.div>

        {/* ── Error ─────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ padding: '13px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13.5, color: '#DC2626', marginBottom: 20 }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results ───────────────────────────────────────────────────── */}
        <AnimatePresence>
          {forecast && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Outcome cards */}
              {outcomes.length > 0 && (
                <motion.div initial="hidden" animate="visible" variants={stagger} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {outcomes.slice(0, 6).map((o, i) => {
                    const name   = typeof o === 'string' ? o : o.metric   || o.name  || String(o);
                    const change = typeof o === 'string' ? '—' : o.change  || o.delta || '—';
                    const time   = o.timeframe || '3 months';
                    const positive = !String(change).startsWith('-');
                    return (
                      <OutcomeCard key={i}
                        metric={name} change={change} timeframe={time}
                        color={positive ? '#10B981' : '#EF4444'}
                        bg={positive ? '#ECFDF5' : '#FEF2F2'}
                      />
                    );
                  })}
                </motion.div>
              )}

              {/* Chart */}
              {chartData.length > 0 && (
                <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '24px', border: '1px solid #E5EAF2', boxShadow: '0 2px 12px rgba(15,23,42,0.05)', marginBottom: 24 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>Projected Health Score Trajectory</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#4F46E5" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[40, 100]} tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="score" name="Health Score" stroke="#4F46E5" strokeWidth={2.5} fill="url(#areaGrad)" dot={{ fill: '#4F46E5', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                      {chartData[0]?.baseline != null && (
                        <Area type="monotone" dataKey="baseline" name="Baseline" stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="5 4" fill="none" dot={false} />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Narrative */}
              {narrative && (
                <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px 22px', border: '1px solid #E5EAF2', borderLeft: '3px solid #4F46E5', fontSize: 14, color: '#334155', lineHeight: 1.78, marginBottom: 24, boxShadow: '0 2px 10px rgba(15,23,42,0.04)' }}>
                  {narrative}
                </div>
              )}

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div style={{ background: '#EEF4FF', borderRadius: 14, padding: '20px 22px', border: '1px solid #C7D2FE' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Recommendations</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {recommendations.slice(0, 6).map((r, i) => (
                      <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                        <CheckCircle size={13} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.55 }}>
                          {typeof r === 'string' ? r : r.text || r.recommendation || String(r)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Idle state ────────────────────────────────────────────────── */}
        {!forecast && !loading && (
          <div style={{ borderRadius: 18, padding: '60px 40px', textAlign: 'center', background: '#FFFFFF', border: '1px dashed #D1D5DB' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>{activeScenario?.emoji}</div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
              Ready to simulate: {activeScenario?.label}
            </div>
            <div style={{ fontSize: 14, color: '#94A3B8', maxWidth: 380, margin: '0 auto 24px', lineHeight: 1.65 }}>
              Click Simulate to generate your personalised 3–12 month health projection.
            </div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['Month 3', 'Month 6', 'Month 12'].map(m => (
                <div key={m} style={{ padding: '10px 20px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E5EAF2', fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>
                  {m}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
