# Sistema de Resumen Mensual - RedDinámica

## 📋 Descripción

Sistema automatizado de engagement que envía resúmenes mensuales por email a todos los usuarios activos de RedDinámica. El objetivo es mantener a los usuarios informados sobre nueva actividad y reactivar su participación en la plataforma.

## ✨ Características

- **📧 Email Dashboard**: Email visualmente atractivo con resumen de actividad
- **📚 Lecciones Nuevas**: Muestra las lecciones publicadas en el último mes
- **🔔 Notificaciones Pendientes**: Resumen de notificaciones no leídas del usuario
- **📊 Estadísticas**: Dashboard con métricas de la plataforma
- **⏰ Automatización**: Envío automático el día 1 de cada mes a las 9:00 AM
- **🧪 Testing**: Endpoints para probar el sistema antes de producción

## 🏗️ Arquitectura

### Componentes Creados

1. **`services/monthly-digest.service.js`**
   - Servicio principal para recopilar datos
   - Obtiene lecciones del último mes
   - Obtiene notificaciones no leídas por usuario
   - Genera resúmenes individualizados
   - Calcula estadísticas de la plataforma

2. **`services/monthly-digest-email.template.js`**
   - Template HTML responsive para el email
   - Dashboard visual con tarjetas de estadísticas
   - Secciones organizadas por tipo de contenido
   - Branding consistente con RedDinámica

3. **`controllers/cron.controller.js`**
   - Controlador de tareas programadas
   - Gestión del envío masivo de emails
   - Endpoints de prueba y ejecución manual
   - Logging detallado del proceso

4. **`routes/cron.routes.js`**
   - Rutas REST para gestión de cron jobs
   - Protección con autenticación de administrador

## 📅 Programación

### Cron Job Automático

El sistema se ejecuta automáticamente cada mes:
- **Frecuencia**: Día 1 de cada mes
- **Hora**: 9:00 AM
- **Zona horaria**: America/Bogota (configurable)

### Expresión Cron

```bash
# Producción: Día 1 de cada mes a las 9:00 AM
0 9 1 * *

# Testing: Cada 5 minutos (configurar en .env)
*/5 * * * *
```

### Configuración en `.env`

```env
# Opcional: Cambiar expresión cron (por defecto: 0 9 1 * *)
DIGEST_CRON=0 9 1 * *

# Opcional: Zona horaria (por defecto: America/Bogota)
TIMEZONE=America/Bogota

# URL del frontend para links en el email
FRONTEND_URL=http://localhost:4200
```

## 🚀 Uso

### Inicio Automático

El cron job se inicializa automáticamente al arrancar el servidor:

```bash
npm start
```

Verás en la consola:
```
╔════════════════════════════════════════════════════════╗
║      📅 INICIALIZANDO CRON JOB DE RESÚMENES          ║
╚════════════════════════════════════════════════════════╝
[CRON] Expresión: 0 9 1 * *
[CRON] Descripción: Día 1 de cada mes a las 9:00 AM
[CRON] ✓ Cron job inicializado correctamente
```

### Ejecución Manual (Admin)

#### Enviar a Todos los Usuarios

```bash
GET /api/cron/execute-monthly-digest
Authorization: Bearer <ADMIN_TOKEN>
```

**Respuesta:**
```json
{
  "status": "success",
  "message": "Resumen mensual ejecutado correctamente",
  "data": {
    "success": true,
    "sent": 45,
    "failed": 2,
    "total": 47
  }
}
```

#### Enviar a Usuario Específico (Testing)

```bash
POST /api/cron/test-digest/:userId
Authorization: Bearer <ADMIN_TOKEN>
```

**Respuesta:**
```json
{
  "status": "success",
  "message": "Resumen de prueba enviado a usuario@example.com"
}
```

## 📧 Contenido del Email

### Estructura

1. **Header**
   - Logo de RedDinámica
   - Título "Resumen Mensual de Actividad"
   - Período del resumen

2. **Saludo Personalizado**
   - Nombre del usuario
   - Mensaje de bienvenida

3. **Dashboard de Estadísticas**
   - Total de nuevas lecciones
   - Total de notificaciones pendientes
   - Usuarios activos en la plataforma

4. **Nuevas Lecciones Publicadas**
   - Hasta 5 lecciones más recientes
   - Título, autor y vistas
   - Indicador de lecciones adicionales

5. **Notificaciones Pendientes**
   - Agrupadas por tipo (comentarios, lecciones, mensajes, etc.)
   - Hasta 3 notificaciones por categoría
   - Badge indicando cantidad total

6. **Call to Action**
   - Botón prominente "Visitar RedDinámica"
   - Link al frontend

7. **Footer**
   - Información de la plataforma
   - Link a preferencias de usuario

### Ejemplo Visual

```
┌─────────────────────────────────────┐
│  🎓 RedDinámica                     │
│  📊 Resumen Mensual de Actividad    │
└─────────────────────────────────────┘

¡Hola Juan Pérez! 👋

┌─────────┐ ┌─────────┐ ┌─────────┐
│   12    │ │    8    │ │   450   │
│Lecciones│ │Notific. │ │Usuarios │
└─────────┘ └─────────┘ └─────────┘

📚 Nuevas Lecciones Publicadas
├─ Introducción a Dinámica de Sistemas
├─ Modelado con Vensim
└─ ...

🔔 Tienes 8 notificaciones sin leer
├─ 💬 Comentarios (3)
├─ 📖 Lecciones (2)
└─ ✉️ Mensajes (3)

        [Visitar RedDinámica]
```

## 🎨 Personalización

### Modificar Template de Email

Edita `services/monthly-digest-email.template.js`:

```javascript
exports.generateDigestEmail = function(digestData) {
    // Personaliza el HTML aquí
    return `
        <html>
            <!-- Tu diseño personalizado -->
        </html>
    `;
};
```

### Modificar Lógica de Recopilación

Edita `services/monthly-digest.service.js`:

```javascript
exports.getLastMonthLessons = async () => {
    // Personaliza la consulta de lecciones
    // Añade filtros adicionales
    // Cambia el límite de resultados
};
```

### Cambiar Criterios de Envío

En `controllers/cron.controller.js`, función `sendDigestToUser()`:

```javascript
// Descomentar para solo enviar cuando hay actividad:
if (!digestData.hasActivity) {
    console.log(`Sin actividad para ${user.email}, omitiendo envío`);
    return false;
}
```

## 🧪 Testing

### 1. Configurar Modo Testing

```env
# .env
DIGEST_CRON=*/5 * * * *  # Ejecutar cada 5 minutos
```

### 2. Probar con Usuario Específico

```bash
# Obtén el ID de un usuario de prueba
# Ejecuta el endpoint de test
POST /api/cron/test-digest/6123456789abcdef01234567
Authorization: Bearer <ADMIN_TOKEN>
```

### 3. Verificar Logs

El servidor mostrará logs detallados:

```
[DIGEST] Generando resumen para Juan Pérez (juan@example.com)
[DIGEST] ✓ Resumen enviado exitosamente a juan@example.com
[EMAIL] Email enviado: 250 2.0.0 OK
```

### 4. Revisar Email

Verifica tu bandeja de entrada del usuario de prueba.

## 📊 Métricas y Logging

### Logs del Sistema

Cada ejecución genera logs detallados:

```
╔════════════════════════════════════════════════════════╗
║    🚀 INICIANDO ENVÍO DE RESÚMENES MENSUALES          ║
╚════════════════════════════════════════════════════════╝
[DIGEST] Fecha: 1/10/2025, 9:00:00
[DIGEST] Usuarios activos encontrados: 150
[DIGEST] Generando resumen para Usuario 1...
[DIGEST] ✓ Resumen enviado exitosamente
...
╔════════════════════════════════════════════════════════╗
║           📊 RESUMEN DE ENVÍO COMPLETADO              ║
╚════════════════════════════════════════════════════════╝
[DIGEST] ✓ Enviados exitosamente: 145/150
[DIGEST] ✗ Fallidos: 5/150
```

### Información Recopilada

- Total de usuarios activos
- Emails enviados exitosamente
- Emails fallidos
- Tiempo de ejecución
- Errores específicos

## ⚙️ Configuración Avanzada

### Rate Limiting

El sistema incluye un delay de 2 segundos entre emails para no saturar el servidor SMTP:

```javascript
// En cron.controller.js
await new Promise(resolve => setTimeout(resolve, 2000));
```

### Batch Processing

Para grandes volúmenes, considera procesar en lotes:

```javascript
const batchSize = 50;
for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    await Promise.all(batch.map(user => sendDigestToUser(user)));
}
```

### Filtrado de Usuarios

Solo se envían emails a usuarios que cumplen:
- `actived: true`
- Tienen email válido
- Email no vacío

Puedes añadir criterios adicionales en `getActiveUsers()`.

## 🔒 Seguridad

### Autenticación

Todos los endpoints requieren:
- Token JWT válido
- Rol de administrador

### Rate Limiting

Considera añadir rate limiting a los endpoints manuales:

```javascript
const rateLimit = require('express-rate-limit');

const cronLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5 // máximo 5 requests por hora
});

api.get('/execute-monthly-digest', 
    [auth.ensureAuth, cronLimiter], 
    cronController.manualExecuteDigest
);
```

## 🐛 Troubleshooting

### Problema: Cron no se ejecuta

**Solución:**
1. Verifica la expresión cron en `.env`
2. Revisa logs del servidor al iniciar
3. Confirma que la zona horaria es correcta

### Problema: Emails no llegan

**Solución:**
1. Verifica configuración SMTP en `.env`
2. Revisa logs de error de nodemailer
3. Confirma que los usuarios tienen emails válidos
4. Revisa spam/promociones

### Problema: Template se ve mal

**Solución:**
1. Algunos clientes de email bloquean CSS externo
2. Usa estilos inline (ya implementado)
3. Prueba en diferentes clientes (Gmail, Outlook, etc.)

### Problema: Proceso muy lento

**Solución:**
1. Reduce el delay entre emails
2. Implementa batch processing
3. Optimiza consultas a BD (añade índices)
4. Considera usar un servicio de email masivo (SendGrid, etc.)

## 📈 Mejoras Futuras

1. **Dashboard de Administración**
   - Panel visual para ver estadísticas de envío
   - Historial de ejecuciones
   - Gestión de configuración

2. **Preferencias de Usuario**
   - Permitir que usuarios opten por no recibir resúmenes
   - Frecuencia personalizada (semanal/mensual)
   - Tipos de notificaciones a incluir

3. **A/B Testing**
   - Probar diferentes templates
   - Optimizar tasas de apertura
   - Métricas de engagement

4. **Integración con Servicios de Email**
   - SendGrid
   - Mailgun
   - Amazon SES

5. **Analytics**
   - Tasas de apertura
   - Clicks en enlaces
   - Conversión a visitas

## 📚 Referencias

- [node-cron Documentation](https://www.npmjs.com/package/node-cron)
- [Cron Expression Generator](https://crontab.guru/)
- [Nodemailer Documentation](https://nodemailer.com/)
- [Email Template Best Practices](https://litmus.com/blog/best-practices-for-plain-text-emails-a-look-at-why-theyre-important)

## ✅ Checklist de Deployment

- [ ] Configurar `DIGEST_CRON` en `.env` de producción
- [ ] Configurar `FRONTEND_URL` correcta
- [ ] Probar con usuario de prueba
- [ ] Verificar logs de ejecución
- [ ] Confirmar que emails llegan correctamente
- [ ] Revisar template en diferentes clientes de email
- [ ] Documentar proceso para el equipo
- [ ] Configurar alertas de error
- [ ] Establecer respaldo de configuración

## 🎯 Conclusión

El sistema de resumen mensual está completamente implementado y listo para usar. Reactivará a los usuarios mostrándoles contenido relevante y notificaciones pendientes, aumentando el engagement de la plataforma.

**Estado**: ✅ Implementación Completa - Listo para Producción

---

**Versión**: 1.0  
**Fecha**: 1 de Octubre de 2025  
**Responsable**: Equipo de Desarrollo RedDinámica

