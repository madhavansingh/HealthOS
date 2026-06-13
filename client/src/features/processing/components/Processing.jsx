import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, FileText, Upload, ArrowRight,
  Stethoscope, AlertCircle, Pill, Sparkles
} from 'lucide-react';
import { getReportStatus } from '../../../api/client';

/* ── Stage definitions ────────────────────────────────────────────────────── */
const STAGES = [
  { id: 'classify',   label: 'Reading Your Document',       sublabel: 'Identifying file type and content format',                icon: '🔍' },
  { id: 'ocr',        label: 'Extracting Text',              sublabel: 'AI-powered OCR reading every line',                       icon: '📖' },
  { id: 'vision',     label: 'Understanding Medical Content', sublabel: 'Gemini Vision analysing clinical values',                 icon: '🧠' },
  { id: 'biomarkers', label: 'Identifying Health Metrics',   sublabel: 'Detecting biomarkers, values, and reference ranges',       icon: '🧬' },
  { id: 'insights',   label: 'Generating Health Insights',   sublabel: 'Building your clinical brief and AI analysis',             icon: '💡' },
  { id: 'twin',       label: 'Constructing Health Twin',     sublabel: 'Calibrating your personalised digital health model',       icon: '⚡' },
];

/* ── Document type labels ─────────────────────────────────────────────────── */
const DOC_TYPE_LABELS = {
  'Blood Report':       { emoji: '🩸', label: 'Blood Report',             color: '#EF4444', bg: '#FEF2F2' },
  'CBC':                { emoji: '🩸', label: 'Complete Blood Count',      color: '#EF4444', bg: '#FEF2F2' },
  'Lipid Profile':      { emoji: '💉', label: 'Lipid Profile',             color: '#F59E0B', bg: '#FFFBEB' },
  'Thyroid Report':     { emoji: '🦋', label: 'Thyroid Panel',             color: '#6366F1', bg: '#EEF2FF' },
  'Vitamin Panel':      { emoji: '☀️', label: 'Vitamin Panel',             color: '#10B981', bg: '#ECFDF5' },
  'Diabetes Report':    { emoji: '📊', label: 'Glucose / Diabetes Panel',  color: '#3B82F6', bg: '#EFF6FF' },
  'Prescription':       { emoji: '💊', label: 'Prescription',              color: '#8B5CF6', bg: '#F5F3FF' },
  'Scanned Lab Report': { emoji: '📄', label: 'Scanned Lab Report',        color: '#64748B', bg: '#F8FAFC' },
  'General Lab':        { emoji: '🔬', label: 'Lab Report',                color: '#4F46E5', bg: '#EEF2FF' },
  default:              { emoji: '📋', label: 'Medical Document',          color: '#4F46E5', bg: '#EEF2FF' },
};

function getDocType(raw) {
  if (!raw) return DOC_TYPE_LABELS.default;
  for (const key of Object.keys(DOC_TYPE_LABELS)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) return DOC_TYPE_LABELS[key];
  }
  return { emoji: '📋', label: raw, color: '#4F46E5', bg: '#EEF2FF' };
}

/* ── Stage row (vertical timeline) ───────────────────────────────────────── */
function TimelineStep({ stage, state, isLast, isWarning }) {
  const isDone   = state === 'done';
  const isActive = state === 'active';

  const dotBg = isWarning ? '#FFFBEB' : isDone ? '#ECFDF5' : isActive ? '#EEF2FF' : '#F1F5F9';
  const dotBorder = isWarning ? '#F59E0B' : isDone ? '#10B981' : isActive ? '#4F46E5' : '#E2E8F0';
  const labelColor = isWarning ? '#D97706' : isDone ? '#10B981' : isActive ? '#0F172A' : '#94A3B8';
  const sublabelColor = isWarning ? '#B45309' : '#94A3B8';

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Left: connector + dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 28 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: dotBg,
          border: `2px solid ${dotBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.4s ease',
          boxShadow: isActive ? '0 0 0 4px rgba(79,70,229,0.08)' : 'none',
        }}>
          {isWarning
            ? <span style={{ fontSize: 11 }}>⚠️</span>
            : isDone
            ? <Check size={12} color="#10B981" strokeWidth={2.5} />
            : isActive
            ? <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4F46E5', animation: 'pulse-scale 1.2s ease-in-out infinite' }} />
            : <span style={{ fontSize: 11 }}>{stage.icon}</span>
          }
        </div>
        {!isLast && (
          <div style={{
            width: 2, flex: 1, minHeight: 20, marginTop: 4,
            background: isWarning 
              ? 'linear-gradient(to bottom, #F59E0B, #FEF3C7)'
              : isDone
              ? 'linear-gradient(to bottom, #10B981, #D1FAE5)'
              : '#E2E8F0',
            transition: 'background 0.6s ease',
            borderRadius: 1,
          }} />
        )}
      </div>

      {/* Right: text */}
      <div style={{ paddingBottom: isLast ? 0 : 20, paddingTop: 2, flex: 1 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 700,
          color: labelColor,
          lineHeight: 1.2, marginBottom: 2,
          transition: 'color 0.3s ease',
        }}>
          {stage.label}
        </div>
        {(isDone || isActive) && (
          <div style={{ fontSize: 12, color: sublabelColor, lineHeight: 1.4 }}>{stage.sublabel}</div>
        )}
        {isActive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
            <div style={{ width: 32, height: 3, borderRadius: 2, background: '#E0E7FF', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#4F46E5', borderRadius: 2, animation: 'shimmer 1.4s ease infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, #4F46E5 0%, #6366F1 50%, #4F46E5 100%)' }} />
            </div>
            <span style={{ fontSize: 10.5, color: '#6366F1', fontWeight: 600 }}>Running…</span>
          </div>
        )}
      </div>

      {/* Badge */}
      {isDone && !isWarning && (
        <div style={{
          alignSelf: 'flex-start', marginTop: 3,
          padding: '2px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700,
          color: '#059669', background: '#ECFDF5', border: '1px solid rgba(16,185,129,0.2)',
        }}>Done</div>
      )}
      {isWarning && (
        <div style={{
          alignSelf: 'flex-start', marginTop: 3,
          padding: '2px 9px', borderRadius: 9999, fontSize: 10, fontWeight: 700,
          color: '#D97706', background: '#FFFBEB', border: '1px solid rgba(245,158,11,0.2)',
        }}>Fallback</div>
      )}
    </div>
  );
}

/* ── Metric chip ──────────────────────────────────────────────────────────── */
function MetricChip({ name, value, unit, status }) {
  const map = { low: '#3B82F6', high: '#F59E0B', critical_low: '#EF4444', critical_high: '#EF4444', normal: '#10B981' };
  const sc  = map[status] || '#10B981';
  const displayVal = value !== null && value !== undefined ? `${value}${unit ? ' ' + unit : ''}`.trim() : '—';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px', borderRadius: 8,
      background: '#FFFFFF', border: '1px solid #E5EAF2',
      boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <span style={{
        fontSize: 12, fontWeight: 700, color: sc, flexShrink: 0,
        padding: '1px 6px', borderRadius: 6, background: `${sc}12`,
      }}>{displayVal}</span>
    </div>
  );
}

/* ── Progress ring (light) ────────────────────────────────────────────────── */
function ProgressRing({ progress, color, size = 100 }) {
  const r    = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - progress / 100);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5EAF2" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.7s ease, stroke 0.4s ease' }} />
    </svg>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function Processing() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reportId = searchParams.get('reportId');

  const [richStatus, setRichStatus] = useState(null);
  const [elapsed, setElapsed]       = useState(0);
  const pollRef    = useRef(null);
  const elapsedRef = useRef(null);

  const isFinalState = (s) => ['analyzed', 'partial', 'error', 'unsupported', 'low_confidence'].includes(s?.status);

  useEffect(() => {
    elapsedRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(elapsedRef.current);
  }, []);

  useEffect(() => {
    if (!reportId) return;
    const poll = async () => {
      try {
        const data = await getReportStatus(reportId);
        setRichStatus(data);
        if (isFinalState(data)) {
          clearInterval(pollRef.current);
          clearInterval(elapsedRef.current);
        }
      } catch (err) {
        console.warn('Poll error:', err.message);
      }
    };
    poll();
    pollRef.current = setInterval(poll, 2500);
    return () => clearInterval(pollRef.current);
  }, [reportId]);

  /* ── No report ID ─────────────────────────────────────────────────────── */
  if (!reportId) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <AlertCircle size={40} color="#EF4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>No report selected</h2>
          <p style={{ color: '#64748B', marginBottom: 20 }}>Upload a medical report to begin analysis.</p>
          <button onClick={() => navigate('/onboarding')} className="btn-primary">
            ← Upload Report
          </button>
        </div>
      </div>
    );
  }

  /* ── Derived state ────────────────────────────────────────────────────── */
  const status         = richStatus?.status || 'processing';
  const completedSteps = richStatus?.completedSteps || [];
  const docInfo        = getDocType(richStatus?.documentType);
  const progress       = isFinalState(richStatus) ? 100 : Math.round((completedSteps.length / STAGES.length) * 100);
  const activeIdx      = isFinalState(richStatus) ? -1 : STAGES.findIndex(s => !completedSteps.includes(s.id));

  const isPartial  = status === 'partial';
  const isError    = status === 'error';
  const isSuccess  = status === 'analyzed';
  const isProcessing = status === 'processing';

  const accentColor = isSuccess ? '#10B981' : isPartial ? '#F59E0B' : isError ? '#EF4444' : '#4F46E5';

  const elapsedStr = elapsed < 60
    ? `${elapsed}s`
    : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  const metricsPreview  = richStatus?.metricsPreview  || [];
  const medicines       = richStatus?.medicinesDetected || [];
  const textSnippet     = richStatus?.textSnippet || '';
  const ocrSuccess      = richStatus?.ocrSuccess;
  const visionSuccess   = richStatus?.visionSuccess;
  const ocrConfidence   = richStatus?.ocrConfidence;
  const aiFallback      = richStatus?.aiFallback;
  const insightSource   = richStatus?.insightSource;
  // Never expose raw API error strings — only show user-friendly text from the backend
  const errorReason     = richStatus?.errorReason || null;

  const headline =
    isSuccess  ? 'Health Twin Created' :
    isPartial  ? 'Document Analysed' :
    isError    ? (aiFallback ? 'Health Twin Created' : 'Document Processed') :
    'Analysing Your Report…';

  const subline =
    isSuccess  ? (aiFallback ? 'We successfully extracted health metrics from your report. Advanced AI analysis is temporarily unavailable, but your report has been processed.' : 'Your digital health profile is ready.') :
    isPartial  ? 'We analysed your document. Some metrics could not be extracted.' :
    isError    ? (aiFallback ? 'We successfully extracted health metrics from your report. Advanced AI analysis is temporarily unavailable, but your report has been processed.' : 'We read your document but could not identify enough health metrics to build a full twin.') :
    'This usually takes 20–45 seconds.';

  // Status indicator rows for the pipeline
  const pipelineChecks = [
    { label: 'OCR & Text Extraction', ok: ocrSuccess !== false },
    { label: 'Document Classification', ok: completedSteps.includes('classify') },
    { label: 'Biomarker Detection', ok: completedSteps.includes('biomarkers') },
    { label: 'Health Score Generated', ok: isFinalState(richStatus) && status !== 'error' },
    { label: 'Advanced AI Insights', ok: !aiFallback && isFinalState(richStatus), delayed: aiFallback },
  ];

  const isUnsupported = status === 'unsupported';
  const isLowConfidence = status === 'low_confidence';

  if (isUnsupported || isLowConfidence) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'var(--font-body)' }}>
        {/* Top bar */}
        <nav style={{ height: 60, background: '#FFFFFF', borderBottom: '1px solid #E5EAF2', display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between' }}>
          <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 3L13.5 8H16.5L10 17L3.5 8H6.5L10 3Z" fill="white"/></svg>
            </div>
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.4px' }}>HealthOS</span>
          </div>
          <button onClick={() => navigate('/onboarding')} style={{ fontSize: 13, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Upload size={12} /> Upload Another
          </button>
        </nav>

        <div style={{ maxWidth: 600, margin: '80px auto', padding: '0 24px' }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: '#FFFFFF',
              borderRadius: 24,
              padding: '40px',
              border: '1px solid #E5EAF2',
              boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
              textAlign: 'center'
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#FEF2F2', border: '1.5px solid rgba(239, 68, 68, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px', fontSize: 28
            }}>
              ⚠️
            </div>

            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
              {isUnsupported ? 'This does not appear to be a medical document.' : 'Low Document Clarity'}
            </h1>
            
            <p style={{ fontSize: 14.5, color: '#64748B', lineHeight: 1.6, marginBottom: 28 }}>
              {isUnsupported 
                ? 'Our Input Intelligence layer analyzed the file but classified it as a non-health document. We only process health reports, pathology results, and prescriptions.'
                : 'We detected a medical document, but the text is too blurry or low quality to read with high confidence. Please upload a clearer copy.'}
            </p>

            <div style={{
              background: '#F8FAFC',
              borderRadius: 16,
              padding: '20px',
              border: '1px solid #E5EAF2',
              marginBottom: 32,
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span style={{ fontWeight: 600, color: '#64748B' }}>Detected Type:</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{richStatus?.documentType || 'Unknown'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span style={{ fontWeight: 600, color: '#64748B' }}>Confidence Score:</span>
                <span style={{ fontWeight: 700, color: '#4F46E5' }}>
                  {richStatus?.classificationConfidence != null 
                    ? `${Math.round(richStatus.classificationConfidence * 100)}%` 
                    : 'Low'}
                </span>
              </div>
              <div style={{ borderTop: '1px solid #E5EAF2', paddingTop: 12, marginTop: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>
                  Supported Document Types
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['Blood Report', 'Complete Blood Count', 'Lipid Profile', 'Thyroid Panel', 'Vitamin Panel', 'Diabetes Report', 'Prescription', 'Scanned Lab Report'].map(t => (
                    <span key={t} style={{ fontSize: 11, background: '#EEF2FF', color: '#4F46E5', fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => navigate('/onboarding')}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: 9999,
                  background: '#4F46E5',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(79,70,229,0.25)',
                  fontFamily: 'var(--font-body)'
                }}
              >
                Upload Another Document
              </button>
              <button
                onClick={() => navigate('/onboarding')}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: 9999,
                  background: 'transparent',
                  color: '#334155',
                  fontSize: 14,
                  fontWeight: 600,
                  border: '1.5px solid #E5EAF2',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)'
                }}
              >
                Try Demo Report
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'var(--font-body)' }}>

      {/* Top bar */}
      <nav style={{ height: 60, background: '#FFFFFF', borderBottom: '1px solid #E5EAF2', display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 3L13.5 8H16.5L10 17L3.5 8H6.5L10 3Z" fill="white"/></svg>
          </div>
          <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.4px' }}>HealthOS</span>
        </div>
        <button onClick={() => navigate('/onboarding')} style={{ fontSize: 13, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Upload size={12} /> Upload Another
        </button>
      </nav>

      <div style={{ maxWidth: 940, margin: '0 auto', padding: '48px 24px 72px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: Main status ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Header card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ background: '#FFFFFF', borderRadius: 20, padding: '28px 28px', border: '1px solid #E5EAF2', boxShadow: '0 2px 16px rgba(15,23,42,0.06)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
              {/* Ring */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <ProgressRing progress={progress} color={accentColor} size={100} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 800, color: accentColor, lineHeight: 1 }}>{progress}%</span>
                </div>
              </div>

              {/* Text */}
              <div style={{ flex: 1, paddingTop: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                    {headline}
                  </h1>
                  {isProcessing && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4F46E5', animation: 'pulse-scale 1.2s ease-in-out infinite' }} />}
                </div>
                <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, marginBottom: 12 }}>{subline}</p>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {/* Doc type chip */}
                  {richStatus?.documentType && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 9999, background: docInfo.bg, border: `1px solid ${docInfo.color}25`, fontSize: 12.5, fontWeight: 600, color: docInfo.color }}>
                      <span>{docInfo.emoji}</span> {docInfo.label}
                    </div>
                  )}
                  {/* Elapsed */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>
                    ⏱ {elapsedStr}
                  </div>
                  {/* Confidence */}
                  {ocrConfidence != null && (
                    <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>
                      OCR: <span style={{ color: ocrConfidence > 0.8 ? '#10B981' : '#F59E0B', fontWeight: 700 }}>{Math.round(ocrConfidence * 100)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* OCR / Vision technique used */}
          {(ocrSuccess != null || visionSuccess != null) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{ background: '#FFFFFF', borderRadius: 14, padding: '16px 20px', border: '1px solid #E5EAF2', display: 'flex', gap: 12, flexWrap: 'wrap' }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.4px', textTransform: 'uppercase', marginRight: 4, alignSelf: 'center' }}>Technique</span>
              {[
                { label: 'Text Extraction', ok: ocrSuccess },
                { label: 'Vision Analysis', ok: visionSuccess },
              ].map(({ label, ok }) => ok != null && (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 9999, background: ok ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, fontSize: 12, fontWeight: 600, color: ok ? '#059669' : '#DC2626' }}>
                  {ok ? <Check size={11} /> : '✕'} {label}
                </div>
              ))}
            </motion.div>
          )}

          {/* Text snippet preview */}
          {textSnippet && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              style={{ background: '#FFFFFF', borderRadius: 14, padding: '18px 20px', border: '1px solid #E5EAF2' }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10 }}>Extracted Text Preview</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#334155', background: '#F8FAFC', borderRadius: 8, padding: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 120, overflow: 'hidden', position: 'relative' }}>
                {textSnippet.slice(0, 380)}{textSnippet.length > 380 ? '…' : ''}
              </div>
            </motion.div>
          )}

          {/* Detected metrics grid */}
          {metricsPreview.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{ background: '#FFFFFF', borderRadius: 14, padding: '18px 20px', border: '1px solid #E5EAF2' }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 12 }}>
                Detected Biomarkers
                <span style={{ marginLeft: 8, padding: '1px 7px', borderRadius: 9999, background: '#EEF2FF', color: '#4F46E5', fontSize: 10 }}>{metricsPreview.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {metricsPreview.slice(0, 8).map((m, i) => (
                  <MetricChip key={i} name={m.name} value={m.value} unit={m.unit} status={m.status} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Medicines */}
          {medicines.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              style={{ background: '#FFFFFF', borderRadius: 14, padding: '18px 20px', border: '1px solid #E5EAF2' }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10 }}>Medications Detected</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {medicines.slice(0, 8).map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 9999, background: '#F5F3FF', border: '1px solid rgba(139,92,246,0.2)', fontSize: 12.5, fontWeight: 600, color: '#7C3AED' }}>
                    <Pill size={11} /> {m}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* AI Fallback Notice — shown when Gemini was unavailable but pipeline still succeeded */}
          {aiFallback && isSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{ background: '#FFFBEB', borderRadius: 12, padding: '14px 18px', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', gap: 12, alignItems: 'flex-start' }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚡</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 3 }}>AI services are temporarily busy</div>
                <div style={{ fontSize: 12.5, color: '#78350F', lineHeight: 1.6 }}>
                  Your Health Twin was built using our validated Clinical Rules Engine based on ADA, AHA, and WHO guidelines.
                  All your biomarkers are analysed — advanced AI-powered insights will be available when services recover.
                </div>
              </div>
            </motion.div>
          )}

          {/* Error detail — always user-friendly text, never raw API messages */}
          {errorReason && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{ background: '#FEF2F2', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', gap: 10 }}
            >
              <AlertCircle size={14} color="#EF4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 3 }}>What happened</div>
                <div style={{ fontSize: 12.5, color: '#B91C1C', lineHeight: 1.55 }}>{errorReason}</div>
              </div>
            </motion.div>
          )}

          {/* Action buttons */}
          {isFinalState(richStatus) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}
            >
              {isSuccess && (
                <button
                  onClick={() => navigate('/twin')}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <Sparkles size={14} /> View My Health Twin <ArrowRight size={13} />
                </button>
              )}
              {isPartial && (
                <>
                  <button onClick={() => navigate('/twin')} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                    <Sparkles size={14} /> View Partial Twin <ArrowRight size={13} />
                  </button>
                  <button onClick={() => navigate('/onboarding')} style={{ flex: 1, padding: '13px 18px', borderRadius: 9999, background: 'transparent', color: '#334155', fontSize: 14, fontWeight: 500, border: '1.5px solid #E5EAF2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'var(--font-body)' }}>
                    Upload Blood Report
                  </button>
                </>
              )}
              {isError && (
                <>
                  <button onClick={() => navigate('/onboarding')} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                    <Upload size={14} /> Try Another Document
                  </button>
                  <button onClick={() => navigate('/doctor-copilot')} style={{ flex: 1, padding: '13px 18px', borderRadius: 9999, background: 'transparent', color: '#334155', fontSize: 14, fontWeight: 500, border: '1.5px solid #E5EAF2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'var(--font-body)' }}>
                    <Stethoscope size={14} /> Doctor Copilot
                  </button>
                </>
              )}
            </motion.div>
          )}
        </div>

        {/* ── RIGHT: Vertical pipeline timeline ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{
            background: '#FFFFFF', borderRadius: 20, padding: '24px 22px',
            border: '1px solid #E5EAF2', boxShadow: '0 2px 12px rgba(15,23,42,0.05)',
            position: 'sticky', top: 80,
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 20 }}>
            Analysis Pipeline
          </div>

          <div>
            {STAGES.map((stage, i) => {
              const isDone   = completedSteps.includes(stage.id);
              const isActive = !isDone && i === activeIdx;
              const state    = isDone ? 'done' : isActive ? 'active' : 'pending';
              
              let displaySublabel = stage.sublabel;
              let displayLabel = stage.label;
              let isWarning = false;
              
              if (stage.id === 'insights' && aiFallback && isDone) {
                displayLabel = 'Advanced AI Insights';
                displaySublabel = 'Advanced AI Insights unavailable';
                isWarning = true;
              }

              return (
                <TimelineStep 
                  key={stage.id} 
                  stage={{ ...stage, label: displayLabel, sublabel: displaySublabel }} 
                  state={state} 
                  isLast={i === STAGES.length - 1} 
                  isWarning={isWarning}
                />
              );
            })}
          </div>

          {/* Bottom note */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F1F5F9' }}>
            {isProcessing ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#94A3B8' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4F46E5', animation: 'pulse-scale 1s ease-in-out infinite' }} />
                Processing with Gemini 2.5 Flash…
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12, color: isSuccess ? '#059669' : '#94A3B8', fontWeight: 500 }}>
                {isSuccess && <Check size={12} color="#059669" />}
                {isSuccess ? 'Pipeline complete' : isPartial ? 'Pipeline complete (partial)' : 'Pipeline ended'}
                <span style={{ color: '#CBD5E1' }}>· {elapsedStr}</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
