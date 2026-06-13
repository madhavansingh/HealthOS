import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Stethoscope, Copy, Check, Upload, ArrowRight,
  CheckCircle, MessageSquare, FileText
} from 'lucide-react';
import { getDoctorBrief } from '../api/client';

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };
const IV = { once: true, amount: 0.15 };

/* ── Question Card ────────────────────────────────────────────────────────── */
function QuestionCard({ question, index, isSelected, onToggle }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(question).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <motion.div
      variants={fadeUp}
      onClick={onToggle}
      style={{
        padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
        border: `1px solid ${isSelected ? '#C7D2FE' : '#E5EAF2'}`,
        background: isSelected ? '#EEF2FF' : '#FFFFFF',
        transition: 'all 0.15s ease',
        display: 'flex', gap: 12, alignItems: 'flex-start',
        boxShadow: isSelected ? '0 2px 10px rgba(79,70,229,0.08)' : '0 1px 3px rgba(15,23,42,0.04)',
        borderLeft: `3px solid ${isSelected ? '#4F46E5' : '#E5EAF2'}`,
      }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: 7, flexShrink: 0,
        background: isSelected ? '#4F46E5' : '#F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800,
        color: isSelected ? '#FFFFFF' : '#94A3B8',
        transition: 'all 0.15s ease',
      }}>
        {index + 1}
      </div>
      <span style={{
        fontSize: 13.5, flex: 1, lineHeight: 1.6,
        color: isSelected ? '#0F172A' : '#334155',
        fontWeight: isSelected ? 600 : 400,
        transition: 'color 0.15s ease',
      }}>
        {question}
      </span>
      {isSelected && (
        <button onClick={handleCopy} style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: 7,
          background: copied ? '#ECFDF5' : '#EEF2FF',
          border: `1px solid ${copied ? 'rgba(16,185,129,0.25)' : '#C7D2FE'}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} color="#4F46E5" />}
        </button>
      )}
    </motion.div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────────────── */
function EmptyState({ navigate }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ width: 68, height: 68, borderRadius: 20, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
          <Stethoscope size={28} color="#4F46E5" />
        </div>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 10, letterSpacing: '-0.03em' }}>
          Doctor Copilot needs your reports.
        </h2>
        <p style={{ fontSize: 14.5, color: '#64748B', lineHeight: 1.7, marginBottom: 24 }}>
          Upload at least one medical report and HealthOS will generate personalised questions, a clinical summary, and visit preparation for your next appointment.
        </p>
        <button onClick={() => navigate('/onboarding')} className="btn-primary">
          <Upload size={14} /> Upload Report <ArrowRight size={13} />
        </button>
      </motion.div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function DoctorCopilot() {
  const navigate = useNavigate();
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [briefData, setBriefData]               = useState(null);
  const [loading, setLoading]                   = useState(true);

  useEffect(() => {
    getDoctorBrief()
      .then(setBriefData)
      .catch(err => console.error('Failed to load doctor brief:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E5EAF2', borderTopColor: '#4F46E5', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 13.5, color: '#94A3B8' }}>Loading your Doctor Copilot…</div>
      </div>
    );
  }

  const hasData = briefData && (briefData.questions?.length || briefData.summary);
  if (!hasData) return <EmptyState navigate={navigate} />;

  const questions   = briefData.questions   || [];
  const summary     = briefData.summary     || '';
  const checklist   = briefData.checklist   || briefData.visitChecklist || [];
  const specialist  = briefData.specialist  || briefData.recommendedSpecialist || '';
  const urgency     = briefData.urgency     || '';
  const concerns    = briefData.primaryConcerns || briefData.concerns || [];
  const metrics     = briefData.keyMetrics  || briefData.metricSummary || [];

  return (
    <div style={{ background: '#F8FAFC', fontFamily: 'var(--font-body)' }}>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <section style={{ background: '#FFFFFF', borderBottom: '1px solid #E5EAF2', padding: '32px 0' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 32px' }}>
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} style={{ fontSize: 11.5, fontWeight: 700, color: '#4F46E5', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>
              Doctor Copilot
            </motion.div>
            <motion.h1 variants={fadeUp} style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(26px, 3vw, 36px)', fontWeight: 800, letterSpacing: '-0.04em', color: '#0F172A', marginBottom: 8, lineHeight: 1.15 }}>
              Walk in prepared.
            </motion.h1>
            <motion.p variants={fadeUp} style={{ fontSize: 15, color: '#64748B', lineHeight: 1.65, maxWidth: 560 }}>
              HealthOS has reviewed your medical reports and prepared everything you need for your next doctor visit — questions, summary, and clinical context.
            </motion.p>

            {/* Meta pills */}
            <motion.div variants={fadeUp} style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              {specialist && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 9999, background: '#EEF2FF', border: '1px solid #C7D2FE', fontSize: 12.5, fontWeight: 600, color: '#4F46E5' }}>
                  <Stethoscope size={11} /> {specialist}
                </div>
              )}
              {urgency && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 9999, background: urgency.toLowerCase().includes('urgent') ? '#FEF2F2' : '#ECFDF5', border: urgency.toLowerCase().includes('urgent') ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(16,185,129,0.25)', fontSize: 12.5, fontWeight: 600, color: urgency.toLowerCase().includes('urgent') ? '#DC2626' : '#059669' }}>
                  {urgency.toLowerCase().includes('urgent') ? '⚠️' : '✓'} {urgency}
                </div>
              )}
              <div style={{ fontSize: 12, color: '#94A3B8', alignSelf: 'center' }}>
                {questions.length} questions prepared
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 32px 64px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Questions */}
          {questions.length > 0 && (
            <motion.div initial="hidden" whileInView="visible" viewport={IV} variants={stagger}>
              <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <MessageSquare size={14} color="#4F46E5" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Questions to Ask Your Doctor</span>
                <span style={{ padding: '2px 8px', borderRadius: 9999, background: '#EEF2FF', color: '#4F46E5', fontSize: 11, fontWeight: 700 }}>{questions.length}</span>
              </motion.div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {questions.map((q, i) => (
                  <QuestionCard
                    key={i}
                    question={typeof q === 'string' ? q : q.question || q.text || String(q)}
                    index={i}
                    isSelected={selectedQuestion === i}
                    onToggle={() => setSelectedQuestion(selectedQuestion === i ? null : i)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Summary */}
          {summary && (
            <motion.div initial="hidden" whileInView="visible" viewport={IV} variants={stagger}>
              <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <FileText size={14} color="#4F46E5" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Clinical Summary</span>
              </motion.div>
              <motion.div variants={fadeUp} style={{
                background: '#FFFFFF', borderRadius: 14, padding: '20px 22px',
                border: '1px solid #E5EAF2', borderLeft: '3px solid #4F46E5',
                fontSize: 14, color: '#334155', lineHeight: 1.78,
                boxShadow: '0 2px 10px rgba(15,23,42,0.05)',
              }}>
                {summary}
              </motion.div>
            </motion.div>
          )}

          {/* Primary concerns */}
          {concerns.length > 0 && (
            <motion.div initial="hidden" whileInView="visible" viewport={IV} variants={stagger}>
              <motion.div variants={fadeUp} style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Primary Concerns</span>
              </motion.div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {concerns.map((c, i) => (
                  <motion.div key={i} variants={fadeUp} style={{
                    padding: '13px 16px', borderRadius: 10,
                    background: '#FFFFFF', border: '1px solid #E5EAF2',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    boxShadow: '0 1px 4px rgba(15,23,42,0.03)',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, marginTop: 5 }} />
                    <span style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.55 }}>
                      {typeof c === 'string' ? c : c.concern || c.text || String(c)}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right column — sticky sidebar */}
        <div style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Visit checklist */}
          {checklist.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{ background: '#FFFFFF', borderRadius: 16, padding: '20px', border: '1px solid #E5EAF2', boxShadow: '0 2px 10px rgba(15,23,42,0.05)' }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 14 }}>Visit Checklist</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {checklist.slice(0, 8).map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <CheckCircle size={13} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                      {typeof item === 'string' ? item : item.item || item.text || String(item)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Key metrics summary */}
          {metrics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              style={{ background: '#FFFFFF', borderRadius: 16, padding: '20px', border: '1px solid #E5EAF2', boxShadow: '0 2px 10px rgba(15,23,42,0.05)' }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 14 }}>Key Metrics to Discuss</div>
              {metrics.slice(0, 6).map((m, i) => {
                const statusColors = { normal: '#10B981', high: '#F59E0B', low: '#3B82F6', critical: '#EF4444' };
                const name   = typeof m === 'string' ? m : m.name || String(m);
                const value  = m.value  ? `${m.value} ${m.unit || ''}` : '';
                const status = m.status || 'normal';
                const sc     = statusColors[status] || '#64748B';
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < metrics.length - 1 ? '1px solid #F1F5F9' : 'none', fontSize: 13 }}>
                    <span style={{ color: '#334155', fontWeight: 500 }}>{name}</span>
                    {value && <span style={{ fontWeight: 700, color: sc }}>{value}</span>}
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* Upload more */}
          <div style={{ background: '#EEF4FF', borderRadius: 14, padding: '16px', border: '1px solid #C7D2FE' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Add more reports</div>
            <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 12, lineHeight: 1.5 }}>
              More reports = more accurate questions and briefing.
            </div>
            <button onClick={() => navigate('/onboarding')} style={{ width: '100%', padding: '9px', borderRadius: 9, background: '#4F46E5', color: '#fff', fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'var(--font-body)' }}>
              <Upload size={12} /> Upload Another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
