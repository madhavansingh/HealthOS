const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const reports = [
  {
    filename: 'healthy-adult-report.pdf',
    text: `==================================================
HEALTHOS CLINICAL LABORATORIES
==================================================
PATIENT: John Doe          AGE: 34      GENDER: Male
DATE: 2026-06-13           SAMPLE TYPE: Blood Serum
--------------------------------------------------
COMPLETE BLOOD COUNT (CBC) & METABOLIC PANEL
--------------------------------------------------
TEST NAME               RESULT     UNIT      REFERENCE RANGE
--------------------------------------------------
Hemoglobin              15.2       g/dL      13.0 - 17.5     [NORMAL]
Red Blood Cells (RBC)   5.1        M/uL      4.3 - 5.9       [NORMAL]
Hematocrit              45.0       %         41.0 - 50.0     [NORMAL]
MCV                     90.0       fL        80.0 - 100.0    [NORMAL]
MCH                     30.0       pg        27.0 - 33.0     [NORMAL]
MCHC                    33.0       g/dL      32.0 - 36.0     [NORMAL]
RDW                     12.5       %         11.0 - 15.0     [NORMAL]

Fasting Glucose         88         mg/dL     70 - 99         [NORMAL]
HbA1c                   5.2        %         4.0 - 5.6       [NORMAL]

Total Cholesterol       180        mg/dL     100 - 199       [NORMAL]
LDL Cholesterol         95         mg/dL     0 - 99          [NORMAL]
HDL Cholesterol         55         mg/dL     40 - 60         [NORMAL]
Triglycerides           110        mg/dL     0 - 149         [NORMAL]

Vitamin D (25-OH)       42.0       ng/mL     30.0 - 100.0    [NORMAL]
Vitamin B12             450        pg/mL     200 - 900       [NORMAL]
TSH                     1.8        mIU/L     0.4 - 4.5       [NORMAL]
--------------------------------------------------
Report electronically signed by: Dr. Priya Sharma
==================================================`
  },
  {
    filename: 'vitamin-d-deficiency-report.pdf',
    text: `==================================================
HEALTHOS CLINICAL LABORATORIES
==================================================
PATIENT: Jane Smith        AGE: 29      GENDER: Female
DATE: 2026-06-13           SAMPLE TYPE: Blood Serum
--------------------------------------------------
COMPLETE BLOOD COUNT (CBC) & VITAMIN PANEL
--------------------------------------------------
TEST NAME               RESULT     UNIT      REFERENCE RANGE
--------------------------------------------------
Hemoglobin              11.8       g/dL      12.0 - 16.0     [LOW]
Red Blood Cells (RBC)   3.8        M/uL      3.8 - 5.2       [LOW]
Hematocrit              35.5       %         36.0 - 46.0     [LOW]
MCV                     91.0       fL        80.0 - 100.0    [NORMAL]
MCH                     30.0       pg        27.0 - 33.0     [NORMAL]
MCHC                    33.2       g/dL      32.0 - 36.0     [NORMAL]
RDW                     12.8       %         11.0 - 15.0     [NORMAL]

Fasting Glucose         90         mg/dL     70 - 99         [NORMAL]
HbA1c                   5.3        %         4.0 - 5.6       [NORMAL]

Vitamin D (25-OH)       12.0       ng/mL     30.0 - 100.0    [CRITICAL LOW]
Vitamin B12             310        pg/mL     200 - 900       [NORMAL]
TSH                     2.1        mIU/L     0.4 - 4.5       [NORMAL]
--------------------------------------------------
Clinical Notes: Patient reports mild fatigue and muscle weakness.
Report electronically signed by: Dr. Priya Sharma
==================================================`
  },
  {
    filename: 'metabolic-risk-report.pdf',
    text: `==================================================
HEALTHOS CLINICAL LABORATORIES
==================================================
PATIENT: Robert Johnson    AGE: 48      GENDER: Male
DATE: 2026-06-13           SAMPLE TYPE: Blood Serum
--------------------------------------------------
METABOLIC & LIPID RISK ASSESSMENT
--------------------------------------------------
TEST NAME               RESULT     UNIT      REFERENCE RANGE
--------------------------------------------------
Hemoglobin              14.5       g/dL      13.0 - 17.5     [NORMAL]
Red Blood Cells (RBC)   4.8        M/uL      4.3 - 5.9       [NORMAL]
Hematocrit              43.0       %         41.0 - 50.0     [NORMAL]

Fasting Glucose         138        mg/dL     70 - 99         [HIGH]
HbA1c                   6.4        %         4.0 - 5.6       [HIGH]

Total Cholesterol       245        mg/dL     100 - 199       [HIGH]
LDL Cholesterol         158        mg/dL     0 - 99          [HIGH]
HDL Cholesterol         35         mg/dL     40 - 60         [LOW]
Triglycerides           240        mg/dL     0 - 149         [HIGH]

Vitamin D (25-OH)       32.0       ng/mL     30.0 - 100.0    [NORMAL]
TSH                     1.9        mIU/L     0.4 - 4.5       [NORMAL]
--------------------------------------------------
Clinical Notes: Impaired fasting glucose, hypertriglyceridemia, and high LDL.
Report electronically signed by: Dr. Priya Sharma
==================================================`
  }
];

const dirs = [
  path.join(__dirname, '../storage/demo-documents'),
  path.join(__dirname, '../client/public/assets/demo-documents'),
  path.join(__dirname, '../assets/demo-documents')
];

// Ensure dirs exist
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

reports.forEach(report => {
  dirs.forEach(dir => {
    const filePath = path.join(dir, report.filename);
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);
    
    // Set Courier font (built-in, no external file needed) and size
    doc.font('Courier').fontSize(10);
    
    // Write text
    doc.text(report.text, { align: 'left', lineGap: 4 });
    
    doc.end();
    
    writeStream.on('finish', () => {
      console.log(`Generated: ${filePath}`);
    });
  });
});
