import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Camera, Scan, Shield,
  CheckCircle, X, ArrowRight, AlertCircle
} from 'lucide-react';
import { uploadReport, analyzeDemoReport } from '../../../api/client';

const ACCEPTED = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

const FORMAT_INFO = [
  { icon: FileText, label: 'PDF Reports', sub: 'Digital lab printouts', color: '#4F46E5' },
  { icon: Camera,   label: 'Photos',      sub: 'Camera or WhatsApp images', color: '#3B82F6' },
  { icon: Scan,     label: 'Scans',       sub: 'Photocopied or scanned reports', color: '#10B981' },
  { icon: FileText, label: 'Prescriptions', sub: 'Handwritten doctor notes', color: '#8B5CF6' },
];

const EXAMPLE_REPORTS = [
  { emoji: '🩸', label: 'Complete Blood Count', type: 'Blood Report', color: '#EF4444' },
  { emoji: '💉', label: 'Lipid Profile', type: 'Cholesterol Panel', color: '#F59E0B' },
  { emoji: '☀️', label: 'Vitamin Panel', type: 'Vitamin D & B12', color: '#10B981' },
  { emoji: '🦋', label: 'Thyroid Profile', type: 'TSH & T3/T4', color: '#6366F1' },
  { emoji: '📊', label: 'Diabetes Panel', type: 'HbA1c & Glucose', color: '#3B82F6' },
  { emoji: '💊', label: 'Prescription', type: 'Doctor note', color: '#8B5CF6' },
];

function FilePreview({ file, onRemove }) {
  const isImage = file.type.startsWith('image/');
  const ext = file.name.split('.').pop().toUpperCase();
  const sizeKB = (file.size / 1024).toFixed(0);
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Preview area */}
      <div style={{
        flex: 1, borderRadius: 16, overflow: 'hidden',
        background: '#F8FAFC', border: '1px solid #E5EAF2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', minHeight: 200,
      }}>
        {isImage ? (
          <img
            src={URL.createObjectURL(file)}
            alt="Preview"
            style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10 }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{
              width: 72, height: 90, background: '#EEF2FF', borderRadius: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', border: '1px solid #C7D2FE',
            }}>
              <FileText size={28} color="#4F46E5" />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#6366F1', marginTop: 4, letterSpacing: '0.5px' }}>{ext}</span>
            </div>
            <div style={{ fontSize: 13, color: '#64748B' }}>PDF Document</div>
          </div>
        )}
        {/* Remove */}
        <button
          onClick={onRemove}
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 26, height: 26, borderRadius: '50%',
            background: 'rgba(15,23,42,0.08)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={12} color="#64748B" />
        </button>
      </div>

      {/* File info */}
      <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', border: '1px solid #E5EAF2' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F172A', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94A3B8' }}>
          <span>{ext} file</span>
          <span>·</span>
          <span>{file.size > 1048576 ? `${sizeMB} MB` : `${sizeKB} KB`}</span>
        </div>
      </div>

      {/* Detected format */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#ECFDF5', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(16,185,129,0.2)' }}>
        <CheckCircle size={14} color="#10B981" />
        <span style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}>
          {isImage ? 'Photo detected — will use AI Vision + OCR' : 'PDF detected — will use text extraction'}
        </span>
      </div>
    </motion.div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [reportName, setReportName] = useState('');

  const handleFile = (f) => {
    setError('');
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setError(`Unsupported file type. Please upload: ${ACCEPTED.join(', ')}`);
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File too large. Maximum size is 20 MB.');
      return;
    }
    setFile(f);
    const name = f.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    setReportName(name);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, []);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const handleInputChange = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const res = await uploadReport(file, reportName || file.name);
      navigate(`/processing?reportId=${res.reportId}`);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'var(--font-body)' }}>
      {/* Simple top bar */}
      <nav style={{ height: 60, background: '#FFFFFF', borderBottom: '1px solid #E5EAF2', display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between' }}>
        <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#4F46E5,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 3L13.5 8H16.5L10 17L3.5 8H6.5L10 3Z" fill="white" opacity="0.95"/></svg>
          </div>
          <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.4px' }}>HealthOS</span>
        </div>
        <button onClick={() => navigate(-1)} style={{ fontSize: 13, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}>
          ← Back
        </button>
      </nav>

      {/* Main content — split layout */}
      <div style={{
        maxWidth: 1100, margin: '0 auto', padding: '60px 40px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start',
        minHeight: 'calc(100vh - 60px)',
      }}>

        {/* ── Left: Document preview panel ──────────────────────────────── */}
        <div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4F46E5', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>Document Preview</div>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em', color: '#0F172A', marginBottom: 8, lineHeight: 1.2 }}>
                We read every<br />type of report.
              </h2>
              <p style={{ fontSize: 14.5, color: '#64748B', lineHeight: 1.65 }}>
                Select a file to see a preview. HealthOS automatically detects the document type and routes it to the best extraction pipeline.
              </p>
            </div>

            {/* Preview area */}
            <div style={{
              background: '#FFFFFF', borderRadius: 20, padding: 24,
              border: '1px solid #E5EAF2', boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
              minHeight: 360, display: 'flex', flexDirection: 'column',
            }}>
              <AnimatePresence mode="wait">
                {file ? (
                  <FilePreview key="preview" file={file} onRemove={() => setFile(null)} />
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 12 }}>
                        Supported Report Types
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
                        {EXAMPLE_REPORTS.map(({ emoji, label, type, color }) => (
                          <div key={label} style={{
                            display: 'flex', gap: 10, alignItems: 'center',
                            padding: '10px 12px', borderRadius: 10,
                            background: '#F8FAFC', border: '1px solid #F1F5F9',
                          }}>
                            <span style={{ fontSize: 20 }}>{emoji}</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{label}</div>
                              <div style={{ fontSize: 11, color: '#94A3B8' }}>{type}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Format chips */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 10 }}>
                        Accepted Formats
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['PDF', 'JPG', 'PNG', 'WEBP'].map(f => (
                          <span key={f} style={{ padding: '4px 11px', borderRadius: 9999, background: '#EEF2FF', border: '1px solid #C7D2FE', fontSize: 11.5, fontWeight: 600, color: '#4F46E5' }}>{f}</span>
                        ))}
                        <span style={{ padding: '4px 11px', borderRadius: 9999, background: '#F8FAFC', border: '1px solid #E5EAF2', fontSize: 11.5, color: '#94A3B8' }}>Max 20 MB</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* ── Right: Upload panel ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4F46E5', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>Upload Report</div>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em', color: '#0F172A', marginBottom: 8, lineHeight: 1.2 }}>
              Upload your<br />medical report.
            </h1>
            <p style={{ fontSize: 14.5, color: '#64748B', lineHeight: 1.65 }}>
              HealthOS will read it, extract every health metric, and build your Digital Health Twin.
            </p>
          </div>

          {/* Drop zone */}
          <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              style={{
                borderRadius: 18,
                border: `2px dashed ${dragging ? '#4F46E5' : '#D1D5DB'}`,
                background: dragging ? '#EEF2FF' : '#FAFBFD',
                padding: '44px 32px',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                marginBottom: 20,
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: dragging ? '#EEF2FF' : '#F3F4F6',
                border: `1.5px solid ${dragging ? '#C7D2FE' : '#E5E7EB'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                transition: 'all 0.2s ease',
              }}>
                <Upload size={22} color={dragging ? '#4F46E5' : '#9CA3AF'} />
              </div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                {dragging ? 'Drop to analyse' : 'Drag & drop or click to upload'}
              </div>
              <div style={{ fontSize: 13.5, color: '#9CA3AF' }}>
                PDF, JPG, PNG, WEBP up to 20 MB
              </div>
            </div>
          </label>
          <input id="file-upload" type="file" accept={ACCEPTED.join(',')} onChange={handleInputChange} style={{ display: 'none' }} />

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 14 }}
              >
                <AlertCircle size={14} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: '#DC2626' }}>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Report name */}
          {file && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{ marginBottom: 20 }}
            >
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Report name (optional)
              </label>
              <input
                type="text"
                value={reportName}
                onChange={e => setReportName(e.target.value)}
                placeholder="e.g. CBC June 2025"
                className="input"
              />
            </motion.div>
          )}

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: file && !uploading ? '#4F46E5' : '#E5EAF2',
              color: file && !uploading ? '#FFFFFF' : '#94A3B8',
              fontSize: 15, fontWeight: 700, border: 'none',
              cursor: file && !uploading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              fontFamily: 'var(--font-body)',
              boxShadow: file && !uploading ? '0 4px 18px rgba(79,70,229,0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {uploading ? (
              <>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
                Uploading &amp; Analysing…
              </>
            ) : (
              <>
                <ArrowRight size={15} /> Analyse Report
              </>
            )}
          </button>

          {/* Pipeline preview */}
          <div style={{ marginTop: 24, padding: '16px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #E5EAF2' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10 }}>What happens next</div>
            {[
              { step: '01', label: 'Document type detected' },
              { step: '02', label: 'Health metrics extracted' },
              { step: '03', label: 'Health Twin constructed' },
              { step: '04', label: 'Doctor brief generated' },
            ].map(({ step, label }, i) => (
              <div key={step} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: i < 3 ? 8 : 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#4F46E5', fontFamily: "'Sora', sans-serif", minWidth: 22 }}>{step}</span>
                <span style={{ fontSize: 13, color: '#64748B' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Security note */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, padding: '11px 14px', borderRadius: 10, background: '#F0FDF4', border: '1px solid rgba(16,185,129,0.18)' }}>
            <Shield size={13} color="#10B981" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: '#065F46', lineHeight: 1.5 }}>
              Your file is processed locally. No health data is shared with third parties.
            </span>
          </div>

          {/* Demo Reports Section */}
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #E5EAF2' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              No report available?
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
              Try a demo report to experience HealthOS instantly.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  id: 'healthy-adult',
                  title: 'Healthy Profile',
                  emoji: '🟢',
                  summary: 'Optimal cardiovascular, metabolic, and vitamin levels.',
                  metrics: 16,
                  color: '#10B981',
                  bg: '#ECFDF5'
                },
                {
                  id: 'vitamin-d',
                  title: 'Vitamin D Deficiency',
                  emoji: '🟡',
                  summary: 'Low Vitamin D-3, mild fatigue, normal glucose.',
                  metrics: 10,
                  color: '#F59E0B',
                  bg: '#FFFBEB'
                },
                {
                  id: 'metabolic-risk',
                  title: 'Metabolic Risk',
                  emoji: '🔴',
                  summary: 'High glucose, HbA1c, and elevated triglycerides.',
                  metrics: 10,
                  color: '#EF4444',
                  bg: '#FEF2F2'
                }
              ].map(demo => (
                <div
                  key={demo.id}
                  onClick={async (e) => {
                    if (uploading) return;
                    setUploading(true);
                    setError('');
                    try {
                      const data = await analyzeDemoReport(demo.id);
                      if (data.success && data.reportId) {
                        navigate(`/processing?reportId=${data.reportId}`);
                      } else {
                        setError(data.error || 'Failed to trigger demo analysis.');
                        setUploading(false);
                      }
                    } catch (err) {
                      console.error('Trigger demo error:', err);
                      setError('Connection error. Failed to run demo report.');
                      setUploading(false);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 14,
                    background: '#FFFFFF',
                    border: '1px solid #E5EAF2',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { if (!uploading) e.currentTarget.style.borderColor = demo.color; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5EAF2'; }}
                >
                  <span style={{ fontSize: 20 }}>{demo.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{demo.title}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.3 }}>{demo.summary}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: demo.color, background: `${demo.color}12`, padding: '2px 7px', borderRadius: 4 }}>
                      {demo.metrics} metrics
                    </span>
                    <span style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: 600 }}>Analyze →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
