'use strict';

const cron = require('node-cron');
const digestService = require('../services/monthly-digest.service');
const emailTemplate = require('../services/monthly-digest-email.template');
const mailService = require('../services/mail.service');
const path = require('path');
const Notification = require('../models/notification.model');

/**
 * Controlador de tareas programadas (Cron Jobs)
 * Gestiona el envío de resúmenes mensuales a usuarios
 */

/**
 * Envía el resumen mensual a un usuario específico
 * @param {Object} user - Usuario al que enviar el resumen
 * @returns {Promise<Boolean>} True si se envió correctamente
 */
async function sendDigestToUser(user) {
    try {
        // Respetar preferencia del usuario: si está desactivada, omitir envío
        if (user && user.emailDigestEnabled === false) {
            console.log(`[DIGEST] Preferencia desactivada para ${user.email}, omitiendo envío`);
            return false;
        }
        console.log(`[DIGEST] Generando resumen para ${user.name} ${user.surname} (${user.email})`);
        
        // Generar el resumen del usuario
        const digestData = await digestService.generateUserDigest(user._id);
        
        // Añadir estadísticas de la plataforma
        const platformStats = await digestService.getPlatformStats();
        digestData.platformStats = platformStats;
        
        // Si no hay actividad y el usuario no tiene notificaciones, podemos omitir el envío
        // Descomentar la siguiente línea si solo quieres enviar cuando hay actividad:
        // if (!digestData.hasActivity) {
        //     console.log(`[DIGEST] Sin actividad para ${user.email}, omitiendo envío`);
        //     return false;
        // }
        
        // Generar el HTML del email
        const emailHtml = emailTemplate.generateDigestEmail(digestData);
        const subject = emailTemplate.generateSubject(digestData);
        
        // Enviar el email
        await sendDigestEmail(user.email, subject, emailHtml);
        
        console.log(`[DIGEST] ✓ Resumen enviado exitosamente a ${user.email}`);
        return true;
    } catch (error) {
        console.error(`[DIGEST] ✗ Error enviando resumen a ${user.email}:`, error.message);
        return false;
    }
}

/**
 * Envía un email de resumen usando el servicio de correo
 * @param {String} recipient - Email del destinatario
 * @param {String} subject - Asunto del email
 * @param {String} htmlContent - Contenido HTML del email
 * @returns {Promise<void>}
 */
async function sendDigestEmail(recipient, subject, htmlContent) {
    return new Promise((resolve, reject) => {
        const nodemailer = require('nodemailer');
        const imagePath = path.join(__dirname, '../client/assets/images/');
        
        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE,
            tls: { rejectUnauthorized: false },
            auth: {
                user: process.env.EMAIL,
                pass: process.env.PASSWORD
            }
        });

        const mailOptions = {
            from: `RedDinámica <${process.env.EMAIL_HOST_USER || process.env.EMAIL}>`,
            to: recipient,
            subject: subject,
            html: htmlContent,
            attachments: [
                {
                    filename: 'RDLogo.png',
                    path: imagePath + 'RDLogo.png',
                    cid: 'logo'
                }
            ]
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error(`[EMAIL] Error enviando a ${recipient}:`, error);
                reject(error);
            } else {
                console.log(`[EMAIL] Email enviado: ${info.response}`);
                resolve(info);
            }
            transporter.close();
        });
    });
}

/**
 * Ejecuta el proceso completo de envío de resúmenes mensuales
 * Envía emails a todos los usuarios activos
 */
exports.executeMonthlyDigest = async function() {
    try {
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║    🚀 INICIANDO ENVÍO DE RESÚMENES MENSUALES          ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log(`[DIGEST] Fecha: ${new Date().toLocaleString('es-ES')}`);
        
        // Obtener todos los usuarios activos
        const users = await digestService.getActiveUsers();
        console.log(`[DIGEST] Usuarios activos encontrados: ${users.length}`);
        
        if (users.length === 0) {
            console.log('[DIGEST] ⚠ No hay usuarios activos para enviar resúmenes');
            return { success: true, sent: 0, failed: 0, total: 0 };
        }

        // Estadísticas del envío
        let sent = 0;
        let failed = 0;
        
        // Enviar resúmenes con un pequeño delay entre cada uno para no saturar el servidor
        for (const user of users) {
            const success = await sendDigestToUser(user);
            if (success) {
                sent++;
            } else {
                failed++;
            }
            
            // Delay de 2 segundos entre cada envío
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║           📊 RESUMEN DE ENVÍO COMPLETADO              ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log(`[DIGEST] ✓ Enviados exitosamente: ${sent}/${users.length}`);
        console.log(`[DIGEST] ✗ Fallidos: ${failed}/${users.length}`);
        console.log(`[DIGEST] Finalizado: ${new Date().toLocaleString('es-ES')}`);
        
        return {
            success: true,
            sent,
            failed,
            total: users.length
        };
    } catch (error) {
        console.error('[DIGEST] ✗ Error crítico en el proceso de envío:', error);
        return {
            success: false,
            error: error.message,
            sent: 0,
            failed: 0,
            total: 0
        };
    }
};

/**
 * Endpoint manual para ejecutar el resumen mensual (útil para testing)
 * Uso: GET /api/cron/execute-monthly-digest
 */
exports.manualExecuteDigest = async function(req, res) {
    try {
        // Solo permitir a administradores ejecutar manualmente
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Solo administradores pueden ejecutar esta acción'
            });
        }

        console.log(`[DIGEST] Ejecución manual solicitada por ${req.user.sub}`);
        const result = await exports.executeMonthlyDigest();
        
        return res.status(200).json({
            status: 'success',
            message: 'Resumen mensual ejecutado correctamente',
            data: result
        });
    } catch (error) {
        console.error('[DIGEST] Error en ejecución manual:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Error ejecutando resumen mensual',
            error: error.message
        });
    }
};

/**
 * Endpoint de prueba para enviar resumen a un usuario específico
 * Uso: POST /api/cron/test-digest/:userId
 */
exports.testDigestForUser = async function(req, res) {
    try {
        // Solo permitir a administradores
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Solo administradores pueden ejecutar esta acción'
            });
        }

        const userId = req.params.userId;
        const User = require('../models/user.model');
        const user = await User.findById(userId).lean();
        
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'Usuario no encontrado'
            });
        }

        console.log(`[DIGEST] Test de resumen para usuario ${user.email}`);
        const success = await sendDigestToUser(user);
        
        if (success) {
            return res.status(200).json({
                status: 'success',
                message: `Resumen de prueba enviado a ${user.email}`
            });
        } else {
            return res.status(500).json({
                status: 'error',
                message: 'Error enviando resumen de prueba'
            });
        }
    } catch (error) {
        console.error('[DIGEST] Error en test de resumen:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Error ejecutando test de resumen',
            error: error.message
        });
    }
};

/**
 * Inicializa el cron job para envío mensual automático
 * Se ejecuta el día 1 de cada mes a las 9:00 AM
 */
exports.initMonthlyDigestCron = function() {
    // Cron expression: '0 9 1 * *' = minuto 0, hora 9, día 1 de cada mes
    // Para testing, puedes usar '*/5 * * * *' (cada 5 minutos)
    
    const cronExpression = process.env.DIGEST_CRON || '0 9 1 * *';
    
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║      📅 INICIALIZANDO CRON JOB DE RESÚMENES          ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`[CRON] Expresión: ${cronExpression}`);
    console.log('[CRON] Descripción: Día 1 de cada mes a las 9:00 AM');
    console.log('[CRON] Para testing, configura DIGEST_CRON=*/5 * * * * en .env');
    
    const task = cron.schedule(cronExpression, async () => {
        console.log('\n[CRON] ⏰ Ejecutando tarea programada de resumen mensual...');
        await exports.executeMonthlyDigest();
    }, {
        scheduled: true,
        timezone: process.env.TIMEZONE || "America/Bogota"
    });
    
    console.log('[CRON] ✓ Cron job inicializado correctamente');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    return task;
};


/**
 * Ejecuta la limpieza de notificaciones antiguas
 * Elimina todas las notificaciones con `created_at` anterior al periodo de retención
 * Por defecto, mantiene 4 meses y elimina el resto
 */
exports.executeNotificationCleanup = async function() {
    try {
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║          INICIANDO LIMPIEZA DE NOTIFICACIONES          ║');
        console.log('╚════════════════════════════════════════════════════════╝');

        const retentionMonths = parseInt(process.env.NOTIFICATION_RETENTION_MONTHS || '4', 10);
        const now = new Date();
        const cutoffDate = new Date(now);
        cutoffDate.setMonth(cutoffDate.getMonth() - (isNaN(retentionMonths) ? 4 : retentionMonths));

        console.log(`[CLEANUP] Fecha actual: ${now.toISOString()}`);
        console.log(`[CLEANUP] Retención: ${retentionMonths} meses`);
        console.log(`[CLEANUP] Eliminando notificaciones con created_at < ${cutoffDate.toISOString()}`);

        const result = await Notification.deleteMany({
            created_at: { $lt: cutoffDate }
        });

        const deleted = (result && (result.deletedCount || result.n)) ? (result.deletedCount || result.n) : 0;

        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║                  LIMPIEZA COMPLETADA                   ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log(`[CLEANUP] ✓ Notificaciones eliminadas: ${deleted}`);

        return {
            success: true,
            deleted,
            cutoff: cutoffDate.toISOString(),
            retentionMonths
        };
    } catch (error) {
        console.error('[CLEANUP] X Error crítico en limpieza de notificaciones:', error);
        return {
            success: false,
            error: error.message,
            deleted: 0
        };
    }
};

/**
 * Endpoint manual para ejecutar la limpieza de notificaciones (útil para testing)
 * Uso: GET /api/cron/execute-notification-cleanup
 */
exports.manualExecuteNotificationCleanup = async function(req, res) {
    try {
        // Solo permitir a administradores ejecutar manualmente
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Solo administradores pueden ejecutar esta acción'
            });
        }

        console.log(`[CLEANUP] Ejecución manual solicitada por ${req.user.sub}`);
        const result = await exports.executeNotificationCleanup();

        return res.status(200).json({
            status: 'success',
            message: 'Limpieza de notificaciones ejecutada correctamente',
            data: result
        });
    } catch (error) {
        console.error('[CLEANUP] Error en ejecución manual:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Error ejecutando limpieza de notificaciones',
            error: error.message
        });
    }
};

/**
 * Inicializa el cron job para limpieza mensual automática de notificaciones
 * Se ejecuta el día 1 de cada mes a las 3:00 AM por defecto
 */
exports.initNotificationCleanupCron = function() {
    // Cron expression por defecto: '0 3 1 * *' = minuto 0, hora 3, día 1 de cada mes
    // Para testing, puedes usar '*/10 * * * *' (cada 10 minutos)

    const cronExpression = process.env.NOTIF_CLEANUP_CRON || '0 3 1 * *';

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   🗓️  INICIALIZANDO CRON DE LIMPIEZA NOTIFICACIONES   ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`[CRON] Expresión limpieza: ${cronExpression}`);
    console.log('[CRON] Descripción: Día 1 de cada mes a las 3:00 AM');
    console.log('[CRON] Para testing, configura NOTIF_CLEANUP_CRON=*/10 * * * * en .env');

    const task = cron.schedule(cronExpression, async () => {
        console.log('\n[CRON] ⏰ Ejecutando tarea programada de limpieza de notificaciones...');
        await exports.executeNotificationCleanup();
    }, {
        scheduled: true,
        timezone: process.env.TIMEZONE || "America/Bogota"
    });

    console.log('[CRON] ✓ Cron job de limpieza inicializado correctamente');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    return task;
};
