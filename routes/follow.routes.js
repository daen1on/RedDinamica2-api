'use strict'

let express = require('express');
let api = express.Router();

let auth = require('../middlewares/auth.middleware');
let gdpr = require('../middlewares/gdpr.middleware');
//let controlAccess = require('../middlewares/controlAccess.middleware');

let followController = require('../controllers/follow.controller');

// Seguir usuario - requiere activación (protección GDPR)
api.post('/follow', [auth.ensureAuth, gdpr.ensureActivated], followController.saveFollow);
// Dejar de seguir - requiere activación
api.delete('/follow/:id', [auth.ensureAuth, gdpr.ensureActivated], followController.deleteFollow);
// Ver siguiendo - requiere activación
api.get('/following/:id?/:page?', [auth.ensureAuth, gdpr.ensureActivated], followController.getFollowingUsers);
// Ver seguidores - requiere activación
api.get('/followers/:id?/:page?', [auth.ensureAuth, gdpr.ensureActivated], followController.getFollowersUsers);
// Ver mis seguidores - requiere activación
api.get('/my-follows/:followed?', [auth.ensureAuth, gdpr.ensureActivated], followController.getMyFollows);

module.exports = api;