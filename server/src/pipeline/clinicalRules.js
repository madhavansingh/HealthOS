// HealthOS Clinical Rules Engine
// Deterministic medical validation rules based on ADA, AHA, WHO, and Endocrine Society guidelines.
// Runs BEFORE the Gemini reasoning layer to ensure clinical accuracy.

const RULES = {
  vitamin_d: {
    name: 'Vitamin D',
    match: ['vitamin d', '25-hydroxy', '25-oh'],
    evaluate: (val) => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      if (val < 20) return { status: 'critical_low', desc: 'Deficient (< 20 ng/mL)', low: 30, high: 100 };
      if (val < 30) return { status: 'low', desc: 'Insufficient (20-29 ng/mL)', low: 30, high: 100 };
      if (val > 100) return { status: 'high', desc: 'Elevated (> 100 ng/mL)', low: 30, high: 100 };
      return { status: 'normal', desc: 'Normal (30-100 ng/mL)', low: 30, high: 100 };
    }
  },
  ldl: {
    name: 'LDL Cholesterol',
    match: ['ldl cholesterol', 'ldl', 'low density lipoprotein'],
    evaluate: (val) => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      if (val < 100) return { status: 'normal', desc: 'Optimal (< 100 mg/dL)', low: 0, high: 99 };
      if (val < 130) return { status: 'normal', desc: 'Near Optimal (100-129 mg/dL)', low: 0, high: 99 };
      if (val < 160) return { status: 'warning', desc: 'Borderline High (130-159 mg/dL)', low: 0, high: 99 };
      if (val < 190) return { status: 'high', desc: 'High (160-189 mg/dL)', low: 0, high: 99 };
      return { status: 'critical_high', desc: 'Very High (>= 190 mg/dL)', low: 0, high: 99 };
    }
  },
  hdl: {
    name: 'HDL Cholesterol',
    match: ['hdl cholesterol', 'hdl', 'high density lipoprotein'],
    evaluate: (val, gender = 'Male') => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      const limit = gender.toLowerCase() === 'female' ? 50 : 40;
      if (val < limit) return { status: 'low', desc: `Low (< ${limit} mg/dL) - Cardioprotective deficit`, low: limit, high: 100 };
      if (val > 60) return { status: 'normal', desc: 'Optimal (> 60 mg/dL) - Cardioprotective', low: limit, high: 100 };
      return { status: 'normal', desc: 'Normal range', low: limit, high: 100 };
    }
  },
  total_cholesterol: {
    name: 'Total Cholesterol',
    match: ['total cholesterol', 'cholesterol, total', 'cholesterol'],
    evaluate: (val) => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      if (val < 200) return { status: 'normal', desc: 'Desirable (< 200 mg/dL)', low: 100, high: 199 };
      if (val < 240) return { status: 'warning', desc: 'Borderline High (200-239 mg/dL)', low: 100, high: 199 };
      return { status: 'high', desc: 'High (>= 240 mg/dL)', low: 100, high: 199 };
    }
  },
  triglycerides: {
    name: 'Triglycerides',
    match: ['triglycerides', 'trig'],
    evaluate: (val) => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      if (val < 150) return { status: 'normal', desc: 'Normal (< 150 mg/dL)', low: 0, high: 149 };
      if (val < 200) return { status: 'warning', desc: 'Borderline High (150-199 mg/dL)', low: 0, high: 149 };
      if (val < 500) return { status: 'high', desc: 'High (200-499 mg/dL)', low: 0, high: 149 };
      return { status: 'critical_high', desc: 'Very High (>= 500 mg/dL)', low: 0, high: 149 };
    }
  },
  glucose: {
    name: 'Fasting Glucose',
    match: ['fasting glucose', 'glucose, fasting', 'blood sugar', 'glucose'],
    evaluate: (val) => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      if (val < 70) return { status: 'critical_low', desc: 'Hypoglycemia (< 70 mg/dL)', low: 70, high: 99 };
      if (val < 100) return { status: 'normal', desc: 'Normal Fasting (70-99 mg/dL)', low: 70, high: 99 };
      if (val < 126) return { status: 'warning', desc: 'Prediabetes (100-125 mg/dL)', low: 70, high: 99 };
      return { status: 'critical_high', desc: 'Diabetes Range (>= 126 mg/dL)', low: 70, high: 99 };
    }
  },
  hba1c: {
    name: 'HbA1c',
    match: ['hba1c', 'hemoglobin a1c', 'glycated hemoglobin', 'a1c'],
    evaluate: (val) => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      if (val < 5.7) return { status: 'normal', desc: 'Normal (< 5.7%)', low: 4.0, high: 5.6 };
      if (val < 6.5) return { status: 'warning', desc: 'Prediabetes (5.7-6.4%)', low: 4.0, high: 5.6 };
      return { status: 'critical_high', desc: 'Diabetes Range (>= 6.5%)', low: 4.0, high: 5.6 };
    }
  },
  tsh: {
    name: 'TSH',
    match: ['tsh', 'thyroid stimulating hormone'],
    evaluate: (val) => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      if (val < 0.4) return { status: 'low', desc: 'Hyperthyroid Indicator (< 0.4 mIU/L)', low: 0.4, high: 4.5 };
      if (val <= 4.5) return { status: 'normal', desc: 'Normal (0.4-4.5 mIU/L)', low: 0.4, high: 4.5 };
      if (val <= 10.0) return { status: 'warning', desc: 'Subclinical Hypothyroidism (4.6-10 mIU/L)', low: 0.4, high: 4.5 };
      return { status: 'high', desc: 'Hypothyroidism Indicator (> 10 mIU/L)', low: 0.4, high: 4.5 };
    }
  },
  hemoglobin: {
    name: 'Hemoglobin',
    match: ['hemoglobin', 'hgb'],
    evaluate: (val, gender = 'Male') => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      const lowLimit = gender.toLowerCase() === 'female' ? 12.0 : 13.0;
      const highLimit = gender.toLowerCase() === 'female' ? 15.5 : 17.5;
      if (val < lowLimit) return { status: 'low', desc: `Low Anemia Risk (< ${lowLimit} g/dL)`, low: lowLimit, high: highLimit };
      if (val > highLimit) return { status: 'high', desc: `Elevated (> ${highLimit} g/dL)`, low: lowLimit, high: highLimit };
      return { status: 'normal', desc: 'Normal range', low: lowLimit, high: highLimit };
    }
  },
  rbc: {
    name: 'RBC',
    match: ['rbc', 'red blood cell', 'red blood count', 'red blood cells'],
    evaluate: (val, gender = 'Male') => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      const lowLimit = gender.toLowerCase() === 'female' ? 3.5 : 4.3;
      const highLimit = gender.toLowerCase() === 'female' ? 5.5 : 5.9;
      if (val < lowLimit) return { status: 'low', desc: `Low RBC Count (< ${lowLimit} M/uL)`, low: lowLimit, high: highLimit };
      if (val > highLimit) return { status: 'high', desc: `Elevated RBC Count (> ${highLimit} M/uL)`, low: lowLimit, high: highLimit };
      return { status: 'normal', desc: 'Normal RBC Count', low: lowLimit, high: highLimit };
    }
  },
  hematocrit: {
    name: 'Hematocrit',
    match: ['hematocrit', 'hct', 'pcv', 'packed cell volume'],
    evaluate: (val, gender = 'Male') => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      const lowLimit = gender.toLowerCase() === 'female' ? 36.0 : 41.0;
      const highLimit = gender.toLowerCase() === 'female' ? 48.0 : 50.0;
      if (val < lowLimit) return { status: 'low', desc: `Low Hematocrit (< ${lowLimit}%)`, low: lowLimit, high: highLimit };
      if (val > highLimit) return { status: 'high', desc: `Elevated Hematocrit (> ${highLimit}%)`, low: lowLimit, high: highLimit };
      return { status: 'normal', desc: 'Normal Hematocrit', low: lowLimit, high: highLimit };
    }
  },
  mcv: {
    name: 'MCV',
    match: ['mcv', 'mean corpuscular volume'],
    evaluate: (val) => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      if (val < 80.0) return { status: 'low', desc: 'Microcytic MCV (< 80.0 fL) - Potential Iron Deficiency', low: 80.0, high: 100.0 };
      if (val > 100.0) return { status: 'high', desc: 'Macrocytic MCV (> 100.0 fL) - Potential B12/Folate Deficiency', low: 80.0, high: 100.0 };
      return { status: 'normal', desc: 'Normal MCV', low: 80.0, high: 100.0 };
    }
  },
  mch: {
    name: 'MCH',
    match: ['mch', 'mean corpuscular hemoglobin'],
    evaluate: (val) => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      if (val < 27.0) return { status: 'low', desc: 'Low MCH (< 27.0 pg) - Hypochromic indicator', low: 27.0, high: 33.0 };
      if (val > 33.0) return { status: 'high', desc: 'Elevated MCH (> 33.0 pg)', low: 27.0, high: 33.0 };
      return { status: 'normal', desc: 'Normal MCH', low: 27.0, high: 33.0 };
    }
  },
  mchc: {
    name: 'MCHC',
    match: ['mchc', 'mean corpuscular hemoglobin concentration'],
    evaluate: (val) => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      if (val < 32.0) return { status: 'low', desc: 'Low MCHC (< 32.0 g/dL) - Hypochromic indicator', low: 32.0, high: 36.0 };
      if (val > 36.0) return { status: 'high', desc: 'Elevated MCHC (> 36.0 g/dL)', low: 32.0, high: 36.0 };
      return { status: 'normal', desc: 'Normal MCHC', low: 32.0, high: 36.0 };
    }
  },
  rdw: {
    name: 'RDW',
    match: ['rdw', 'red cell distribution width', 'rdw-cv', 'rdw-sd'],
    evaluate: (val) => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      if (val < 11.0) return { status: 'low', desc: 'Low RDW (< 11.0%)', low: 11.0, high: 15.0 };
      if (val > 15.0) return { status: 'high', desc: 'Elevated RDW (> 15.0%) - Anisocytosis indicator', low: 11.0, high: 15.0 };
      return { status: 'normal', desc: 'Normal RDW', low: 11.0, high: 15.0 };
    }
  },
  blood_pressure: {
    name: 'Systolic Blood Pressure',
    match: ['systolic bp', 'systolic blood pressure', 'bp systolic', 'blood pressure systolic'],
    evaluate: (val) => {
      if (val === null || val === undefined) return { status: 'normal', desc: 'Not tested' };
      if (val < 90) return { status: 'low', desc: 'Hypotension (< 90 mmHg)', low: 90, high: 120 };
      if (val < 120) return { status: 'normal', desc: 'Normal (< 120 mmHg)', low: 90, high: 120 };
      if (val < 130) return { status: 'warning', desc: 'Elevated (120-129 mmHg)', low: 90, high: 120 };
      if (val < 140) return { status: 'warning', desc: 'Hypertension Stage 1 (130-139 mmHg)', low: 90, high: 120 };
      if (val <= 180) return { status: 'high', desc: 'Hypertension Stage 2 (140-180 mmHg)', low: 90, high: 120 };
      return { status: 'critical_high', desc: 'Hypertensive Crisis (> 180 mmHg)', low: 90, high: 120 };
    }
  }
};

/**
 * Deterministically validates and classifies a medical metric.
 * Matches metric names by keywords.
 */
function evaluateMetric(metricName, value, gender = 'Male') {
  const normName = String(metricName || '').toLowerCase().trim();

  // Find matching rule
  for (const key of Object.keys(RULES)) {
    const rule = RULES[key];
    const matches = rule.match.some(keyword => normName.includes(keyword) || keyword.includes(normName));
    if (matches && typeof value === 'number') {
      const result = rule.evaluate(value, gender);
      return {
        metric_name: rule.name,
        value,
        status: result.status,
        desc: result.desc,
        reference_low: result.low !== undefined ? result.low : null,
        reference_high: result.high !== undefined ? result.high : null
      };
    }
  }

  // Default fallback if no specific rule matches
  return {
    metric_name: metricName,
    value,
    status: 'normal',
    desc: 'Unclassified biomarker',
    reference_low: null,
    reference_high: null
  };
}

module.exports = { evaluateMetric };
