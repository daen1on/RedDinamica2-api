const express = require('express');
const router = express.Router();
const errorReportController = require('../controllers/errorReportController');
const authMiddleware = require('../middlewares/auth.middleware');
const controlAccess = require('../middlewares/controlAccess.middleware');
const { uploadFile } = require('../middlewares/multer.middleware');
const ERROR_PATH = '../uploads/errors/';

router.post('/error-report', authMiddleware.ensureAuth, uploadFile(ERROR_PATH), errorReportController.createErrorReport);
router.get('/error-reports', authMiddleware.ensureAuth, errorReportController.getErrorReports);
router.delete('/error-reports/:id', authMiddleware.ensureAuth, errorReportController.deleteErrorReport);
router.get('/files/:file', authMiddleware.ensureAuth, errorReportController.getFile);
router.put('/error-reports/:id', authMiddleware.ensureAuth, uploadFile(ERROR_PATH), errorReportController.updateErrorReport);

// Nuevos endpoints para gestión de denuncias (solo admin)
router.post('/error-reports/:id/resolve', [authMiddleware.ensureAuth, controlAccess.isAdmin], errorReportController.resolveComplaint);
router.post('/admin/send-warning', [authMiddleware.ensureAuth, controlAccess.isAdmin], errorReportController.sendWarningToUser);

module.exports = router;


