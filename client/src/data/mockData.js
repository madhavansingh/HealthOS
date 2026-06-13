// HealthOS Mock Data

export const mockUser = {
  name: 'Arjun Mehta',
  email: 'arjun.mehta@gmail.com',
  age: 34,
  gender: 'Male',
  bloodType: 'O+',
  height: '5\'11"',
  weight: '78 kg',
  location: 'Mumbai, India',
  primaryDoctor: 'Dr. Priya Sharma',
  plan: 'HealthOS Pro',
};

export const healthScore = {
  overall: 82,
  previousScore: 76,
  breakdown: {
    cardiovascular: 88,
    metabolic: 79,
    sleep: 71,
    activity: 85,
    mental: 78,
    nutrition: 80,
  },
};

export const vitalsTrend = [
  { date: 'Jan', heartRate: 72, bp: 120, glucose: 95, weight: 81 },
  { date: 'Feb', heartRate: 74, bp: 122, glucose: 98, weight: 80 },
  { date: 'Mar', heartRate: 71, bp: 118, glucose: 93, weight: 79.5 },
  { date: 'Apr', heartRate: 69, bp: 116, glucose: 91, weight: 79 },
  { date: 'May', heartRate: 70, bp: 119, glucose: 96, weight: 78.5 },
  { date: 'Jun', heartRate: 68, bp: 115, glucose: 89, weight: 78 },
];

export const recentReports = [
  {
    id: 1,
    name: 'Complete Blood Count',
    type: 'Hematology',
    date: '12 Jun 2026',
    status: 'analyzed',
    lab: 'Dr. Lal PathLabs',
    insights: 3,
    abnormal: 1,
  },
  {
    id: 2,
    name: 'Lipid Profile',
    type: 'Biochemistry',
    date: '8 Jun 2026',
    status: 'analyzed',
    lab: 'SRL Diagnostics',
    insights: 2,
    abnormal: 0,
  },
  {
    id: 3,
    name: 'Thyroid Panel (T3, T4, TSH)',
    type: 'Endocrinology',
    date: '3 Jun 2026',
    status: 'pending',
    lab: 'Apollo Diagnostics',
    insights: 0,
    abnormal: 0,
  },
  {
    id: 4,
    name: 'HbA1c Test',
    type: 'Diabetes',
    date: '28 May 2026',
    status: 'analyzed',
    lab: 'Thyrocare',
    insights: 4,
    abnormal: 1,
  },
  {
    id: 5,
    name: 'Vitamin D & B12 Panel',
    type: 'Nutrition',
    date: '20 May 2026',
    status: 'analyzed',
    lab: 'Metropolis Healthcare',
    insights: 2,
    abnormal: 2,
  },
];

export const aiInsights = [
  {
    id: 1,
    category: 'Trend',
    severity: 'positive',
    title: 'Heart rate trending healthier',
    description: 'Your resting heart rate dropped from 74 to 68 bpm over 3 months — indicating improved cardiovascular fitness.',
    metric: '−6 bpm',
    icon: 'heart',
  },
  {
    id: 2,
    category: 'Risk',
    severity: 'warning',
    title: 'Vitamin D deficiency detected',
    description: 'Your Vitamin D levels (18 ng/mL) fall below the optimal range. Supplementation and morning sunlight exposure recommended.',
    metric: '18 ng/mL',
    icon: 'sun',
  },
  {
    id: 3,
    category: 'Correlation',
    severity: 'info',
    title: 'Sleep affects glucose levels',
    description: 'On days with less than 6h of sleep, your fasting glucose is 12% higher on average — a significant metabolic correlation.',
    metric: '+12% glucose',
    icon: 'moon',
  },
  {
    id: 4,
    category: 'Risk',
    severity: 'caution',
    title: 'LDL borderline elevation',
    description: 'Total LDL is at 142 mg/dL — borderline high. Dietary modification and repeat test in 60 days recommended.',
    metric: '142 mg/dL',
    icon: 'activity',
  },
  {
    id: 5,
    category: 'Comparison',
    severity: 'positive',
    title: 'Better than peers your age',
    description: 'Your overall health score is 14% above the median for males aged 30–39 with similar BMI.',
    metric: '+14% vs peers',
    icon: 'trending-up',
  },
];

export const preventiveCare = [
  {
    id: 1,
    title: 'Annual Cardiac Stress Test',
    due: 'Jul 2026',
    priority: 'high',
    reason: 'Family history of hypertension — annual monitoring advised.',
    specialist: 'Cardiologist',
    done: false,
  },
  {
    id: 2,
    title: 'Dental Cleaning & Checkup',
    due: 'Jun 2026',
    priority: 'medium',
    reason: 'Routine 6-month oral hygiene appointment.',
    specialist: 'Dentist',
    done: false,
  },
  {
    id: 3,
    title: 'Eye Examination',
    due: 'Aug 2026',
    priority: 'medium',
    reason: 'Routine annual visual acuity and pressure check.',
    specialist: 'Ophthalmologist',
    done: false,
  },
  {
    id: 4,
    title: 'Colorectal Cancer Screening',
    due: 'Dec 2026',
    priority: 'low',
    reason: 'Standard screening starting at age 35.',
    specialist: 'Gastroenterologist',
    done: false,
  },
  {
    id: 5,
    title: 'Full Body Dermatology Scan',
    due: 'Sep 2026',
    priority: 'low',
    reason: 'Annual mole mapping and skin health assessment.',
    specialist: 'Dermatologist',
    done: true,
  },
];

export const lifestyleData = {
  sleep: [
    { day: 'Mon', hours: 6.2, quality: 68 },
    { day: 'Tue', hours: 7.5, quality: 82 },
    { day: 'Wed', hours: 6.8, quality: 74 },
    { day: 'Thu', hours: 7.1, quality: 79 },
    { day: 'Fri', hours: 5.9, quality: 63 },
    { day: 'Sat', hours: 8.2, quality: 89 },
    { day: 'Sun', hours: 7.8, quality: 86 },
  ],
  steps: [8230, 10400, 7800, 9600, 11200, 6400, 8900],
  water: [5, 7, 6, 8, 7, 9, 7], // glasses
  nutrition: { protein: 68, carbs: 45, fat: 72, fiber: 52 }, // percentage of goal
};

export const doctorCopilotData = {
  upcomingVisit: {
    doctor: 'Dr. Priya Sharma',
    specialty: 'Internal Medicine',
    date: 'June 18, 2026',
    time: '11:30 AM',
    location: 'Kokilaben Dhirubhai Ambani Hospital',
  },
  suggestedQuestions: [
    'Should I start Vitamin D supplementation given my recent deficiency?',
    'Is my HbA1c trend concerning — what dietary changes should I make?',
    'Can my borderline LDL be managed with diet alone or do I need medication?',
    'How should I adjust my exercise routine given my resting heart rate?',
    'Is there a genetic risk assessment I should consider given my family history?',
  ],
  briefPoints: [
    { label: 'Chief concern', value: 'Vitamin D deficiency & LDL management' },
    { label: 'Recent labs', value: 'CBC, Lipid Profile, HbA1c (May–Jun 2026)' },
    { label: 'Medications', value: 'None currently' },
    { label: 'Allergies', value: 'None known' },
    { label: 'Recent symptoms', value: 'Occasional fatigue, mild headaches' },
  ],
};

export const familyMembers = [
  {
    id: 1,
    name: 'Sunita Mehta',
    relation: 'Mother',
    age: 61,
    score: 74,
    conditions: ['Type 2 Diabetes', 'Hypertension'],
    lastCheckup: '2 months ago',
  },
  {
    id: 2,
    name: 'Rajesh Mehta',
    relation: 'Father',
    age: 65,
    score: 68,
    conditions: ['Coronary Artery Disease', 'Hypercholesterolemia'],
    lastCheckup: '1 month ago',
  },
  {
    id: 3,
    name: 'Kavita Mehta',
    relation: 'Sister',
    age: 30,
    score: 88,
    conditions: [],
    lastCheckup: '3 months ago',
  },
];

export const healthGraphNodes = [
  { id: 'heart', label: 'Heart Health', score: 88, x: 50, y: 20, color: '#f43f5e', size: 56 },
  { id: 'glucose', label: 'Blood Sugar', score: 79, x: 75, y: 40, color: '#f59e0b', size: 48 },
  { id: 'sleep', label: 'Sleep Quality', score: 71, x: 25, y: 45, color: '#6366f1', size: 46 },
  { id: 'vitaminD', label: 'Vitamin D', score: 42, x: 60, y: 65, color: '#f59e0b', size: 40 },
  { id: 'activity', label: 'Activity', score: 85, x: 20, y: 70, color: '#10b981', size: 50 },
  { id: 'stress', label: 'Stress Level', score: 60, x: 80, y: 70, color: '#a855f7', size: 42 },
  { id: 'nutrition', label: 'Nutrition', score: 80, x: 45, y: 85, color: '#06b6d4', size: 44 },
];

export const chatMessages = [
  {
    role: 'assistant',
    content: 'Hello Arjun! I\'ve analyzed your latest health reports. You have 3 new insights from your CBC and Lipid Profile results. Would you like me to summarize them?',
    time: '10:42 AM',
  },
  {
    role: 'user',
    content: 'Yes, please summarize the key findings from my Lipid Profile.',
    time: '10:43 AM',
  },
  {
    role: 'assistant',
    content: 'Your Lipid Profile from June 8th shows: **Total Cholesterol**: 198 mg/dL (optimal ✅), **LDL**: 142 mg/dL (borderline high ⚠️), **HDL**: 48 mg/dL (acceptable, could be higher), **Triglycerides**: 115 mg/dL (normal ✅). \n\nThe main concern is your LDL which is slightly above the 130 mg/dL threshold. I\'d recommend increasing omega-3 rich foods and reducing saturated fats. Want a detailed nutrition plan?',
    time: '10:43 AM',
  },
];

export const healthJourney = [
  {
    date: 'June 12, 2026',
    type: 'report',
    title: 'Complete Blood Count Uploaded',
    detail: '3 insights generated — 1 abnormal finding (Vitamin D)',
    color: '#6366f1',
  },
  {
    date: 'June 8, 2026',
    type: 'report',
    title: 'Lipid Profile Results',
    detail: 'LDL borderline high at 142 mg/dL — review recommended',
    color: '#f59e0b',
  },
  {
    date: 'June 1, 2026',
    type: 'milestone',
    title: 'Health Score Milestone',
    detail: 'Reached 80+ score for the first time — cardiovascular improvement',
    color: '#10b981',
  },
  {
    date: 'May 28, 2026',
    type: 'report',
    title: 'HbA1c Test — 5.4%',
    detail: 'Normal range, excellent metabolic control maintained',
    color: '#06b6d4',
  },
  {
    date: 'May 15, 2026',
    type: 'activity',
    title: 'Started Running Program',
    detail: '5-day/week cardio routine — contributing to heart rate improvement',
    color: '#a855f7',
  },
  {
    date: 'April 20, 2026',
    type: 'report',
    title: 'Annual Physical Examination',
    detail: 'All vitals within range. Next: cardiac stress test recommended',
    color: '#3b82f6',
  },
];
