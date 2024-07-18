const express = require('express');
const router = express.Router();
const errorReportController = require('../controllers/errorReportController');
const authMiddleware = require('../middlewares/auth.middleware');
const { uploadFile } = require('../middlewares/multer.middleware');
const ERROR_PATH = '../uploads/errors/';

router.post('/error-report', authMiddleware.ensureAuth, uploadFile(ERROR_PATH), errorReportController.createErrorReport);
router.get('/error-reports', authMiddleware.ensureAuth, errorReportController.getErrorReports);
router.delete('/error-reports/:id', authMiddleware.ensureAuth, errorReportController.deleteErrorReport);
router.get('/files/:file', authMiddleware.ensureAuth, errorReportController.getFile);
router.put('/error-reports/:id', authMiddleware.ensureAuth, uploadFile(ERROR_PATH), errorReportController.updateErrorReport);

module.exports = router;


