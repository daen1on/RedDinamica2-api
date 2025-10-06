'use strict'

const User = require('../models/user.model');

/**
 * Middleware para garantizar que el usuario esté activado antes de acceder a recursos protegidos
 * Cumplimiento GDPR: Protección de datos personales
 * 
 * Este middleware implementa:
 * - Art. 5 GDPR: Minimización de datos, limitación de finalidad
 * - Art. 25 GDPR: Protección de datos desde el diseño
 * - Art. 32 GDPR: Seguridad del tratamiento
 */
exports.ensureActivated = async function(req, res, next) {
    // El middleware auth.ensureAuth debe ejecutarse antes, así que req.user ya existe
    if (!req.user || !req.user.sub) {
        return res.status(401).send({
            status: 'error',
            message: 'No se pudo verificar el usuario',
            code: 'USER_NOT_FOUND'
        });
    }

    try {
        // Buscar el usuario en la base de datos para verificar su estado de activación
        const user = await User.findById(req.user.sub).exec();
        if (!user) {
            return res.status(500).send({
                status: 'error',
                message: 'Error al verificar el estado del usuario',
                code: 'DATABASE_ERROR'
            });
        }

        // Verificar si el usuario está activado
        if (!user.actived) {
            // Log de intento de acceso no autorizado (para auditoría GDPR)
            console.warn(`[GDPR-RESTRICTION] Usuario no activado intentó acceder a recurso protegido:`, {
                userId: user._id,
                email: user.email,
                timestamp: new Date().toISOString(),
                route: req.originalUrl,
                method: req.method
            });

            return res.status(403).send({
                status: 'error',
                message: 'Tu cuenta aún no ha sido activada por un administrador. ' +
                         'tienes acceso limitado hasta que tu cuenta sea aprobada. ' +
                         'Contacta con un administrador si crees que esto es un error.',
                code: 'ACCOUNT_NOT_ACTIVATED',
                restrictions: [
                    'No puedes acceder a recursos educativos',
                    'No puedes acceder a lecciones académicas',
                    'No puedes comentar en publicaciones',
                    'No puedes enviar mensajes privados',
                    'No puedes ver información personal de otros usuarios',
                    'No puedes seguir a otros usuarios',
                    'No puedes participar en convocatorias de lecciones'
                ],
                contact: 'Por favor, espera a que un administrador active tu cuenta'
            });
        }

        // Usuario activado, permitir acceso
        return next();
    } catch (err) {
        return res.status(500).send({
            status: 'error',
            message: 'Error al verificar el estado del usuario',
            code: 'DATABASE_ERROR'
        });
    }
};

/**
 * Middleware más ligero que solo verifica el campo actived sin consultar la base de datos
 * Útil cuando ya tenemos la información del usuario cargada
 * 
 * NOTA: Este método asume que el payload del JWT contiene el campo 'actived'
 * Si no está en el JWT, usar ensureActivated que consulta la base de datos
 */
exports.ensureActivatedFast = function(req, res, next) {
    if (!req.user) {
        return res.status(401).send({
            status: 'error',
            message: 'No se pudo verificar el usuario',
            code: 'USER_NOT_FOUND'
        });
    }

    // Verificar si el usuario está activado (desde el token JWT)
    // NOTA: Esto requiere que el campo 'actived' esté incluido en el payload del token
    if (req.user.actived === false || req.user.actived === undefined) {
        console.warn(`[GDPR-RESTRICTION-FAST] Usuario no activado intentó acceder:`, {
            userId: req.user.sub,
            timestamp: new Date().toISOString(),
            route: req.originalUrl
        });

        return res.status(403).send({
            status: 'error',
            message: 'Cuenta no activada. Acceso restringido por protección de datos (GDPR).',
            code: 'ACCOUNT_NOT_ACTIVATED'
        });
    }

    next();
};

/**
 * Middleware para logging de accesos a datos personales (GDPR Art. 30)
 * Útil para mantener registros de procesamiento de datos personales
 */
exports.logDataAccess = function(dataType) {
    return function(req, res, next) {
        console.log(`[GDPR-DATA-ACCESS] Acceso a datos personales:`, {
            userId: req.user ? req.user.sub : 'unknown',
            dataType: dataType,
            route: req.originalUrl,
            method: req.method,
            timestamp: new Date().toISOString(),
            ip: req.ip
        });
        next();
    };
};

/**
 * Middleware para verificar que el usuario puede acceder a recursos sensibles
 * Combina autenticación + activación + logging
 */
exports.ensureActivatedWithLogging = function(resourceType) {
    return function(req, res, next) {
        // Primero verificar activación
        exports.ensureActivated(req, res, (err) => {
            if (err) return next(err);
            
            // Si está activado, hacer logging
            console.log(`[GDPR-APPROVED-ACCESS] Usuario activado accedió a:`, {
                userId: req.user.sub,
                resourceType: resourceType,
                route: req.originalUrl,
                timestamp: new Date().toISOString()
            });
            
            next();
        });
    };
};
