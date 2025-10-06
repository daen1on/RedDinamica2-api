'use strict'

var express = require('express');
var cors = require('cors')
var corsOptions = {
    origin:'http://localhost:4200',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  }
var api = express.Router();

var auth = require('../middlewares/auth.middleware');
var controlAccessResources = require('../middlewares/controlAccessResources.middleware');
var controlAccess = require('../middlewares/controlAccess.middleware');
var gdpr = require('../middlewares/gdpr.middleware');
let uploadMiddleware = require('../middlewares/multer.middleware');

var resourceController = require('../controllers/resource.controller');

const RESOURCE_PATH = '../uploads/resources/';

// Crear recurso - requiere activación
api.post('/resource', [auth.ensureAuth, gdpr.ensureActivated], resourceController.saveResource);

api.post('/upload-resource/:id', [cors(corsOptions), auth.ensureAuth, gdpr.ensureActivated, uploadMiddleware.uploadFile(RESOURCE_PATH)], resourceController.uploadResourceFile);
api.get('/get-resource/:file', resourceController.getResourceFile);

// Actualizar recurso - requiere activación
api.put('/resource/:id', [auth.ensureAuth, gdpr.ensureActivated], resourceController.updateResource);

api.delete('/resource/:id', [auth.ensureAuth, controlAccessResources.isAdmin], resourceController.deleteResource);

// Ver recursos - requiere activación (protección GDPR)
api.get('/resources/:visibleOnes/:page?', [auth.ensureAuth, gdpr.ensureActivated], resourceController.getResources);
api.get('/all-resources/:visibleOnes/:order?', [auth.ensureAuth, gdpr.ensureActivated], resourceController.getAllResources);

// Sugerir recursos - requiere activación
api.get('/suggest-resources/:page?', [auth.ensureAuth, gdpr.ensureActivated], resourceController.getSuggestResources);

// ===== NUEVAS RUTAS PARA NOTIFICACIONES =====

// Aprobar recurso
api.put('/resource/:id/approve', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], resourceController.approveResource);

// Rechazar recurso
api.put('/resource/:id/reject', [auth.ensureAuth, controlAccess.isAdminOrLessonManager], resourceController.rejectResource);

module.exports = api;