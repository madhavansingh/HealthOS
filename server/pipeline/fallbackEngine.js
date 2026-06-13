/**
 * HealthOS Fallback Engine
 *
 * Generates a full Health Twin, insights, and Doctor Copilot brief
 * using ONLY clinical rules + deterministic logic — no Gemini required.
 *
 * Activated whenever Gemini is unavailable (quota, rate-limit, outage).
 * Produces real, clinically grounded output from extracted biomarkers.
 */

const { evaluateMetric } = require('../pipeline/clinicalRules');

// ── Insight templates keyed by metric pattern ──────────────────────────────
const INSIGHT_TEMPLATES = {
  vitamin_d: {
    match: ['vitamin d', '25-oh', '25-hydroxy'],
    deficient: {
      title: 'Vitamin D Deficiency Detected',
      description: 'Your Vitamin D level is below 20 ng/mL, indicating deficiency. Vitamin D is critical for bone health, immune function, and mood regulation.',
      recommendation: 'Consider daily supplementation (2000–4000 IU) and 15–20 minutes of morning sunlight. Recheck in 3 months.',
      category: 'Nutrition',
      severity: 'warning',
      icon: 'sun',
    },
    insufficient: {
      title: 'Vitamin D Insufficient',
      description: 'Your Vitamin D level is between 20–29 ng/mL, below the optimal range of 30+ ng/mL.',
      recommendation: 'Consider moderate supplementation (1000–2000 IU/day) and discuss with your doctor.',
      category: 'Nutrition',
      severity: 'caution',
      icon: 'sun',
    },
  },
  ldl: {
    match: ['ldl', 'low density'],
    borderline: {
      title: 'LDL Cholesterol Borderline High',
      description: 'LDL cholesterol in the 130–159 mg/dL range is borderline high. Elevated LDL is a modifiable risk factor for cardiovascular disease.',
      recommendation: 'Reduce saturated fats, increase soluble fiber, and add aerobic exercise 150 min/week. Discuss statin therapy if lifestyle changes are insufficient.',
      category: 'Cardiovascular',
      severity: 'caution',
      icon: 'heart',
    },
    high: {
      title: 'High LDL Cholesterol',
      description: 'LDL cholesterol above 160 mg/dL is clinically high and significantly increases cardiovascular risk.',
      recommendation: 'Consult your doctor promptly. Combined lifestyle and medication management is typically recommended at this level.',
      category: 'Cardiovascular',
      severity: 'warning',
      icon: 'heart',
    },
  },
  hdl: {
    match: ['hdl', 'high density'],
    low: {
      title: 'Low HDL — Reduced Cardio Protection',
      description: 'Low HDL ("good") cholesterol reduces your cardiovascular protection. HDL helps remove LDL from the bloodstream.',
      recommendation: 'Increase aerobic exercise, reduce trans fats, maintain healthy weight. Niacin supplementation may help (consult doctor).',
      category: 'Cardiovascular',
      severity: 'caution',
      icon: 'activity',
    },
  },
  glucose: {
    match: ['glucose', 'blood sugar', 'fasting glucose'],
    prediabetes: {
      title: 'Prediabetes Range Detected',
      description: 'Fasting glucose of 100–125 mg/dL indicates prediabetes. Without intervention, this can progress to Type 2 Diabetes within 5–10 years.',
      recommendation: 'Adopt a low-glycemic diet, add 30 min of walking daily, reduce processed carbohydrates. Retest in 3 months.',
      category: 'Metabolic',
      severity: 'warning',
      icon: 'activity',
    },
    diabetes: {
      title: 'Diabetes Range Glucose',
      description: 'Fasting glucose ≥ 126 mg/dL is in the diagnostic range for Type 2 Diabetes. This requires medical evaluation.',
      recommendation: 'Seek medical evaluation promptly. Early treatment significantly reduces long-term complications.',
      category: 'Metabolic',
      severity: 'warning',
      icon: 'alert-triangle',
    },
    low: {
      title: 'Low Blood Sugar (Hypoglycemia Risk)',
      description: 'Fasting glucose below 70 mg/dL indicates hypoglycemia, which can cause fatigue, dizziness, and confusion.',
      recommendation: 'Discuss with your doctor. Frequent small meals and avoiding prolonged fasting may help.',
      category: 'Metabolic',
      severity: 'warning',
      icon: 'alert-triangle',
    },
  },
  hba1c: {
    match: ['hba1c', 'hemoglobin a1c', 'a1c', 'glycated'],
    prediabetes: {
      title: 'HbA1c Indicates Prediabetes',
      description: 'HbA1c of 5.7–6.4% reflects average blood sugar over 3 months in the prediabetes range.',
      recommendation: 'Dietary changes and exercise can reverse prediabetes. Retest in 3–6 months.',
      category: 'Metabolic',
      severity: 'warning',
      icon: 'activity',
    },
    diabetes: {
      title: 'HbA1c in Diabetes Range',
      description: 'HbA1c ≥ 6.5% is diagnostic for Type 2 Diabetes and requires medical management.',
      recommendation: 'Medical evaluation and treatment is required. Proper management significantly reduces complication risk.',
      category: 'Metabolic',
      severity: 'warning',
      icon: 'alert-triangle',
    },
  },
  tsh: {
    match: ['tsh', 'thyroid stimulating'],
    high: {
      title: 'TSH Elevated — Hypothyroidism Indicator',
      description: 'Elevated TSH suggests the thyroid gland may be underactive (hypothyroidism). Symptoms include fatigue, weight gain, and cold sensitivity.',
      recommendation: 'Consult an endocrinologist. Thyroid function tests (T3, T4, Anti-TPO) should be done to confirm.',
      category: 'Thyroid',
      severity: 'warning',
      icon: 'thermometer',
    },
    low: {
      title: 'TSH Low — Hyperthyroid Indicator',
      description: 'Low TSH may indicate hyperthyroidism (overactive thyroid). Symptoms include palpitations, weight loss, and anxiety.',
      recommendation: 'Consult your doctor for complete thyroid evaluation including T3 and T4 levels.',
      category: 'Thyroid',
      severity: 'caution',
      icon: 'zap',
    },
  },
  hemoglobin: {
    match: ['hemoglobin', 'hgb', 'haemoglobin'],
    low: {
      title: 'Low Hemoglobin — Anemia Risk',
      description: 'Low hemoglobin indicates potential anemia, which causes fatigue, weakness, and reduced oxygen delivery to tissues.',
      recommendation: 'Iron-rich foods, vitamin C to improve iron absorption, and B12/folate sources. Rule out chronic bleeding. Consult your doctor.',
      category: 'Hematology',
      severity: 'caution',
      icon: 'droplet',
    },
  },
  rbc: {
    match: ['rbc', 'red blood cell', 'red blood count', 'red blood cells'],
    low: {
      title: 'Low Red Blood Cell Count (RBC)',
      description: 'Your RBC count is below the normal range. Low RBC can reduce the oxygen-carrying capacity of your blood, leading to fatigue and weakness.',
      recommendation: 'Discuss potential anemia with your doctor. Iron, folate, and B12 intake may need to be evaluated.',
      category: 'Hematology',
      severity: 'caution',
      icon: 'droplet',
    },
    high: {
      title: 'Elevated Red Blood Cell Count (RBC)',
      description: 'Your RBC count is above the normal range. This can be caused by dehydration, smoking, high altitude, or less commonly, bone marrow issues.',
      recommendation: 'Ensure adequate hydration. Discuss with your doctor if levels remain persistently elevated.',
      category: 'Hematology',
      severity: 'caution',
      icon: 'droplet',
    }
  },
  hematocrit: {
    match: ['hematocrit', 'hct', 'pcv', 'packed cell volume'],
    low: {
      title: 'Low Hematocrit (HCT)',
      description: 'Your Hematocrit (proportion of blood volume made of red blood cells) is low, which is a classic indicator of anemia.',
      recommendation: 'Evaluate alongside hemoglobin and iron levels. Consult a clinician for comprehensive workup.',
      category: 'Hematology',
      severity: 'caution',
      icon: 'droplet',
    },
    high: {
      title: 'Elevated Hematocrit (HCT)',
      description: 'Your Hematocrit is elevated, meaning your blood is highly concentrated with red cells. Dehydration is the most common cause.',
      recommendation: 'Increase fluid intake and avoid dehydration. Seek medical review if persistent.',
      category: 'Hematology',
      severity: 'caution',
      icon: 'droplet',
    }
  },
  mcv: {
    match: ['mcv', 'mean corpuscular volume'],
    low: {
      title: 'Low MCV — Microcytic Red Cells',
      description: 'Mean Corpuscular Volume (MCV) is low, indicating your red blood cells are smaller than normal. This is most commonly caused by iron deficiency or thalassemia trait.',
      recommendation: 'Ask your doctor to run an iron panel (ferritin, iron, TIBC) to rule out iron deficiency anemia.',
      category: 'Hematology',
      severity: 'caution',
      icon: 'droplet',
    },
    high: {
      title: 'High MCV — Macrocytic Red Cells',
      description: 'Mean Corpuscular Volume (MCV) is high, indicating your red blood cells are larger than normal. This is typically caused by Vitamin B12 or folate deficiency.',
      recommendation: 'Check Vitamin B12 and folate levels. Consider dietary changes or supplementation if deficient.',
      category: 'Hematology',
      severity: 'caution',
      icon: 'droplet',
    }
  },
  mch: {
    match: ['mch', 'mean corpuscular hemoglobin'],
    low: {
      title: 'Low MCH (Hypochromic Indicator)',
      description: 'Mean Corpuscular Hemoglobin (MCH) is low, meaning your red blood cells have less hemoglobin than normal, appearing pale (hypochromic).',
      recommendation: 'Often occurs alongside low MCV in iron deficiency. Consider iron level evaluation.',
      category: 'Hematology',
      severity: 'info',
      icon: 'droplet',
    }
  },
  mchc: {
    match: ['mchc', 'mean corpuscular hemoglobin concentration'],
    low: {
      title: 'Low MCHC (Hypochromic Indicator)',
      description: 'Mean Corpuscular Hemoglobin Concentration (MCHC) is low, suggesting red cells have lower hemoglobin concentration.',
      recommendation: 'Discuss with your doctor in conjunction with other CBC indices like MCV and Hemoglobin.',
      category: 'Hematology',
      severity: 'info',
      icon: 'droplet',
    }
  },
  rdw: {
    match: ['rdw', 'red cell distribution width', 'rdw-cv', 'rdw-sd'],
    high: {
      title: 'Elevated RDW (Anisocytosis)',
      description: 'Your Red Cell Distribution Width (RDW) is high, indicating a high degree of variation in the size of your red blood cells. This is an early marker for nutritional deficiencies.',
      recommendation: 'Frequently indicates early iron, B12, or folate deficiency before anemia fully develops. Review nutritional markers.',
      category: 'Hematology',
      severity: 'caution',
      icon: 'droplet',
    }
  },
  triglycerides: {
    match: ['triglyceride', 'trig'],
    high: {
      title: 'Elevated Triglycerides',
      description: 'High triglycerides increase the risk of pancreatitis and contribute to cardiovascular risk, especially with low HDL.',
      recommendation: 'Reduce sugar, refined carbs, and alcohol. Increase omega-3 fatty acids (fatty fish, flaxseed). Exercise regularly.',
      category: 'Cardiovascular',
      severity: 'caution',
      icon: 'heart',
    },
  },
};

// ── Doctor Copilot question templates ─────────────────────────────────────
const QUESTION_TEMPLATES = {
  vitamin_d: {
    match: ['vitamin d', '25-oh'],
    deficient: 'My Vitamin D is below 20 ng/mL. What supplementation dose do you recommend, and how long until I retest?',
    insufficient: 'My Vitamin D is between 20–30 ng/mL. Should I start supplementation, and what dosage is appropriate?',
  },
  ldl: {
    match: ['ldl'],
    borderline: 'My LDL cholesterol is borderline high. Can this be managed with diet and exercise alone, or should I consider medication?',
    high: 'My LDL is clinically high. What is your recommendation — lifestyle changes, statins, or both?',
  },
  glucose: {
    match: ['glucose', 'blood sugar'],
    prediabetes: 'My fasting glucose is in the prediabetes range. What dietary changes and monitoring schedule do you recommend?',
    diabetes: 'My fasting glucose is in the diabetes range. What are the next steps for evaluation and treatment?',
  },
  hba1c: {
    match: ['hba1c', 'a1c'],
    prediabetes: 'My HbA1c indicates prediabetes. What lifestyle interventions are most effective for reversing this?',
    diabetes: 'My HbA1c is in the diabetes range. What treatment plan and monitoring schedule do you recommend?',
  },
  tsh: {
    match: ['tsh'],
    high: 'My TSH is elevated. Should I have additional thyroid tests done, and what are the treatment options?',
    low: 'My TSH is below normal. What additional tests should I have, and what does this mean for my health?',
  },
  hemoglobin: {
    match: ['hemoglobin', 'hgb'],
    low: 'My hemoglobin is low, suggesting possible anemia. What tests should I have to identify the cause?',
  },
  triglycerides: {
    match: ['triglyceride'],
    high: 'My triglycerides are elevated. What dietary and lifestyle changes would you recommend?',
  },
};

// ── Health story templates ─────────────────────────────────────────────────
const HEALTH_STORY_TEMPLATES = {
  high_score: 'Your recent lab results show a generally strong health profile. Most biomarkers are within healthy ranges, reflecting good lifestyle habits. Continue monitoring key metrics regularly to maintain this trajectory.',
  medium_score: 'Your health data reveals a mixed picture — several metrics are in healthy ranges, but a few areas need attention. Addressing the flagged biomarkers with targeted lifestyle changes can meaningfully improve your overall health score.',
  low_score: 'Your lab results indicate several areas that need medical attention. We strongly recommend discussing these findings with your healthcare provider. Early intervention is key — many of these conditions are highly manageable with proper care.',
};

/**
 * Generates insights from metrics using only deterministic clinical rules.
 * Returns an array of insight cards in the same format as generateTrendInsights().
 */
function generateFallbackInsights(metrics) {
  const insights = [];

  for (const m of metrics) {
    if (m.value === null || m.value === undefined) continue;

    const nameLower = String(m.metric_name || '').toLowerCase();

    for (const [key, template] of Object.entries(INSIGHT_TEMPLATES)) {
      if (!template.match.some(kw => nameLower.includes(kw))) continue;

      let insightTemplate = null;

      // Select the right template variant based on status
      const status = m.status || 'normal';
      if (status === 'critical_low' || (status === 'low' && template.low)) {
        insightTemplate = template.low || template.deficient;
      } else if (status === 'critical_high' && template.diabetes) {
        insightTemplate = template.diabetes;
      } else if (status === 'high' && template.high) {
        insightTemplate = template.high;
      } else if (status === 'high' && template.borderline) {
        insightTemplate = template.borderline;
      } else if (status === 'warning' && template.borderline) {
        insightTemplate = template.borderline;
      } else if (status === 'warning' && template.prediabetes) {
        insightTemplate = template.prediabetes;
      } else if (status === 'low' && template.deficient) {
        insightTemplate = template.deficient;
      } else if (status === 'critical_low' && template.deficient) {
        insightTemplate = template.deficient;
      }

      if (insightTemplate) {
        insights.push({
          id: insights.length + 1,
          category: insightTemplate.category || 'Health',
          severity: insightTemplate.severity || 'info',
          title: insightTemplate.title,
          description: insightTemplate.description,
          metric: m.metric_name,
          icon: insightTemplate.icon || 'activity',
          recommendation: insightTemplate.recommendation || '',
          sources: [{
            reportName: 'Clinical Rules Engine',
            metric: m.metric_name,
            value: `${m.value} ${m.unit || ''}`.trim(),
            guideline: 'ADA / AHA / WHO / Endocrine Society Guidelines',
            explanation: insightTemplate.description,
          }],
          fallback: true,
        });
        break; // One insight per metric
      }
    }
  }

  // Add a positive insight for normal metrics (encouraging)
  const normalMetrics = metrics.filter(m => m.status === 'normal' && m.value !== null).slice(0, 3);
  if (normalMetrics.length > 0) {
    insights.push({
      id: insights.length + 1,
      category: 'Positive',
      severity: 'positive',
      title: `${normalMetrics.length} Biomarker${normalMetrics.length > 1 ? 's' : ''} in Healthy Range`,
      description: `${normalMetrics.map(m => m.metric_name).join(', ')} ${normalMetrics.length > 1 ? 'are' : 'is'} within the optimal clinical range. This is a positive indicator of your overall health status.`,
      metric: normalMetrics[0].metric_name,
      icon: 'check-circle',
      recommendation: 'Continue your current lifestyle habits to maintain these healthy levels.',
      sources: [{
        reportName: 'Clinical Rules Engine',
        metric: normalMetrics[0].metric_name,
        value: `${normalMetrics[0].value} ${normalMetrics[0].unit || ''}`.trim(),
        guideline: 'Clinical Reference Ranges',
        explanation: 'Values within normal reference ranges.',
      }],
      fallback: true,
    });
  }

  return insights;
}

/**
 * Generates a Health Twin profile from metrics using only clinical rules.
 * Returns the same shape as generateHealthTwin().
 */
function generateCbcNarrative(byName) {
  const hgb = byName['hemoglobin'] || byName['hgb'];
  const rbc = byName['rbc'];
  const hct = byName['hematocrit'] || byName['hct'];
  const mcv = byName['mcv'];
  const mch = byName['mch'];
  const mchc = byName['mchc'];
  const rdw = byName['rdw'];

  if (!hgb && !rbc && !hct) return null;

  let story = 'Your Complete Blood Count (CBC) analysis is complete. ';
  let issues = [];

  if (hgb) {
    if (hgb.status === 'low' || hgb.status === 'critical_low') {
      issues.push(`low hemoglobin (${hgb.value} ${hgb.unit || 'g/dL'}) indicating potential anemia`);
    } else if (hgb.status === 'high' || hgb.status === 'critical_high') {
      issues.push(`elevated hemoglobin (${hgb.value} ${hgb.unit || 'g/dL'})`);
    }
  }

  if (rbc && (rbc.status === 'low' || rbc.status === 'critical_low')) {
    issues.push(`low red blood cell count (${rbc.value} M/uL)`);
  }

  if (mcv) {
    if (mcv.status === 'low') {
      issues.push(`low MCV (${mcv.value} fL), suggesting microcytic red blood cells (common in iron deficiency)`);
    } else if (mcv.status === 'high') {
      issues.push(`elevated MCV (${mcv.value} fL), suggesting macrocytic red blood cells (common in Vitamin B12 or folate deficiency)`);
    }
  }

  if (rdw && (rdw.status === 'high' || rdw.status === 'critical_high')) {
    issues.push(`high RDW (${rdw.value}%), indicating significant variation in red blood cell size (anisocytosis)`);
  }

  if (issues.length > 0) {
    story += `We detected the following findings: ${issues.join(', ')}. `;
    if (hgb && (hgb.status === 'low' || hgb.status === 'critical_low')) {
      story += 'This pattern is consistent with nutritional or iron-deficiency anemia. We recommend discussing these findings with your doctor to explore iron, B12, or folate levels.';
    } else {
      story += 'Please consult your healthcare provider to interpret these results in clinical context.';
    }
  } else {
    story += 'All your primary CBC biomarkers, including Hemoglobin, RBC, Hematocrit, and red cell indices (MCV, MCH, MCHC, RDW), are within healthy optimal ranges, indicating good oxygen-carrying capacity and healthy bone marrow function.';
  }

  return story;
}

/**
 * Generates a Health Twin profile from metrics using only clinical rules.
 * Returns the same shape as generateHealthTwin().
 */
function generateFallbackTwin(userProfile, allMetrics) {
  const age = userProfile?.age || 34;
  const gender = userProfile?.gender || 'Male';

  // Score by category
  const byName = {};
  for (const m of allMetrics) {
    byName[String(m.metric_name || '').toLowerCase()] = m;
  }

  // Cardiovascular score
  let cardioScore = 78;
  const ldl  = byName['ldl cholesterol'] || byName['ldl'];
  const hdl  = byName['hdl cholesterol'] || byName['hdl'];
  const trig = byName['triglycerides'];
  if (ldl)  cardioScore = ldl.value < 100 ? 94 : ldl.value < 130 ? 82 : ldl.value < 160 ? 66 : ldl.value < 190 ? 52 : 38;
  if (hdl && hdl.value > 60) cardioScore = Math.min(100, cardioScore + 8);
  if (hdl && hdl.value < 40) cardioScore = Math.max(30, cardioScore - 10);
  if (trig && trig.value > 200) cardioScore = Math.max(30, cardioScore - 8);

  // Metabolic score
  let metaScore = 78;
  const glucose = byName['fasting glucose'] || byName['glucose'];
  const hba1c   = byName['hba1c'] || byName['hemoglobin a1c'];
  if (glucose)  metaScore = glucose.value < 100 ? 92 : glucose.value < 126 ? 68 : 42;
  if (hba1c)   metaScore = Math.round((metaScore + (hba1c.value < 5.7 ? 94 : hba1c.value < 6.5 ? 70 : 42)) / 2);

  // Nutrition score
  let nutScore = 72;
  const vitD = byName['vitamin d'] || byName['25-oh vitamin d'];
  const b12  = byName['vitamin b12'] || byName['b12'];
  if (vitD) nutScore = vitD.value > 50 ? 94 : vitD.value > 30 ? 80 : vitD.value > 20 ? 58 : 32;
  if (b12)  nutScore = Math.round((nutScore + (b12.value > 400 ? 92 : b12.value > 200 ? 72 : 44)) / 2);

  // Hematology (CBC indices)
  let hemaScore = 80;
  const hgb = byName['hemoglobin'] || byName['hgb'];
  const rbc = byName['rbc'];
  const hct = byName['hematocrit'] || byName['hct'];
  const mcv = byName['mcv'];
  const mch = byName['mch'];
  const mchc = byName['mchc'];
  const rdw = byName['rdw'];

  let hemaFactors = [];
  if (hgb) hemaFactors.push(hgb.status === 'normal' ? 95 : 60);
  if (rbc) hemaFactors.push(rbc.status === 'normal' ? 95 : 65);
  if (hct) hemaFactors.push(hct.status === 'normal' ? 95 : 65);
  if (mcv) hemaFactors.push(mcv.status === 'normal' ? 95 : 70);
  if (mch) hemaFactors.push(mch.status === 'normal' ? 95 : 75);
  if (mchc) hemaFactors.push(mchc.status === 'normal' ? 95 : 75);
  if (rdw) hemaFactors.push(rdw.status === 'normal' ? 95 : 70);

  if (hemaFactors.length > 0) {
    hemaScore = Math.round(hemaFactors.reduce((a, b) => a + b, 0) / hemaFactors.length);
  }

  // Overall
  const activeScores = [cardioScore, metaScore, nutScore, hemaScore].filter(Boolean);
  const overallScore = Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length);

  // Estimated biological age modifier
  const abnormalCount = allMetrics.filter(m => m.status !== 'normal' && m.status !== undefined).length;
  const totalCount = allMetrics.filter(m => m.value !== null).length;
  const abnormalRate = totalCount > 0 ? abnormalCount / totalCount : 0;
  const bioAgeDelta = Math.round(abnormalRate * 8 - (overallScore - 70) / 10);
  const biologicalAge = Math.max(age - 5, age + Math.min(5, bioAgeDelta));

  // Strengths (normal metrics)
  const normalMetrics = allMetrics.filter(m => m.status === 'normal' && m.value !== null);
  const keyStrengths = normalMetrics.slice(0, 5).map(m =>
    `${m.metric_name} is within healthy range (${m.value} ${m.unit || ''})`
  );
  if (overallScore >= 75) keyStrengths.push('Overall health indicators are within acceptable clinical thresholds');
  if (cardioScore >= 80) keyStrengths.push('Cardiovascular biomarkers indicate good heart health');

  // Risks (abnormal metrics)
  const abnormalMetrics = allMetrics.filter(m =>
    ['low', 'high', 'critical_low', 'critical_high', 'warning'].includes(m.status) && m.value !== null
  );
  const keyRisks = abnormalMetrics.slice(0, 5).map(m => {
    const statusMap = { low: 'below optimal', high: 'above optimal', critical_low: 'critically low', critical_high: 'critically high', warning: 'borderline' };
    return `${m.metric_name} is ${statusMap[m.status] || m.status} at ${m.value} ${m.unit || ''}`;
  });

  const storyKey = overallScore >= 80 ? 'high_score' : overallScore >= 60 ? 'medium_score' : 'low_score';
  const cbcNarrative = generateCbcNarrative(byName);
  const baseStory = HEALTH_STORY_TEMPLATES[storyKey];
  const story = cbcNarrative ? `${cbcNarrative}\n\n${baseStory}` : baseStory;

  return {
    biologicalAge,
    biologicalAgeVsChronological: `${biologicalAge > age ? '+' : ''}${biologicalAge - age} years`,
    twinAccuracy: Math.min(85, 50 + allMetrics.length * 2),
    overallScore,
    pillars: {
      cardiovascular: cardioScore,
      metabolic: metaScore,
      nutritional: nutScore,
      immune: hemaScore,
    },
    scoreBreakdown: {
      cardiovascular: cardioScore,
      metabolic: metaScore,
      nutrition: nutScore,
      sleep: 72,
      activity: 76,
      mental: 74,
      immune: hemaScore,
    },
    twinSummary: story,
    healthStory: story,
    keyStrengths,
    strengths: keyStrengths,
    keyRisks,
    biomarkers: allMetrics.map(m => ({
      name: m.metric_name,
      value: m.value,
      unit: m.unit || '',
      status: m.status || 'normal',
      referenceRange: m.reference_low != null && m.reference_high != null
        ? `${m.reference_low}–${m.reference_high}`
        : null,
    })),
    metabolicAge: Math.round(biologicalAge + (metaScore < 70 ? 2 : 0)),
    cardiovascularFitnessAge: Math.round(biologicalAge + (cardioScore < 70 ? 2 : 0)),
    healthTrajectory: overallScore >= 80 ? 'stable' : abnormalCount > 3 ? 'declining' : 'stable',
    predictedScoreIn90Days: Math.min(100, overallScore + 3),
    dataPoints: allMetrics.length,
    reportsCovered: new Set(allMetrics.map(m => m.report_id)).size,
    generatedBy: 'clinical_rules',
    aiInsightsAvailable: false,
    aiMessage: 'AI-powered insights are temporarily unavailable. Your Health Twin was built using validated clinical rules based on ADA, AHA, and WHO guidelines.',
  };
}

/**
 * Generates a Doctor Copilot brief using only rule-based templates.
 * Returns the same shape as generateDoctorBrief().
 */
function generateFallbackDoctorBrief(recentMetrics) {
  const questions = [];
  const discussionTopics = [];
  const followUpTests = [];

  const byName = {};
  for (const m of recentMetrics) {
    byName[String(m.metric_name || '').toLowerCase()] = m;
  }

  // Generate questions from templates
  for (const [key, qTemplate] of Object.entries(QUESTION_TEMPLATES)) {
    for (const [metricKey, metricData] of Object.entries(byName)) {
      if (!qTemplate.match.some(kw => metricKey.includes(kw))) continue;
      const status = metricData.status || 'normal';

      if (status === 'normal') continue;

      if ((status === 'critical_low' || status === 'low') && qTemplate.low) {
        questions.push(qTemplate.low);
      } else if (status === 'critical_high' && qTemplate.diabetes) {
        questions.push(qTemplate.diabetes);
      } else if (status === 'high' && qTemplate.high) {
        questions.push(qTemplate.high);
      } else if (status === 'warning' && qTemplate.prediabetes) {
        questions.push(qTemplate.prediabetes);
      } else if (status === 'warning' && qTemplate.borderline) {
        questions.push(qTemplate.borderline);
      } else if (status === 'low' && qTemplate.deficient) {
        questions.push(qTemplate.deficient);
      } else if (status === 'critical_low' && qTemplate.deficient) {
        questions.push(qTemplate.deficient);
      }
      break;
    }
  }

  // General questions if too few
  if (questions.length < 3) {
    questions.push('What follow-up tests do you recommend based on my recent lab results?');
    questions.push('Are there any lifestyle changes you would specifically prioritise for me?');
    questions.push('How often should I get comprehensive blood work done?');
  }

  // Discussion topics from abnormal metrics
  const abnormal = recentMetrics.filter(m =>
    ['low', 'high', 'critical_low', 'critical_high', 'warning'].includes(m.status)
  );
  for (const m of abnormal.slice(0, 4)) {
    discussionTopics.push({
      topic: m.metric_name,
      context: `${m.metric_name}: ${m.value} ${m.unit || ''} (${m.status.replace('_', ' ')})`,
      priority: m.status.includes('critical') ? 'high' : 'medium',
    });
    followUpTests.push(`Recheck ${m.metric_name} in 30–90 days`);
  }

  const abnormalNames = abnormal.map(m => m.metric_name).join(', ');
  const reportSummary = abnormal.length > 0
    ? `Your recent labs show ${abnormal.length} metric${abnormal.length > 1 ? 's' : ''} outside normal range: ${abnormalNames}. These warrant discussion with your doctor.`
    : 'Your recent lab results are largely within normal ranges. Continue regular monitoring and maintain your current healthy habits.';

  return {
    visitBrief: {
      chiefConcern: abnormal.length > 0
        ? `Review ${abnormal.length} out-of-range biomarker${abnormal.length > 1 ? 's' : ''}`
        : 'Routine health review',
      recentLabs: `${recentMetrics.length} biomarkers from recent reports`,
      medications: 'Review with your doctor',
      allergies: 'None recorded',
      recentSymptoms: 'Discuss with your doctor',
    },
    suggestedQuestions: questions.slice(0, 8),
    questions: questions.slice(0, 8),
    summary: reportSummary,
    reportSummary,
    checklist: [
      'Bring all recent lab reports',
      'List current medications and supplements',
      'Note any symptoms or changes since last visit',
      'Ask about follow-up testing schedule',
      'Discuss target ranges for flagged biomarkers',
    ],
    discussionTopics,
    redFlags: abnormal.filter(m => m.status.includes('critical')).map(m =>
      `${m.metric_name} is critically out of range — requires prompt medical attention`
    ),
    followUpTests: followUpTests.slice(0, 5),
    generatedBy: 'clinical_rules',
    aiMessage: 'AI-powered personalisation is temporarily unavailable. Questions were generated using validated clinical templates.',
  };
}

/**
 * Generates a deterministic simulation forecast.
 * Returns the same shape as generateForecast().
 */
function generateFallbackForecast(currentMetrics, scenario) {
  const SCENARIO_IMPROVEMENTS = {
    exercise_increase:   { cardiovascular: 8, metabolic: 5, nutrition: 2, overall: 6 },
    diet_optimization:   { cardiovascular: 6, metabolic: 8, nutrition: 10, overall: 7 },
    sleep_improvement:   { cardiovascular: 4, metabolic: 4, nutrition: 2, overall: 4 },
    supplement_protocol: { cardiovascular: 3, metabolic: 3, nutrition: 8, overall: 4 },
    combined:            { cardiovascular: 14, metabolic: 13, nutrition: 14, overall: 14 },
  };

  const improvement = SCENARIO_IMPROVEMENTS[scenario] || SCENARIO_IMPROVEMENTS.combined;
  const abnormal = currentMetrics.filter(m => m.status !== 'normal' && m.value !== null);
  const baseScore = 72;

  const months = [1, 2, 3, 6, 9, 12];
  const chartData = months.map(month => {
    const fraction = Math.min(1, month / 6);
    return {
      month: `Month ${month}`,
      score: Math.round(baseScore + improvement.overall * fraction * 0.8),
      baseline: baseScore,
    };
  });

  const outcomes = [
    { metric: 'Health Score', change: `+${improvement.overall} pts`, timeframe: '6 months' },
    { metric: 'Cardiovascular', change: `+${improvement.cardiovascular} pts`, timeframe: '6 months' },
    { metric: 'Metabolic Health', change: `+${improvement.metabolic} pts`, timeframe: '6 months' },
  ];

  const recommendations = {
    exercise_increase: [
      '30 minutes of moderate cardio 5 days/week',
      'Include 2 sessions of resistance training',
      'Daily step goal: 8,000–10,000 steps',
    ],
    diet_optimization: [
      'Reduce saturated fats (< 7% of total calories)',
      'Increase fibre to 25–35g/day',
      'Add omega-3 sources (salmon, flaxseed, walnuts)',
    ],
    sleep_improvement: [
      'Target 7–9 hours of consistent sleep',
      'Maintain a regular sleep/wake schedule',
      'Avoid screens 1 hour before bed',
    ],
    supplement_protocol: [
      'Vitamin D3: 2000–4000 IU/day (if deficient)',
      'Omega-3 fatty acids: 1–2g/day EPA+DHA',
      'Magnesium glycinate: 300–400mg/day',
    ],
    combined: [
      '30 min cardio 5 days/week + 2 strength sessions',
      'Mediterranean diet with reduced processed foods',
      'Target 7–9 hours of quality sleep',
      'Consider targeted supplementation based on lab results',
    ],
  };

  return {
    scenario,
    disclaimer: 'Forecast only. Not medical advice. Consult your physician before making health decisions.',
    chartData,
    outcomes,
    recommendations: recommendations[scenario] || recommendations.combined,
    narrative: `Based on your current biomarker profile and the ${scenario.replace('_', ' ')} intervention, you can expect meaningful health improvements over 6–12 months. ${abnormal.length > 0 ? `Your ${abnormal.length} flagged biomarker${abnormal.length > 1 ? 's' : ''} ${abnormal.length > 1 ? 'are' : 'is'} most likely to improve with consistent lifestyle changes.` : 'Your markers are broadly healthy — this protocol can help maintain and optimise further.'}`,
    projectedOutcomes: {
      healthScoreChange: `+${improvement.overall} points`,
      biologicalAgeChange: `-${Math.round(improvement.overall / 5)} years`,
      keyImprovements: outcomes.map(o => `${o.metric}: ${o.change}`),
      timeToGoal: '4–6 months',
    },
    confidence: '72%',
    generatedBy: 'clinical_rules',
    aiMessage: 'This simulation uses validated clinical evidence and deterministic projections. AI-personalised simulation is temporarily unavailable.',
  };
}

/**
 * Deterministically extracts biomarkers from medical report text using regex
 */
function extractMetricsRegex(text) {
  const lines = text.split('\n');
  const extracted = [];
  const seen = new Set();

  const BIOMARKERS_DEF = [
    { name: 'Hemoglobin', keywords: ['hemoglobin', 'hgb', 'haemoglobin'], unit: 'g/dL', category: 'hematology', low: 13.0, high: 17.5 },
    { name: 'RBC', keywords: ['rbc', 'red blood cell', 'red blood count', 'red blood cells'], unit: 'M/uL', category: 'hematology', low: 4.3, high: 5.9 },
    { name: 'Hematocrit', keywords: ['hematocrit', 'hct', 'pcv', 'packed cell volume'], unit: '%', category: 'hematology', low: 41.0, high: 50.0 },
    { name: 'MCV', keywords: ['mcv', 'mean corpuscular volume'], unit: 'fL', category: 'hematology', low: 80.0, high: 100.0 },
    { name: 'MCH', keywords: ['mch', 'mean corpuscular hemoglobin'], unit: 'pg', category: 'hematology', low: 27.0, high: 33.0 },
    { name: 'MCHC', keywords: ['mchc', 'mean corpuscular hemoglobin concentration'], unit: 'g/dL', category: 'hematology', low: 32.0, high: 36.0 },
    { name: 'RDW', keywords: ['rdw', 'red cell distribution width', 'rdw-cv', 'rdw-sd'], unit: '%', category: 'hematology', low: 11.0, high: 15.0 },
    { name: 'Fasting Glucose', keywords: ['fasting glucose', 'glucose, fasting', 'blood sugar', 'glucose'], unit: 'mg/dL', category: 'diabetes', low: 70, high: 99 },
    { name: 'HbA1c', keywords: ['hba1c', 'hemoglobin a1c', 'glycated hemoglobin', 'a1c'], unit: '%', category: 'diabetes', low: 4.0, high: 5.6 },
    { name: 'TSH', keywords: ['tsh', 'thyroid stimulating hormone', 'thyrotropin'], unit: 'mIU/L', category: 'thyroid', low: 0.4, high: 4.5 },
    { name: 'Vitamin D', keywords: ['vitamin d', '25-hydroxy', '25-oh'], unit: 'ng/mL', category: 'vitamin', low: 30, high: 100 },
    { name: 'Vitamin B12', keywords: ['vitamin b12', 'b12', 'cobalamin'], unit: 'pg/mL', category: 'vitamin', low: 200, high: 900 },
    { name: 'LDL Cholesterol', keywords: ['ldl cholesterol', 'ldl', 'low density lipoprotein'], unit: 'mg/dL', category: 'lipid', low: 0, high: 99 },
    { name: 'HDL Cholesterol', keywords: ['hdl cholesterol', 'hdl', 'high density lipoprotein'], unit: 'mg/dL', category: 'lipid', low: 40, high: 60 },
    { name: 'Total Cholesterol', keywords: ['total cholesterol', 'cholesterol, total', 'cholesterol'], unit: 'mg/dL', category: 'lipid', low: 100, high: 199 },
    { name: 'Triglycerides', keywords: ['triglycerides', 'trig'], unit: 'mg/dL', category: 'lipid', low: 0, high: 149 },
  ];

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    for (const def of BIOMARKERS_DEF) {
      if (seen.has(def.name)) continue;

      const hasKeyword = def.keywords.some(kw => {
        const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        return regex.test(cleanLine);
      });

      if (hasKeyword) {
        let searchPart = cleanLine;
        for (const kw of def.keywords) {
          const idx = cleanLine.toLowerCase().indexOf(kw.toLowerCase());
          if (idx !== -1) {
            searchPart = cleanLine.slice(idx + kw.length);
            break;
          }
        }

        const match = searchPart.match(/(\d+(\.\d+)?)/);
        if (match) {
          const val = parseFloat(match[0]);
          if (!isNaN(val)) {
            extracted.push({
              metric_name: def.name,
              value: val,
              value_text: String(val),
              unit: def.unit,
              reference_low: def.low,
              reference_high: def.high,
              status: 'normal',
              category: def.category,
              confidence: 0.90,
              source: 'regex_fallback',
            });
            seen.add(def.name);
            break;
          }
        }
      }
    }
  }

  return extracted;
}

/**
 * Deterministically extracts medications, tests, and instructions from prescription text using regex
 */
function extractPrescriptionRegex(text) {
  const lines = text.split('\n');
  const medications = [];
  const tests = [];
  const symptoms = [];
  const instructions = [];

  const commonMeds = ['metformin', 'atorvastatin', 'lisinopril', 'levothyroxine', 'amlodipine', 'gabapentin', 'omeprazole', 'vitamin d', 'b12', 'aspirin', 'ibuprofen', 'paracetamol'];
  const commonTests = ['cbc', 'lipid', 'tsh', 'hba1c', 'liver function', 'kidney function', 'ecg', 'mri', 'x-ray'];

  for (const line of lines) {
    const clean = line.trim();
    if (!clean) continue;

    const lower = clean.toLowerCase();
    let foundMed = false;
    for (const med of commonMeds) {
      if (lower.includes(med)) {
        const dosageMatch = clean.match(/\b\d+\s*(mg|mcg|g|ml|tab|capsule|caps)\b/i);
        const dosage = dosageMatch ? dosageMatch[0] : '';
        const freqMatch = clean.match(/\b(daily|once daily|twice daily|bid|qd|tid|qhs|morning|night)\b/i);
        const frequency = freqMatch ? freqMatch[0] : '';

        medications.push({
          name: med.charAt(0).toUpperCase() + med.slice(1),
          dosage: dosage || 'As directed',
          frequency: frequency || 'Daily',
          confidence: 0.85
        });
        foundMed = true;
        break;
      }
    }

    if (foundMed) continue;

    let foundTest = false;
    for (const t of commonTests) {
      if (lower.includes(t)) {
        tests.push({
          name: t.toUpperCase(),
          confidence: 0.85
        });
        foundTest = true;
        break;
      }
    }

    if (foundTest) continue;

    if (/\b(take|use|apply|consume|avoid|drink|tablet|mg|tab)\b/i.test(lower)) {
      instructions.push({
        text: clean,
        confidence: 0.8
      });
    }
  }

  return { medications, tests, symptoms, instructions };
}

module.exports = {
  generateFallbackInsights,
  generateFallbackTwin,
  generateFallbackDoctorBrief,
  generateFallbackForecast,
  extractMetricsRegex,
  extractPrescriptionRegex,
};
