import { useNavigate } from 'react-router-dom';
import { analyzeDemoReport } from '../../../api/client';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import {
  ArrowRight, Upload, Sparkles, Stethoscope, Zap,
  Shield, CheckCircle, Activity, FileText, Camera, Scan
} from 'lucide-react';

/* ── Animation variants ─────────────────────────────────────────────────── */
const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const scaleIn = {
  hidden:  { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/* ── Viewport trigger shorthand ─────────────────────────────────────────── */
const IV = { once: true, amount: 0.18 };

/* ── Health Orbit SVG – abstract, no illustration ────────────────────────── */
function HealthOrb() {
  return (
    <div style={{ position: 'relative', width: 380, height: 380, flexShrink: 0 }}>
      {/* Outer ring */}
      <svg style={{ position: 'absolute', inset: 0, animation: 'spin 24s linear infinite' }} width="380" height="380" viewBox="0 0 380 380" fill="none">
        <circle cx="190" cy="190" r="172" stroke="#E0E7FF" strokeWidth="1.5" strokeDasharray="8 6"/>
      </svg>
      {/* Middle ring */}
      <svg style={{ position: 'absolute', inset: 0, animation: 'spin 16s linear infinite reverse' }} width="380" height="380" viewBox="0 0 380 380" fill="none">
        <circle cx="190" cy="190" r="130" stroke="#C7D2FE" strokeWidth="1.5" strokeDasharray="5 8"/>
      </svg>
      {/* Progress arc */}
      <svg style={{ position: 'absolute', inset: 0 }} width="380" height="380" viewBox="0 0 380 380" fill="none">
        <circle cx="190" cy="190" r="172" stroke="#4F46E5" strokeWidth="3" strokeDasharray="700 380" strokeLinecap="round" transform="rotate(-90 190 190)" opacity="0.18"/>
        <circle cx="190" cy="190" r="130" stroke="#6366F1" strokeWidth="2.5" strokeDasharray="520 380" strokeLinecap="round" transform="rotate(-90 190 190)" opacity="0.22"/>
      </svg>
      {/* Centre */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 100, height: 100, borderRadius: '50%',
          background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 60px rgba(79,70,229,0.2), 0 8px 32px rgba(79,70,229,0.15)',
          animation: 'float 3.5s ease-in-out infinite',
        }}>
          <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
            <path d="M23 6L30 17H37L23 40L9 17H16L23 6Z" fill="white" opacity="0.95"/>
            <circle cx="23" cy="23" r="6" fill="white" opacity="0.3"/>
          </svg>
        </div>
      </div>
      {/* Satellite nodes */}
      {[
        { angle: 0,   label: 'Cardio',    color: '#EF4444', icon: '❤️' },
        { angle: 90,  label: 'Metabolic', color: '#F59E0B', icon: '🩸' },
        { angle: 180, label: 'Vitamins',  color: '#10B981', icon: '☀️' },
        { angle: 270, label: 'Thyroid',   color: '#6366F1', icon: '🦋' },
      ].map(({ angle, label, color, icon }) => {
        const r = 172;
        const rad = (angle - 90) * Math.PI / 180;
        const cx = 190 + r * Math.cos(rad);
        const cy = 190 + r * Math.sin(rad);
        return (
          <div key={label} style={{
            position: 'absolute',
            left: cx - 20, top: cy - 20,
            width: 40, height: 40, borderRadius: '50%',
            background: '#FFFFFF',
            border: `2px solid ${color}30`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 2px 12px ${color}20`,
            fontSize: 14,
          }}>
            {icon}
          </div>
        );
      })}
    </div>
  );
}

/* ── Step item ───────────────────────────────────────────────────────────── */
function Step({ number, title, body, isLast }) {
  return (
    <motion.div variants={fadeUp} style={{ display: 'flex', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: '#EEF2FF',
          border: '2px solid #C7D2FE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 700, color: '#4F46E5',
          flexShrink: 0,
        }}>
          {number}
        </div>
        {!isLast && <div style={{ width: 1, flex: 1, background: 'linear-gradient(to bottom, #C7D2FE, transparent)', marginTop: 8, minHeight: 40 }} />}
      </div>
      <div style={{ paddingBottom: isLast ? 0 : 36, paddingTop: 8 }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 15, color: '#64748B', lineHeight: 1.65 }}>{body}</div>
      </div>
    </motion.div>
  );
}

/* ── Problem card ────────────────────────────────────────────────────────── */
function ProblemCard({ emoji, headline, body }) {
  return (
    <motion.div variants={scaleIn} style={{
      background: '#FFFFFF', borderRadius: 20,
      padding: '28px 24px', border: '1px solid #E5EAF2',
      boxShadow: '0 2px 12px rgba(15,23,42,0.05)',
    }}>
      <div style={{ fontSize: 32, marginBottom: 14 }}>{emoji}</div>
      <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>{headline}</div>
      <div style={{ fontSize: 14.5, color: '#64748B', lineHeight: 1.65 }}>{body}</div>
    </motion.div>
  );
}

/* ── Format badge ────────────────────────────────────────────────────────── */
function FormatBadge({ icon: Icon, label, sub }) {
  return (
    <motion.div variants={fadeUp} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px', borderRadius: 12,
      background: '#FFFFFF', border: '1px solid #E5EAF2',
      boxShadow: '0 1px 4px rgba(15,23,42,0.04)',
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color="#4F46E5" />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{sub}</div>
      </div>
    </motion.div>
  );
}

/* ── Extracted item (pipeline visualization) ────────────────────────────── */
function ExtractItem({ label, value, color = '#4F46E5', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={IV}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 0', borderBottom: '1px solid #F1F5F9',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CheckCircle size={14} color={color} />
        <span style={{ fontSize: 13.5, color: '#334155', fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{
        fontSize: 13, fontWeight: 700, color,
        background: `${color}10`, padding: '2px 8px', borderRadius: 9999,
      }}>{value}</span>
    </motion.div>
  );
}

/* ── Pillar bar ──────────────────────────────────────────────────────────── */
function Pillar({ label, score, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ height: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 8 }}>
        <motion.div
          initial={{ height: 0 }}
          whileInView={{ height: `${score}%` }}
          viewport={IV}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          style={{ width: 28, background: color, borderRadius: 6, maxHeight: 80 }}
        />
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', letterSpacing: 0.2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{score}</div>
    </div>
  );
}

/* ── Trust badge ─────────────────────────────────────────────────────────── */
function TrustBadge({ icon, title, body }) {
  return (
    <motion.div variants={scaleIn} style={{
      display: 'flex', gap: 16, padding: '20px 24px',
      background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5EAF2',
      boxShadow: '0 1px 6px rgba(15,23,42,0.04)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: '#EEF2FF',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18,
      }}>{icon}</div>
      <div>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>{body}</div>
      </div>
    </motion.div>
  );
}

/* ── Main Landing Page ───────────────────────────────────────────────────── */
export default function LandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const SectionHeader = ({ eyebrow, title, body, center }) => (
    <motion.div
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={IV}
      style={{ textAlign: center ? 'center' : 'left', maxWidth: center ? 620 : undefined, margin: center ? '0 auto' : undefined }}
    >
      <motion.div variants={fadeUp} className="section-eyebrow">{eyebrow}</motion.div>
      <motion.h2 variants={fadeUp} className="section-title">{title}</motion.h2>
      {body && <motion.p variants={fadeUp} className="section-body" style={{ margin: center ? '0 auto' : undefined }}>{body}</motion.p>}
    </motion.div>
  );

  return (
    <div style={{ fontFamily: 'var(--font-body)', overflowX: 'hidden' }}>

      {/* ── Minimal top bar ─────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 60, background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E5EAF2',
        display: 'flex', alignItems: 'center', padding: '0 32px',
      }}>
        <div style={{ maxWidth: 1100, width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 3L13.5 8H16.5L10 17L3.5 8H6.5L10 3Z" fill="white" opacity="0.95"/></svg>
            </div>
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.4px' }}>HealthOS</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/twin')} style={{ padding: '8px 18px', borderRadius: 9999, fontSize: 13, fontWeight: 500, color: '#64748B', background: 'transparent', border: '1px solid #E5EAF2', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              View Twin
            </button>
            <button onClick={() => navigate('/onboarding')} style={{ padding: '8px 20px', borderRadius: 9999, fontSize: 13, fontWeight: 600, background: '#4F46E5', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(79,70,229,0.25)', fontFamily: 'var(--font-body)' }}>
              Upload Report
            </button>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════════
          1. HERO — white, full viewport
      ════════════════════════════════════════════════════════════════════ */}
      <section ref={heroRef} style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', alignItems: 'center', paddingTop: 60 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 40px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 60, flexWrap: 'wrap' }}>

            {/* Text */}
            <motion.div style={{ flex: 1, minWidth: 320, y: heroY, opacity: heroOpacity }}>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 9999, background: '#EEF2FF', border: '1px solid #C7D2FE', marginBottom: 24 }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4F46E5', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#4F46E5', letterSpacing: '0.3px' }}>AI-powered Digital Health Twin</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.1 }}
                style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(44px, 5.5vw, 76px)', fontWeight: 800, letterSpacing: '-0.04em', color: '#0F172A', lineHeight: 1.08, marginBottom: 24 }}
              >
                Meet your<br />
                <span className="text-gradient">Digital Health</span><br />
                Twin.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.22 }}
                style={{ fontSize: 18, color: '#64748B', lineHeight: 1.75, marginBottom: 36, maxWidth: 480 }}
              >
                Upload any medical document. HealthOS understands it, extracts every health metric, builds your digital twin, and prepares you for every doctor visit — automatically.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.34 }}
                style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <button
                  onClick={() => navigate('/onboarding')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 30px', borderRadius: 9999, background: '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(79,70,229,0.3)', fontFamily: 'var(--font-body)', transition: 'all 0.2s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(79,70,229,0.35)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(79,70,229,0.3)'; }}
                >
                  <Upload size={15} /> Build My Health Twin <ArrowRight size={14} />
                </button>
                <button
                  onClick={() => navigate('/twin')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '13px 22px', borderRadius: 9999, background: 'transparent', color: '#334155', fontSize: 14, fontWeight: 500, border: '1.5px solid #E5EAF2', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.color = '#4F46E5'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5EAF2'; e.currentTarget.style.color = '#334155'; }}
                >
                  <Sparkles size={14} /> View Demo Twin
                </button>
              </motion.div>

              {/* Trust line */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                style={{ display: 'flex', gap: 18, marginTop: 28, alignItems: 'center', flexWrap: 'wrap' }}
              >
                {['CBC & Blood Reports', 'Scanned Reports', 'Prescriptions', 'Lab Photos'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#94A3B8', fontWeight: 500 }}>
                    <CheckCircle size={12} color="#10B981" /> {t}
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              style={{ flexShrink: 0, display: 'flex', justifyContent: 'center' }}
            >
              <HealthOrb />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          2. PROBLEM — #EEF4FF
      ════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#EEF4FF', padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <SectionHeader
            eyebrow="The Problem"
            title={<>Your health data<br />lives everywhere.</>}
            body="Lab reports buried in emails. Prescriptions lost in folders. Doctor notes scattered across clinics. No one — not even your doctor — has the full picture."
            center
          />
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={IV}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 56 }}
          >
            <ProblemCard emoji="📋" headline="Reports pile up, insights don't." body="You get a blood report. It says 'See doctor.' You have no idea what's actually wrong or how serious it is." />
            <ProblemCard emoji="🩺" headline="Every doctor starts from zero." body="Your new cardiologist has never seen your thyroid reports. Your GP doesn't know your lipid history. You start over every time." />
            <ProblemCard emoji="⏳" headline="Health changes over time. Nobody tracks it." body="Your Vitamin D in 2023 vs 2024 vs today tells a story. Nobody is reading that story — until HealthOS." />
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          3. HOW IT WORKS — white
      ════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#FFFFFF', padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
          <div>
            <SectionHeader
              eyebrow="How It Works"
              title="Upload once. Know everything."
              body="HealthOS processes any medical document and turns it into a living, growing picture of your health."
            />
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={IV}
          >
            <Step number="01" title="Upload any medical document" body="PDF lab reports, phone photos, scanned reports, prescriptions — any format, any lab, any clinic." />
            <Step number="02" title="AI reads and understands it" body="Gemini Vision extracts every biomarker, metric, and clinical value with medical-grade accuracy." />
            <Step number="03" title="Your Health Twin is constructed" body="Health score, biological age, pillar scores — your complete health model, updated in real time." />
            <Step number="04" title="Doctor Copilot brief generated" body="Intelligent questions, clinical summary, and visit preparation — ready before every appointment." />
            <Step number="05" title="Future outcomes simulated" body="See how lifestyle changes affect your health trajectory over 3, 6, and 12 months." isLast />
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          4. DOCUMENT INTELLIGENCE — #F8FAFC
      ════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#F8FAFC', padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          {/* Left */}
          <div>
            <SectionHeader
              eyebrow="Document Intelligence"
              title="Any format. Any lab. Any clinic."
              body="HealthOS accepts every type of medical document — even blurry phone photos — and extracts structured health data automatically."
            />
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={IV}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 32 }}
            >
              <FormatBadge icon={FileText} label="Text PDFs" sub="Digital lab reports" />
              <FormatBadge icon={Scan} label="Scanned PDFs" sub="Photocopy reports" />
              <FormatBadge icon={Camera} label="Photos" sub="Camera / WhatsApp" />
              <FormatBadge icon={Activity} label="Prescriptions" sub="Handwritten notes" />
            </motion.div>
          </div>
          {/* Right — extraction preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={IV}
            transition={{ duration: 0.6 }}
            style={{ background: '#FFFFFF', borderRadius: 20, padding: '28px', border: '1px solid #E5EAF2', boxShadow: '0 4px 24px rgba(15,23,42,0.07)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={16} color="#4F46E5" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Blood Report — Jan 2025</div>
                <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Complete Blood Count · Biochemistry</div>
              </div>
              <div style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 9999, background: '#ECFDF5', border: '1px solid rgba(16,185,129,0.2)', fontSize: 11, fontWeight: 600, color: '#059669' }}>
                ✓ Extracted
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>Detected Biomarkers</div>
            <ExtractItem label="Haemoglobin" value="13.2 g/dL" color="#10B981" delay={0} />
            <ExtractItem label="Fasting Glucose" value="89 mg/dL" color="#10B981" delay={0.08} />
            <ExtractItem label="LDL Cholesterol" value="142 mg/dL" color="#F59E0B" delay={0.16} />
            <ExtractItem label="Vitamin D" value="18 ng/mL" color="#EF4444" delay={0.24} />
            <ExtractItem label="TSH" value="2.4 mIU/L" color="#10B981" delay={0.32} />
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#64748B' }}>18 biomarkers extracted</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#4F46E5' }}>98% confidence →</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          5. HEALTH TWIN — #EEF4FF
      ════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#EEF4FF', padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          {/* Left — visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={IV}
            transition={{ duration: 0.6 }}
          >
            <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '32px', border: '1px solid #E5EAF2', boxShadow: '0 8px 40px rgba(15,23,42,0.08)' }}>
              {/* Score */}
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="58" fill="none" stroke="#F1F5F9" strokeWidth="8"/>
                    <circle cx="70" cy="70" r="58" fill="none" stroke="url(#grad1)" strokeWidth="8"
                      strokeDasharray="330" strokeDashoffset="60" strokeLinecap="round" transform="rotate(-90 70 70)"/>
                    <defs>
                      <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10B981"/>
                        <stop offset="100%" stopColor="#4F46E5"/>
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 38, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>78</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginTop: 2 }}>Health Score</div>
                  </div>
                </div>
              </div>
              {/* Pillars */}
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', gap: 8 }}>
                <Pillar label="Heart" score={82} color="#EF4444" />
                <Pillar label="Metabolic" score={75} color="#F59E0B" />
                <Pillar label="Nutrition" score={60} color="#10B981" />
                <Pillar label="Thyroid" score={88} color="#6366F1" />
                <Pillar label="Sleep" score={70} color="#3B82F6" />
                <Pillar label="Immunity" score={79} color="#8B5CF6" />
              </div>
              <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: 12, color: '#64748B' }}>Biological Age:</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#10B981', marginLeft: 6 }}>2 years younger ↓</span>
              </div>
            </div>
          </motion.div>
          {/* Right */}
          <div>
            <SectionHeader
              eyebrow="Your Health Twin"
              title="Not a dashboard. A living model of you."
              body="Your Digital Health Twin understands your entire medical history and builds a personalised health profile — updated every time you upload a report."
            />
            {[
              { emoji: '🧬', title: 'Biological Age', body: 'Know if your body is aging faster or slower than your years.' },
              { emoji: '📊', title: 'Health Pillar Scores', body: 'Cardiovascular, metabolic, nutritional, thyroid, sleep, immunity — all tracked.' },
              { emoji: '⚠️', title: 'Smart Watchlist', body: 'Values that need attention, explained in plain language.' },
            ].map(({ emoji, title, body }) => (
              <motion.div key={title} variants={fadeUp} initial="hidden" whileInView="visible" viewport={IV}
                style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{emoji}</span>
                <div>
                  <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.55 }}>{body}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          6. DOCTOR COPILOT — white
      ════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#FFFFFF', padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <SectionHeader
              eyebrow="Doctor Copilot"
              title="Walk into every appointment prepared."
              body="HealthOS generates intelligent questions, a clinical summary, and a complete visit brief — so every doctor conversation is informed and productive."
            />
            <motion.div initial="hidden" whileInView="visible" viewport={IV} variants={stagger} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 28 }}>
              {[
                'Why has my LDL been rising despite a healthy diet?',
                'Is my Vitamin D level low enough to require supplements?',
                'Should I be concerned about my fasting glucose trend?',
              ].map((q, i) => (
                <motion.div key={i} variants={fadeUp} style={{
                  padding: '13px 18px', borderRadius: 12,
                  background: '#F8FAFC', border: '1px solid #E5EAF2',
                  fontSize: 13.5, color: '#334155', lineHeight: 1.5,
                  borderLeft: '3px solid #4F46E5',
                }}>
                  <span style={{ fontSize: 11.5, color: '#94A3B8', display: 'block', marginBottom: 3 }}>Question {i + 1}</span>
                  {q}
                </motion.div>
              ))}
            </motion.div>
          </div>
          {/* Right — visit brief card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={IV}
            transition={{ duration: 0.6 }}
            style={{ background: '#F8FAFC', borderRadius: 20, padding: '28px', border: '1px solid #E5EAF2', boxShadow: '0 4px 20px rgba(15,23,42,0.06)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Stethoscope size={16} color="#4F46E5" />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>Doctor Visit Brief</div>
                <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Ready to share</div>
              </div>
            </div>
            {[
              { label: 'Primary Concern', value: 'Elevated LDL Cholesterol' },
              { label: 'Trend', value: '↑ 18% over 6 months' },
              { label: 'Related Metrics', value: 'Triglycerides, HDL/LDL ratio' },
              { label: 'Recommended Action', value: 'Discuss statin review' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #E5EAF2', fontSize: 13 }}>
                <span style={{ color: '#94A3B8', fontWeight: 500 }}>{label}</span>
                <span style={{ color: '#0F172A', fontWeight: 600, maxWidth: '55%', textAlign: 'right' }}>{value}</span>
              </div>
            ))}
            <button style={{ width: '100%', marginTop: 18, padding: '11px', borderRadius: 10, background: '#EEF2FF', color: '#4F46E5', fontSize: 13, fontWeight: 600, border: '1px solid #C7D2FE', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Share with Doctor →
            </button>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          7. FUTURE SIMULATOR — #F5F7FB
      ════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#F5F7FB', padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <SectionHeader
            eyebrow="Future Simulator"
            title="See your health in 3, 6, and 12 months."
            body="Choose a lifestyle scenario. HealthOS simulates the projected impact on your biomarkers and health score — personalised to your twin."
            center
          />
          {/* Scenario pills */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={IV}
            variants={stagger}
            style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 40, marginBottom: 40 }}
          >
            {[
              { label: '🥗 Better Nutrition', active: true },
              { label: '🏃 Exercise Plan', active: false },
              { label: '💊 Add Supplements', active: false },
              { label: '😴 Improve Sleep', active: false },
            ].map(({ label, active }) => (
              <motion.div key={label} variants={scaleIn} style={{
                padding: '10px 20px', borderRadius: 9999, fontSize: 14, fontWeight: 500,
                background: active ? '#4F46E5' : '#FFFFFF',
                color: active ? '#FFFFFF' : '#64748B',
                border: active ? '1px solid #4F46E5' : '1px solid #E5EAF2',
                cursor: 'pointer',
                boxShadow: active ? '0 4px 16px rgba(79,70,229,0.25)' : '0 1px 4px rgba(15,23,42,0.05)',
              }}>
                {label}
              </motion.div>
            ))}
          </motion.div>
          {/* Outcome grid */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={IV}
            variants={stagger}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, maxWidth: 760, margin: '0 auto' }}
          >
            {[
              { metric: 'LDL Cholesterol', change: '↓ 14%', color: '#10B981', bg: '#ECFDF5' },
              { metric: 'Health Score', change: '+8 points', color: '#4F46E5', bg: '#EEF2FF' },
              { metric: 'Vitamin D', change: '↑ 22%', color: '#10B981', bg: '#ECFDF5' },
              { metric: 'Biological Age', change: '↓ 1.2 yrs', color: '#4F46E5', bg: '#EEF2FF' },
            ].map(({ metric, change, color, bg }) => (
              <motion.div key={metric} variants={scaleIn} style={{
                background: bg, borderRadius: 16, padding: '20px', border: `1px solid ${color}20`,
              }}>
                <div style={{ fontSize: 22, fontFamily: "'Sora', sans-serif", fontWeight: 800, color, marginBottom: 4 }}>{change}</div>
                <div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 500 }}>{metric}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>in 3 months</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          7.5. TRY HEALTHOS INSTANTLY — #EEF4FF
      ════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#EEF4FF', padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <SectionHeader
            eyebrow="Instant Demo"
            title="Try HealthOS Instantly"
            body="No medical report on hand? Click one of the profiles below to analyze a demo report and experience the full platform."
            center
          />

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={IV}
            variants={stagger}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 20,
              marginTop: 48,
              textAlign: 'left'
            }}
          >
            {[
              {
                id: 'healthy-adult',
                title: 'Healthy Profile',
                emoji: '🟢',
                summary: 'Comprehensive checkup showing optimal cardiovascular, metabolic, and vitamin levels.',
                biomarkers: 16,
                twinType: 'Healthy Adult',
                color: '#10B981',
                bg: '#ECFDF5'
              },
              {
                id: 'vitamin-d',
                title: 'Vitamin D Deficiency',
                emoji: '🟡',
                summary: 'Standard report indicating low Vitamin D-3, mild fatigue markers, and normal blood sugar.',
                biomarkers: 10,
                twinType: 'Fatigue / Deficiency Profile',
                color: '#F59E0B',
                bg: '#FFFBEB'
              },
              {
                id: 'metabolic-risk',
                title: 'Metabolic Risk',
                emoji: '🔴',
                summary: 'A high-glucose, high-HbA1c, and elevated triglycerides panel showing insulin resistance markers.',
                biomarkers: 10,
                twinType: 'Prediabetes / Cardio Risk',
                color: '#EF4444',
                bg: '#FEF2F2'
              }
            ].map(card => (
              <motion.div
                key={card.id}
                variants={scaleIn}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 24,
                  padding: '32px 28px',
                  border: '1px solid #E5EAF2',
                  boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease'
                }}
                whileHover={{ y: -6, boxShadow: '0 12px 30px rgba(15,23,42,0.08)' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ fontSize: 24 }}>{card.emoji}</div>
                    <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      {card.title}
                    </h3>
                  </div>

                  <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, marginBottom: 20 }}>
                    {card.summary}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569' }}>
                      <span style={{ fontWeight: 500 }}>Biomarkers Detected:</span>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>{card.biomarkers} metrics</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569' }}>
                      <span style={{ fontWeight: 500 }}>Expected Twin Type:</span>
                      <span style={{ fontWeight: 700, color: card.color, background: `${card.color}10`, padding: '2px 8px', borderRadius: 6 }}>
                        {card.twinType}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    e.currentTarget.disabled = true;
                    const originalText = e.currentTarget.innerText;
                    e.currentTarget.innerText = 'Analyzing...';
                    try {
                      const data = await analyzeDemoReport(card.id);
                      if (data.success && data.reportId) {
                        navigate(`/processing?reportId=${data.reportId}`);
                      } else {
                        alert(data.error || 'Failed to trigger demo analysis.');
                        e.currentTarget.disabled = false;
                        e.currentTarget.innerText = originalText;
                      }
                    } catch (err) {
                      console.error('Trigger demo error:', err);
                      alert('Connection error. Failed to run demo report.');
                      e.currentTarget.disabled = false;
                      e.currentTarget.innerText = originalText;
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 18px',
                    borderRadius: 9999,
                    background: card.color,
                    color: '#FFFFFF',
                    fontSize: 13.5,
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontFamily: 'var(--font-body)',
                    boxShadow: `0 4px 12px ${card.color}20`,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Sparkles size={13} /> Analyze Demo Report
                </button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          8. TRUST — white
      ════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#FFFFFF', padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <SectionHeader eyebrow="Trust & Privacy" title="Built for trust." center />
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={IV}
            variants={stagger}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 44 }}
          >
            <TrustBadge icon="🔒" title="HIPAA Compliant Architecture" body="All data processed locally. No health data shared with third parties, ever." />
            <TrustBadge icon="🧠" title="Gemini 2.5 Flash Powered" body="State-of-the-art multimodal AI for medical document understanding." />
            <TrustBadge icon="✅" title="Clinical Rules Engine" body="Validated reference ranges and clinical evaluation, not just AI guesses." />
            <TrustBadge icon="📊" title="Evidence-backed Insights" body="Every insight cites the medical data it was derived from — full traceability." />
          </motion.div>
          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={IV}
            transition={{ duration: 0.5 }}
            style={{ display: 'flex', justifyContent: 'center', gap: 60, marginTop: 56, flexWrap: 'wrap' }}
          >
            {[
              { n: '5+', label: 'Report Types' },
              { n: '98%', label: 'Extraction Accuracy' },
              { n: '<2s', label: 'Avg Processing' },
              { n: '0', label: 'Data Shared' },
            ].map(({ n, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 36, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em' }}>{n}</div>
                <div style={{ fontSize: 12.5, color: '#94A3B8', fontWeight: 500, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          9. FINAL CTA — #EEF4FF
      ════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#EEF4FF', padding: '120px 40px' }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={IV}
          variants={stagger}
          style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}
        >
          <motion.div variants={fadeUp} style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,#4F46E5,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', boxShadow: '0 8px 32px rgba(79,70,229,0.25)' }}>
            <svg width="28" height="28" viewBox="0 0 20 20" fill="none"><path d="M10 3L13.5 8H16.5L10 17L3.5 8H6.5L10 3Z" fill="white"/></svg>
          </motion.div>
          <motion.h2 variants={fadeUp} style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', color: '#0F172A', marginBottom: 18, lineHeight: 1.1 }}>
            Your health story<br />starts with one upload.
          </motion.h2>
          <motion.p variants={fadeUp} style={{ fontSize: 17, color: '#64748B', lineHeight: 1.7, marginBottom: 36 }}>
            Upload your first medical report. HealthOS will build your Health Twin in under 60 seconds.
          </motion.p>
          <motion.div variants={fadeUp} style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/onboarding')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 34px', borderRadius: 9999, background: '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 6px 24px rgba(79,70,229,0.3)', fontFamily: 'var(--font-body)', transition: 'all 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Upload size={15} /> Upload My First Report <ArrowRight size={14} />
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#FFFFFF', borderTop: '1px solid #E5EAF2', padding: '28px 40px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: 'linear-gradient(135deg,#4F46E5,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M10 3L13.5 8H16.5L10 17L3.5 8H6.5L10 3Z" fill="white"/></svg>
          </div>
          <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 700, color: '#0F172A' }}>HealthOS</span>
        </div>
        <div style={{ fontSize: 12, color: '#94A3B8' }}>Built at MLH Hackathon · Your health, understood.</div>
      </footer>
    </div>
  );
}
