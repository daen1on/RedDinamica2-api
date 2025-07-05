'use strict'

let jwt = require('jwt-simple');
let moment = require('moment');
let SECRET_KEY = process.env.SECRET_KEY;
const TokenInvalidationService = require('../services/token-invalidation.service');

exports.ensureAuth = function(req, res, next){
    let token, payload;

    if(!req.headers.authorization){
        return res.status(400).send({message: 'Request hasn\'t got authorization header'});
    }else{
        token = req.headers.authorization.replace(/['"]+/g,'');
    }
    try {
        payload = jwt.decode(token, SECRET_KEY);

        if(payload.exp <= moment().unix()){
            res.set('WWW-Authenticate', 'Bearer realm="Token has expired"');
            return res.status(401).send({
                message: 'Session token has expired'
            });
        }
        
        // Verificar si el token específico fue invalidado
        if(TokenInvalidationService.isTokenInvalidated(token)){
            res.set('WWW-Authenticate', 'Bearer realm="Token has been invalidated"');
            return res.status(401).send({
                message: 'Token has been invalidated. Please login again.',
                code: 'TOKEN_INVALIDATED'
            });
        }
        
        // Verificar si el token es anterior a la última actualización del usuario
        if(TokenInvalidationService.isTokenOutdated(payload.sub, payload.iat)){
            res.set('WWW-Authenticate', 'Bearer realm="Token is outdated"');
            return res.status(401).send({
                message: 'Your account was updated. Please login again to see the changes.',
                code: 'TOKEN_OUTDATED'
            });
        }
        
    } catch (ex) {
        return res.status(403).send({
            message: 'Invalid token'
        });
    }

    req.user = payload;

    next();
};
