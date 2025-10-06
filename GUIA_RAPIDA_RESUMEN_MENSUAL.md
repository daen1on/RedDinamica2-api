# 🚀 Guía Rápida - Sistema de Resumen Mensual

## ¿Qué hace?

Envía automáticamente un email mensual a todos los usuarios con:
- 📚 Lecciones nuevas publicadas en el último mes
- 🔔 Notificaciones pendientes sin leer
- 📊 Estadísticas de la plataforma

## Instalación Rápida

### 1. Ya está instalado ✅

El sistema ya está configurado e integrado. Solo necesitas:

```bash
# El paquete node-cron ya está instalado
npm install
```

### 2. Configurar Variables de Entorno

Añade a tu archivo `.env`:

```env
# Opcional: Cambiar frecuencia de envío
DIGEST_CRON=0 9 1 * *  # Día 1 cada mes a las 9 AM

# Opcional: Zona horaria
TIMEZONE=America/Bogota

# URL del frontend para enlaces
FRONTEND_URL=http://localhost:4200
```

### 3. Iniciar el Servidor

```bash
npm start
```

Verás en consola:
```
╔════════════════════════════════════════════════════════╗
║      📅 INICIALIZANDO CRON JOB DE RESÚMENES          ║
╚════════════════════════════════════════════════════════╝
[CRON] ✓ Cron job inicializado correctamente
```

## Pruebas

### Opción 1: Enviar a un Usuario Específico

```bash
POST http://localhost:3800/api/cron/test-digest/:userId
Authorization: Bearer <TOKEN_ADMIN>
```

### Opción 2: Enviar a Todos (Manual)

```bash
GET http://localhost:3800/api/cron/execute-monthly-digest
Authorization: Bearer <TOKEN_ADMIN>
```

### Opción 3: Testing con Cron Frecuente

En `.env`:
```env
DIGEST_CRON=*/5 * * * *  # Cada 5 minutos
```

Reinicia el servidor y esperará 5 minutos para ejecutar.

## Expresiones Cron Útiles

```bash
*/5 * * * *    # Cada 5 minutos (testing)
0 9 * * *      # Todos los días a las 9 AM
0 9 * * 1      # Todos los lunes a las 9 AM
0 9 1 * *      # Día 1 de cada mes a las 9 AM (RECOMENDADO)
0 9 1 */3 *    # Día 1 cada 3 meses a las 9 AM
```

Usa [crontab.guru](https://crontab.guru/) para generar expresiones personalizadas.

## Archivos Creados

```
RedDinamica2-api/
├── services/
│   ├── monthly-digest.service.js           # Lógica de recopilación
│   └── monthly-digest-email.template.js    # Template HTML del email
├── controllers/
│   └── cron.controller.js                  # Controlador de cron jobs
├── routes/
│   └── cron.routes.js                      # Rutas API
└── SISTEMA_RESUMEN_MENSUAL.md             # Documentación completa
```

## Personalización Rápida

### Cambiar Diseño del Email

Edita `services/monthly-digest-email.template.js`

### Cambiar Datos Recopilados

Edita `services/monthly-digest.service.js`

### Cambiar Frecuencia

Modifica `DIGEST_CRON` en `.env`

## Troubleshooting

### ❌ No se inicializa el cron

- Verifica que el servidor inició correctamente
- Revisa errores en la consola
- Confirma que `DIGEST_CRON` tiene formato válido

### ❌ Emails no llegan

- Verifica configuración de `EMAIL`, `PASSWORD` en `.env`
- Revisa spam/promociones
- Prueba con un solo usuario primero

### ❌ Template se ve mal

- Algunos clientes bloquean CSS
- El template usa inline styles (compatible)
- Prueba en Gmail primero

## Soporte

Para más detalles, consulta `SISTEMA_RESUMEN_MENSUAL.md`

---

**¡Listo!** El sistema está funcionando automáticamente. 🎉

