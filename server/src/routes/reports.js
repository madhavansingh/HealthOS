const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ReportsController = require('../controllers/reportsController');
const storageConfig = require('../config/storage');

const router = express.Router();

const storage = multer.diskStorage({
  destination: storageConfig.uploadsDir,
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: storageConfig.maxFileSize },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (storageConfig.supportedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Only ${storageConfig.supportedExtensions.join(', ')} files are supported`));
    }
  },
});

router.post('/upload', upload.single('file'), ReportsController.upload);
router.post('/analyze-demo', ReportsController.analyzeDemo);
router.get('/', ReportsController.getReports);
router.get('/compare', ReportsController.getReportComparison);
router.get('/:id', ReportsController.getReportDetails);
router.get('/:id/status', ReportsController.getReportStatus);
router.delete('/:id', ReportsController.deleteReport);

module.exports = router;
