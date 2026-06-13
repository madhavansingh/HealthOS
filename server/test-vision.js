const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { getDb } = require('./db/database');
const { processReport } = require('./pipeline/reportProcessor');

async function testVision() {
  console.log('🏁 Starting Vision & Multimodal Pipeline Verification Test...');
  const db = getDb();
  
  const reportId = 'test-vision-' + Date.now();
  // Using src/assets/hero.png as a test image
  const sampleImagePath = path.join(__dirname, '../src/assets/hero.png');
  
  console.log(`1. Pre-inserting report record for ID: ${reportId}`);
  db.prepare(`
    INSERT INTO reports (id, user_id, name, file_path, file_name, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(reportId, 'default-user', 'Test Vision Image', sampleImagePath, 'hero.png', 'processing');

  try {
    console.log('2. Triggering processReport pipeline on image...');
    const result = await processReport(reportId, sampleImagePath, 'default-user');
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
    console.log(`Extracted Metrics Count: ${metrics.length}`);
    metrics.forEach(m => {
      console.log(` - ${m.metric_name}: ${m.value || m.value_text} (Conf: ${m.confidence}, Source: ${m.source})`);
    });

    console.log('🎉 Multimodal Pipeline Verification PASSED Successfully!');
  } catch (error) {
    console.error('❌ Multimodal Pipeline Verification FAILED:', error);
    process.exit(1);
  } finally {
    console.log('4. Cleaning up test database entries...');
    db.prepare('DELETE FROM report_metrics WHERE report_id = ?').run(reportId);
    db.prepare('DELETE FROM ai_insights WHERE report_id = ?').run(reportId);
    db.prepare('DELETE FROM vitals_timeline WHERE report_id = ?').run(reportId);
    db.prepare('DELETE FROM health_events WHERE report_id = ?').run(reportId);
    db.prepare('DELETE FROM reports WHERE id = ?').run(reportId);
    console.log('🧹 Cleanup complete.');
  }
}

testVision();
