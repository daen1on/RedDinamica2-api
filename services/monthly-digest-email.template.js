'use strict';

const moment = require('moment');
moment.locale('es');

/**
 * Genera el HTML para el email de resumen mensual
 * @param {Object} digestData - Datos del resumen
 * @returns {String} HTML del email
 */
exports.generateDigestEmail = function(digestData) {
    const { user, lessons, notifications, period, platformStats } = digestData;
    
    const hasLessons = lessons.total > 0;
    const hasNotifications = notifications.total > 0;
    const hasActivity = hasLessons || hasNotifications;

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;700&display=swap" rel="stylesheet">
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f4f7f9;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 650px;
                margin: 20px auto;
                background-color: #ffffff;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .header {
                background: linear-gradient(135deg, #2C3E50 0%, #34495E 100%);
                padding: 30px 20px;
                text-align: center;
                color: white;
            }
            .header img {
                width: 60px;
                height: auto;
                margin-bottom: 15px;
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 700;
                font-family: 'Comfortaa', cursive;
            }
            .header p {
                margin: 10px 0 0 0;
                font-size: 14px;
                opacity: 0.9;
            }
            .greeting {
                padding: 30px 30px 10px 30px;
                font-size: 16px;
                color: #2C3E50;
            }
            .greeting strong {
                color: #18BC9C;
            }
            .stats-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                padding: 20px 30px;
            }
            .stat-card {
                flex: 1;
                min-width: 140px;
                background: linear-gradient(135deg, #18BC9C 0%, #16A085 100%);
                color: white;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .stat-card.orange {
                background: linear-gradient(135deg, #E74C3C 0%, #C0392B 100%);
            }
            .stat-card.blue {
                background: linear-gradient(135deg, #3498DB 0%, #2980B9 100%);
            }
            .stat-number {
                font-size: 36px;
                font-weight: bold;
                margin: 0;
                line-height: 1;
            }
            .stat-label {
                font-size: 12px;
                margin-top: 8px;
                opacity: 0.95;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .section {
                padding: 20px 30px;
                border-top: 1px solid #ecf0f1;
            }
            .section-title {
                font-size: 20px;
                color: #2C3E50;
                margin: 0 0 15px 0;
                font-weight: 600;
                display: flex;
                align-items: center;
            }
            .section-title .icon {
                margin-right: 10px;
                font-size: 24px;
            }
            .lesson-item, .notification-item {
                background-color: #f8f9fa;
                padding: 15px;
                margin-bottom: 12px;
                border-radius: 6px;
                border-left: 4px solid #18BC9C;
            }
            .lesson-title {
                font-weight: 600;
                color: #2C3E50;
                margin: 0 0 5px 0;
                font-size: 15px;
            }
            .lesson-meta {
                font-size: 13px;
                color: #7f8c8d;
                margin: 5px 0 0 0;
            }
            .notification-item {
                border-left-color: #3498DB;
            }
            .notification-title {
                font-weight: 600;
                color: #2C3E50;
                margin: 0 0 5px 0;
                font-size: 14px;
            }
            .notification-content {
                font-size: 13px;
                color: #555;
                margin: 5px 0 0 0;
            }
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #18BC9C 0%, #16A085 100%);
                color: white;
                padding: 14px 32px;
                text-decoration: none;
                border-radius: 25px;
                font-weight: 600;
                margin: 10px 0;
                box-shadow: 0 4px 12px rgba(24,188,156,0.3);
                transition: all 0.3s;
            }
            .cta-section {
                text-align: center;
                padding: 30px;
                background-color: #ecf0f1;
            }
            .footer {
                background-color: #2C3E50;
                color: white;
                padding: 20px 30px;
                text-align: center;
                font-size: 13px;
            }
            .footer a {
                color: #18BC9C;
                text-decoration: none;
            }
            .no-activity {
                text-align: center;
                padding: 40px 30px;
                color: #7f8c8d;
            }
            .no-activity .icon {
                font-size: 64px;
                margin-bottom: 20px;
                opacity: 0.5;
            }
            .badge {
                display: inline-block;
                background-color: #E74C3C;
                color: white;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                margin-left: 8px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Header -->
            <div class="header">
                <img src="cid:logo" alt="RedDinámica Logo">
                <h1>RedDinámica</h1>
                <p>📊 Resumen Mensual de Actividad</p>
                <p style="font-size: 12px; margin-top: 5px;">${period.start} - ${period.end}</p>
            </div>

            <!-- Greeting -->
            <div class="greeting">
                <p>¡Hola <strong>${user.name} ${user.surname}</strong>! 👋</p>
                <p>Te traemos un resumen de toda la actividad en RedDinámica durante el último mes.</p>
            </div>

            <!-- Stats Dashboard -->
            ${hasActivity ? `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${lessons.total}</div>
                    <div class="stat-label">Nuevas Lecciones</div>
                </div>
                <div class="stat-card orange">
                    <div class="stat-number">${notifications.total}</div>
                    <div class="stat-label">Notificaciones</div>
                </div>
                ${platformStats ? `
                <div class="stat-card blue">
                    <div class="stat-number">${platformStats.activeUsers}</div>
                    <div class="stat-label">Usuarios Activos</div>
                </div>
                ` : ''}
            </div>
            ` : ''}

            <!-- Nueva Actividad en Lecciones -->
            ${hasLessons ? `
            <div class="section">
                <h2 class="section-title">
                    <span class="icon">📚</span>
                    Nuevas Lecciones Publicadas
                </h2>
                ${lessons.redDinamica.slice(0, 5).map(lesson => `
                    <div class="lesson-item">
                        <p class="lesson-title">${lesson.title}</p>
                        <p class="lesson-meta">
                            Por: ${lesson.author ? `${lesson.author.name} ${lesson.author.surname}` : 'Anónimo'} 
                            ${lesson.views ? `• ${lesson.views} vistas` : ''}
                        </p>
                    </div>
                `).join('')}
                ${lessons.redDinamica.length > 5 ? `
                    <p style="text-align: center; color: #7f8c8d; font-size: 13px; margin-top: 10px;">
                        Y ${lessons.redDinamica.length - 5} lecciones más...
                    </p>
                ` : ''}
            </div>
            ` : ''}

            <!-- Notificaciones Pendientes -->
            ${hasNotifications ? `
            <div class="section">
                <h2 class="section-title">
                    <span class="icon">🔔</span>
                    Tienes ${notifications.total} notificaciones sin leer
                    ${notifications.total > 20 ? '<span class="badge">+20</span>' : ''}
                </h2>
                ${notifications.comment.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                        <strong style="color: #2C3E50;">💬 Comentarios (${notifications.comment.length})</strong>
                        ${notifications.comment.slice(0, 3).map(notif => `
                            <div class="notification-item">
                                <p class="notification-title">${notif.title}</p>
                                <p class="notification-content">${notif.content}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${notifications.lesson.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                        <strong style="color: #2C3E50;">📖 Lecciones (${notifications.lesson.length})</strong>
                        ${notifications.lesson.slice(0, 3).map(notif => `
                            <div class="notification-item">
                                <p class="notification-title">${notif.title}</p>
                                <p class="notification-content">${notif.content}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${notifications.message.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                        <strong style="color: #2C3E50;">✉️ Mensajes (${notifications.message.length})</strong>
                    </div>
                ` : ''}
                ${notifications.follow.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                        <strong style="color: #2C3E50;">👥 Nuevos Seguidores (${notifications.follow.length})</strong>
                    </div>
                ` : ''}
            </div>
            ` : ''}

            <!-- Sin actividad -->
            ${!hasActivity ? `
            <div class="no-activity">
                <div class="icon">😴</div>
                <h3 style="color: #2C3E50;">No hay actividad reciente</h3>
                <p>¡Este mes ha estado tranquilo! Pero hay mucho por descubrir en RedDinámica.</p>
            </div>
            ` : ''}

            <!-- Call to Action -->
            <div class="cta-section">
                <p style="margin: 0 0 15px 0; color: #2C3E50; font-size: 16px; font-weight: 600;">
                    ${hasActivity ? '¡No te pierdas nada!' : '¡Vuelve a RedDinámica!'}
                </p>
                <a href="${process.env.URL || 'http://localhost:4200'}" class="cta-button">
                    Visitar RedDinámica
                </a>
            </div>

            <!-- Footer -->
            <div class="footer">
                <p style="margin: 0 0 10px 0;">
                    <strong>RedDinámica</strong> - Red Colaborativa de Construcción de Conocimiento
                </p>
                <p style="margin: 0; font-size: 12px; opacity: 0.8;">
                    Recibes este email porque eres parte activa de nuestra comunidad.<br>
                    Si no deseas recibir estos resúmenes mensuales, <a href="${process.env.URL}/configuracion">actualiza tus preferencias</a>.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
};

/**
 * Genera el asunto del email según la actividad
 * @param {Object} digestData - Datos del resumen
 * @returns {String} Asunto del email
 */
exports.generateSubject = function(digestData) {
    const { lessons, notifications } = digestData;
    const hasActivity = lessons.total > 0 || notifications.total > 0;
    
    if (!hasActivity) {
        return '📊 RedDinámica - Resumen Mensual';
    }
    
    const parts = [];
    if (lessons.total > 0) {
        parts.push(`${lessons.total} nueva${lessons.total > 1 ? 's' : ''} lección${lessons.total > 1 ? 'es' : ''}`);
    }
    if (notifications.total > 0) {
        parts.push(`${notifications.total} notificación${notifications.total > 1 ? 'es' : ''}`);
    }
    
    return `🎯 RedDinámica - ${parts.join(' y ')} para ti`;
};

