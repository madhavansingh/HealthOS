const { PDFParse } = require('pdf-parse');
const fs = require('fs');

/**
 * Extract raw text from PDF file
 */
async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  
  try {
    const data = await parser.getText({
      first: 10, // Limit to first 10 pages for speed
    });
    
    return {
      text: data.text,
      pages: data.total,
      info: {},
    };
  } catch (err) {
    throw new Error(`PDF parsing failed: ${err.message}`);
  } finally {
    await parser.destroy();
  }
}

/**
 * Clean extracted text for better AI processing
 */
function cleanMedicalText(rawText) {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\t+/g, ' ')
    .replace(/  +/g, ' ')
    .trim();
}

/**
 * Extract structured table data from text using patterns
 */
function extractTabularData(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const tableRows = [];

  for (const line of lines) {
    // Match pattern: METRIC NAME  value  unit  reference
    const match = line.match(/^(.+?)\s{2,}([\d.]+)\s*([a-zA-Z/%]+)?\s*([\d.\-–]+)?\s*[-–to]?\s*([\d.]+)?/);
    if (match) {
      tableRows.push({
        name: match[1]?.trim(),
        value: match[2]?.trim(),
        unit: match[3]?.trim() || '',
        refLow: match[4]?.trim() || null,
        refHigh: match[5]?.trim() || null,
      });
    }
  }

  return tableRows;
}

module.exports = { extractTextFromPDF, cleanMedicalText, extractTabularData };
