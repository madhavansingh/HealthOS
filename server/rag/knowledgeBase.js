// HealthOS Medical Knowledge Base (Clinical Guidelines)
// Seeded guidelines used by the RAG system to enrich AI insights and chat responses.

const CLINICAL_GUIDELINES = [
  {
    id: 'lipid-ldl',
    category: 'lipid',
    title: 'AHA Cholesterol Management Guidelines',
    text: 'For adult LDL cholesterol: Optimal is under 100 mg/dL. Near optimal is 100-129 mg/dL. Borderline high is 130-159 mg/dL. High is 160-189 mg/dL. In borderline high ranges, primary intervention focuses on lifestyle modifications: reducing saturated fat to <7% of total calories, increasing soluble fiber (10-25g/day), weight reduction, and 150+ minutes of moderate aerobic physical activity weekly.',
    source: 'American Heart Association (AHA)',
    url: 'https://www.heart.org/en/health-topics/cholesterol/manage-your-cholesterol'
  },
  {
    id: 'diabetes-hba1c',
    category: 'diabetes',
    title: 'ADA Standards of Care for Glycemia',
    text: 'Diagnosis levels for HbA1c: Normal is below 5.7%. Prediabetes is 5.7% to 6.4%. Diabetes is 6.5% or higher. Fasting plasma glucose: Normal is <100 mg/dL, prediabetes is 100-125 mg/dL, and diabetes is 126 mg/dL or higher. Early intervention for prediabetes includes metformin therapy, active weight management, and structured exercise plans.',
    source: 'American Diabetes Association (ADA)',
    url: 'https://professional.diabetes.org/standards-of-care'
  },
  {
    id: 'vitamin-d',
    category: 'vitamin',
    title: 'Endocrine Society Guidelines on Vitamin D',
    text: 'Vitamin D status definitions: Deficiency is under 20 ng/mL. Insufficiency is 20-29 ng/mL. Sufficiency is 30-100 ng/mL. For adults with deficiency, treatment options include 50,000 IU of vitamin D3 once weekly for 8 weeks, or 2,000 IU daily to achieve levels above 30 ng/mL, paired with adequate dietary calcium intake.',
    source: 'Endocrine Society Clinical Practice Guidelines',
    url: 'https://www.endocrine.org/clinical-practice-guidelines/vitamin-d-deficiency'
  },
  {
    id: 'cbc-anemia',
    category: 'hematology',
    title: 'WHO Classification of Anemia',
    text: 'Anemia is diagnosed when hemoglobin is below 13.0 g/dL in men and below 12.0 g/dL in non-pregnant women. Mild anemia ranges from 11.0 to 12.9 g/dL in men. Iron deficiency is the most common cause, but rule out B12/folate deficiency, chronic kidney disease, or blood loss if red cell indices (MCV, MCH) are microcytic or macrocytic.',
    source: 'World Health Organization (WHO)',
    url: 'https://www.who.int/health-topics/anaemia'
  },
  {
    id: 'thyroid-tsh',
    category: 'thyroid',
    title: 'ATA Thyroid Function Reference Guidelines',
    text: 'The typical reference range for serum TSH in healthy adults is 0.4 to 4.0 or 4.5 mIU/L. Subclinical hypothyroidism is defined by an elevated serum TSH (typically 4.5 to 10.0 mIU/L) with normal free thyroid hormones (T4/T3). Treatment is generally recommended if TSH exceeds 10.0 mIU/L, or if subclinical hypothyroid patients have goiter, positive antibodies, or severe symptoms.',
    source: 'American Thyroid Association (ATA)',
    url: 'https://www.thyroid.org/professionals/ata-guidelines'
  },
  {
    id: 'lipid-triglycerides',
    category: 'lipid',
    title: 'NCEP ATP III Guidelines on Triglycerides',
    text: 'Triglyceride levels: Normal is under 150 mg/dL. Borderline high is 150-199 mg/dL. High is 200-499 mg/dL. Very high is 500 mg/dL or higher. Management of borderline high or high levels includes weight control, physical activity, alcohol cessation, and restriction of simple carbohydrates.',
    source: 'National Cholesterol Education Program (NCEP)',
    url: 'https://www.nhlbi.nih.gov/files/docs/guidelines/atp3xsum.pdf'
  },
  {
    id: 'vitamin-b12',
    category: 'vitamin',
    title: 'NIH Vitamin B12 Fact Sheet',
    text: 'Vitamin B12 levels below 200 pg/mL indicate deficiency. Insufficiency is between 200 and 300 pg/mL. Treatment of deficiency typically requires oral supplementation (1,000-2,000 mcg daily) or intramuscular injections. Symptoms of deficiency include fatigue, neuropathy, cognitive decline, and macrocytic anemia.',
    source: 'National Institutes of Health (NIH)',
    url: 'https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional'
  }
];

module.exports = { CLINICAL_GUIDELINES };
