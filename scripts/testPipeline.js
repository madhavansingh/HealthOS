const path = require('path');
const fs = require('fs');
const { getDb } = require('../server/src/database/connection');
const { processReport } = require('../server/src/services/reportProcessor');
const ReportRepository = require('../server/src/database/repositories/ReportRepository');
const InsightRepository = require('../server/src/database/repositories/InsightRepository');
const TimelineRepository = require('../server/src/database/repositories/TimelineRepository');
const EventRepository = require('../server/src/database/repositories/EventRepository');

// Set NODE_PATH so requiring modules inside server/src works correctly if needed
process.env.NODE_PATH = path.resolve(__dirname, '../server/node_modules');
require('module').Module._initPaths();

async function runSmokeTest() {
  console.log('🏁 Starting HealthOS Unified E2E Production Smoke Test...\n');
  const db = getDb();
  
  const testReports = [
    {
      id: 'smoke-healthy-' + Date.now(),
      name: 'Healthy Adult (Demo)',
      filename: 'healthy-adult-report.pdf',
      path: path.join(__dirname, '../storage/demo-documents/healthy-adult-report.pdf'),
      expectedStatus: 'analyzed',
      simulateGeminiFail: false
    },
    {
      id: 'smoke-deficient-' + Date.now(),
      name: 'Vitamin D Deficiency (Demo)',
      filename: 'vitamin-d-deficiency-report.pdf',
      path: path.join(__dirname, '../storage/demo-documents/vitamin-d-deficiency-report.pdf'),
      expectedStatus: 'analyzed',
      simulateGeminiFail: true // Tests Issue #4 (Gemini Fallback)
    },
    {
      id: 'smoke-invalid-' + Date.now(),
      name: 'Invalid Document',
      filename: 'invalid-doc.txt',
      path: path.join(__dirname, 'invalid-doc.txt'),
      expectedStatus: 'unsupported',
      simulateGeminiFail: false
    }
  ];

  // Write temporary invalid document
  fs.writeFileSync(path.join(__dirname, 'invalid-doc.txt'), 'This is a random text file about programming, not a medical lab report.');

  try {
    for (const test of testReports) {
      console.log(`--------------------------------------------------`);
      console.log(`Processing Test Case: ${test.name}`);
      console.log(`--------------------------------------------------`);

      // Verify source file exists
      if (!fs.existsSync(test.path)) {
        throw new Error(`Test source file not found at ${test.path}. Run "npm run generate-pdfs" first.`);
      }

      // 1. Create database record
      ReportRepository.create({
        id: test.id,
        user_id: 'default-user',
        name: test.name,
        file_path: test.path,
        file_name: test.filename,
        status: 'processing'
      });

      // 2. Set up Gemini failure simulation if requested
      const originalApiKey = process.env.GEMINI_API_KEY;
      if (test.simulateGeminiFail) {
        console.log('⚠️ Simulating Gemini API key failure (Quota Exceeded / Invalid Key)...');
        process.env.GEMINI_API_KEY = 'invalid_simulated_key';
      }

      // 3. Process report
      console.log(`Running pipeline for report ID: ${test.id}...`);
      await processReport(test.id, test.path, 'default-user');

      // Restore key
      if (test.simulateGeminiFail) {
        process.env.GEMINI_API_KEY = originalApiKey;
        console.log('Restored original Gemini API Key.');
      }

      // 4. Validate results
      const report = ReportRepository.findById(test.id);
      console.log(`Report Status: "${report?.status}" (Expected: "${test.expectedStatus}")`);
      
      if (report?.status !== test.expectedStatus) {
        throw new Error(`Test failed: Expected status "${test.expectedStatus}" but got "${report?.status}"`);
      }

      if (test.expectedStatus === 'analyzed') {
        const metrics = ReportRepository.getMetricsByReportId(test.id);
        const insights = InsightRepository.getInsightsByUserId('default-user').filter(i => i.report_id === test.id);
        const timeline = TimelineRepository.getTimelineVitals('default-user').filter(t => t.report_id === test.id);
        const meta = ReportRepository.getProcessingMeta(test.id);

        console.log(` - Extracted Metrics: ${metrics.length} (Expected: >0)`);
        console.log(` - Saved Insights: ${insights.length} (Expected: >0)`);
        console.log(` - Timeline Vitals: ${timeline.length} (Expected: >0)`);
        console.log(` - Fallback Triggered: ${meta.aiFallback || false}`);

        if (metrics.length === 0) throw new Error('Failed to extract metrics!');
        if (insights.length === 0) throw new Error('Failed to generate insights!');
        if (timeline.length === 0) throw new Error('Failed to populate timeline!');

        if (test.simulateGeminiFail) {
          if (!meta.aiFallback) throw new Error('Gemini fallback was not flagged in metadata!');
          console.log('✅ Gemini Failure Fallback correctly activated and handled!');
        }
      } else if (test.expectedStatus === 'unsupported') {
        const meta = ReportRepository.getProcessingMeta(test.id);
        console.log(` - Document correctly identified as non-medical: isMedicalDocument = ${meta.isMedicalDocument}`);
        if (meta.isMedicalDocument !== false) {
          throw new Error('Invalid document was not flagged as non-medical!');
        }
      }

      console.log(`✅ Test Case "${test.name}" PASSED!\n`);
    }

    console.log('==================================================');
    console.log('🎉 ALL SMOKE TESTS COMPLETED SUCCESSFULLY! (100/100)');
    console.log('==================================================');

  } catch (err) {
    console.error(`\n❌ Smoke test failed:`, err.message);
    process.exit(1);
  } finally {
    // Cleanup database test records
    console.log('\nCleaning up database smoke test records...');
    for (const test of testReports) {
      ReportRepository.deleteMetricsByReportId(test.id);
      InsightRepository.deleteInsightsByReportId(test.id);
      TimelineRepository.deleteVitalsByReportId(test.id);
      EventRepository.deleteEventsByReportId(test.id);
      ReportRepository.delete(test.id);
    }
    
    // Delete temp invalid file
    const invalidPath = path.join(__dirname, 'invalid-doc.txt');
    if (fs.existsSync(invalidPath)) fs.unlinkSync(invalidPath);

    // Rebuild final health scores to keep database pristine
    const { rebuildHealthScores } = require('../server/src/services/reportProcessor');
    await rebuildHealthScores('default-user');
    console.log('🧹 Cleanup complete.');
  }
}

runSmokeTest();
