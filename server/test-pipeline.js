const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { getDb } = require('./db/database');
const { processReport } = require('./pipeline/reportProcessor');

async function testPipeline() {
  console.log('🏁 Starting End-to-End Pipeline Verification Test...');
  const db = getDb();
  
  const reportId = 'test-integration-' + Date.now();
  const samplePdfPath = path.join(__dirname, 'uploads/1080508f-a84b-46dd-846f-63e0ecea7d7f-sterling-accuris-pathology-sample-report-unlocked.pdf');
  
  console.log(`1. Pre-inserting report record for ID: ${reportId}`);
  db.prepare(`
    INSERT INTO reports (id, user_id, name, file_path, file_name, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(reportId, 'default-user', 'Test Pathologist Report', samplePdfPath, 'sterling-report.pdf', 'processing');

  try {
    console.log('2. Triggering processReport pipeline...');
    const result = await processReport(reportId, samplePdfPath, 'default-user');
    console.log('✅ Pipeline Execution Result:', result);
    
    console.log('3. Validating database insertions...');
    
    // Check report status
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
    console.log(`Report Status: ${report?.status} (Expected: analyzed)`);
    if (report?.status !== 'analyzed') {
      throw new Error(`Report status is ${report?.status}, expected analyzed`);
    }

    // Check report metrics
    const metrics = db.prepare('SELECT * FROM report_metrics WHERE report_id = ?').all(reportId);
    console.log(`Extracted Metrics Count: ${metrics.length} (Expected: > 0)`);
    if (metrics.length === 0) {
      throw new Error('No metrics were saved to database!');
    }
    console.log('Sample Extracted Metrics:');
    metrics.slice(0, 5).forEach(m => {
      console.log(` - ${m.metric_name}: ${m.value} ${m.unit} (${m.status})`);
    });

    // Check vitals timeline
    const timeline = db.prepare('SELECT * FROM vitals_timeline WHERE report_id = ?').all(reportId);
    console.log(`Timeline Vitals Count: ${timeline.length}`);
    if (timeline.length === 0) {
      throw new Error('No timeline vitals were inserted!');
    }
    console.log('Timeline Vitals:');
    timeline.forEach(t => {
      console.log(` - [Timeline] ${t.metric_name}: ${t.value} ${t.unit} on ${t.date}`);
    });

    // Check AI insights
    const insights = db.prepare('SELECT * FROM ai_insights WHERE report_id = ?').all(reportId);
    console.log(`AI Insights Count: ${insights.length}`);
    insights.forEach(ins => {
      console.log(` - [Insight] ${ins.title}: ${ins.description}`);
    });

    console.log('🎉 E2E Pipeline Verification PASSED Successfully!');
  } catch (error) {
    console.error('❌ E2E Pipeline Verification FAILED:', error);
    process.exit(1);
  } finally {
    // Clean up test records to keep database neat
    console.log('4. Cleaning up test database entries...');
    db.prepare('DELETE FROM report_metrics WHERE report_id = ?').run(reportId);
    db.prepare('DELETE FROM ai_insights WHERE report_id = ?').run(reportId);
    db.prepare('DELETE FROM vitals_timeline WHERE report_id = ?').run(reportId);
    db.prepare('DELETE FROM health_events WHERE report_id = ?').run(reportId);
    db.prepare('DELETE FROM reports WHERE id = ?').run(reportId);
    console.log('🧹 Cleanup complete.');
  }
}

testPipeline();
