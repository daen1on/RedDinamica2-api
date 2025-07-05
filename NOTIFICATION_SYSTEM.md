# Sistema de Notificaciones - RedDinámica API

## Descripción General

El sistema de notificaciones permite a los usuarios recibir alertas sobre actividades relevantes en la plataforma, como nuevos mensajes, lecciones, publicaciones, comentarios, seguidores y recursos.

## Arquitectura

### Componentes

1. **Modelo (notification.model.js)**: Define la estructura de datos de las notificaciones
2. **Controlador (notification.controller.js)**: Maneja las operaciones CRUD de notificaciones
3. **Rutas (notification.routes.js)**: Define los endpoints de la API
4. **Servicio (notification.service.js)**: Funciones auxiliares para crear notificaciones específicas
5. **Middleware (notification.middleware.js)**: Automatiza la creación de notificaciones

## Modelo de Datos

```javascript
{
  user: ObjectId,           // Usuario que recibe la notificación
  type: String,             // Tipo: 'message', 'lesson', 'publication', 'comment', 'follow', 'resource', 'system'
  title: String,            // Título de la notificación
  content: String,          // Contenido descriptivo
  link: String,             // URL relacionada (opcional)
  relatedId: ObjectId,      // ID del objeto relacionado (opcional)
  relatedModel: String,     // Nombre del modelo relacionado (opcional)
  from: ObjectId,           // Usuario que generó la notificación (opcional)
  read: Boolean,            // Estado de lectura (default: false)
  priority: String,         // Prioridad: 'low', 'medium', 'high' (default: 'medium')
  created_at: Date,         // Fecha de creación
  read_at: Date             // Fecha de lectura (opcional)
}
```

## Endpoints de la API

### GET /api/notifications
Obtiene las notificaciones del usuario autenticado con paginación y filtros.

**Parámetros de consulta:**
- `page`: Número de página (default: 1)
- `limit`: Elementos por página (default: 10)
- `unread`: Solo no leídas (true/false)
- `type`: Filtrar por tipo de notificación

**Respuesta:**
```json
{
  "notifications": [...],
  "pagination": {
    "current": 1,
    "total": 5,
    "count": 10,
    "totalItems": 45
  },
  "unreadCount": 12
}
```

### GET /api/notifications/unread-count
Obtiene el conteo de notificaciones no leídas.

**Respuesta:**
```json
{
  "unreadCount": 5
}
```

### PUT /api/notifications/:id/read
Marca una notificación específica como leída.

### PUT /api/notifications/mark-all-read
Marca todas las notificaciones del usuario como leídas.

### DELETE /api/notifications/:id
Elimina una notificación específica.

## Servicio de Notificaciones

El `NotificationService` proporciona métodos estáticos para crear diferentes tipos de notificaciones:

### Métodos Disponibles

1. **createMessageNotification(fromUser, toUser, messageId)**
   - Notifica sobre un nuevo mensaje privado

2. **createLessonNotification(fromUser, toUsers, lessonId, lessonTitle)**
   - Notifica a seguidores sobre una nueva lección

3. **createPublicationNotification(fromUser, toUsers, publicationId, publicationTitle)**
   - Notifica a seguidores sobre una nueva publicación

4. **createCommentNotification(fromUser, toUser, commentId, resourceTitle)**
   - Notifica sobre un nuevo comentario en un recurso

5. **createFollowNotification(fromUser, toUser)**
   - Notifica sobre un nuevo seguidor

6. **createResourceNotification(fromUser, toUsers, resourceId, resourceTitle)**
   - Notifica a seguidores sobre un nuevo recurso

7. **createSystemNotification(toUsers, title, content, link, priority)**
   - Crea notificaciones del sistema para múltiples usuarios

### Métodos de Utilidad

- **cleanOldNotifications()**: Elimina notificaciones leídas de más de 30 días
- **getNotificationStats(userId)**: Obtiene estadísticas de notificaciones por tipo

## Middleware de Notificaciones

El middleware automatiza la creación de notificaciones cuando ocurren ciertas acciones:

- `notifyNewMessage`: Se ejecuta al crear un mensaje
- `notifyNewLesson`: Se ejecuta al crear una lección
- `notifyNewPublication`: Se ejecuta al crear una publicación
- `notifyNewFollow`: Se ejecuta al seguir a un usuario
- `notifyNewResource`: Se ejecuta al crear un recurso

## Uso en Otros Controladores

### Ejemplo: Crear notificación manual
```javascript
const NotificationService = require('../services/notification.service');

// En un controlador
try {
  await NotificationService.createMessageNotification(
    req.user,           // Usuario que envía
    receiverId,         // Usuario que recibe
    message._id         // ID del mensaje
  );
} catch (err) {
  console.error('Error creating notification:', err);
}
```

### Ejemplo: Usar middleware
```javascript
// En las rutas
const NotificationMiddleware = require('../middlewares/notification.middleware');

router.post('/messages', 
  authMiddleware.ensureAuth,
  NotificationMiddleware.notifyNewMessage,  // Middleware de notificación
  messageController.saveMessage
);
```

## Tipos de Notificaciones

1. **message**: Nuevos mensajes privados
2. **lesson**: Nuevas lecciones de usuarios seguidos
3. **publication**: Nuevas publicaciones de usuarios seguidos
4. **comment**: Nuevos comentarios en recursos propios
5. **follow**: Nuevos seguidores
6. **resource**: Nuevos recursos de usuarios seguidos
7. **system**: Notificaciones administrativas del sistema

## Prioridades

- **high**: Notificaciones críticas del sistema
- **medium**: Mensajes, lecciones, recursos (default)
- **low**: Publicaciones, comentarios, seguidores

## Optimizaciones

1. **Índices de base de datos** para consultas eficientes
2. **Paginación** para manejar grandes volúmenes
3. **Limpieza automática** de notificaciones antiguas
4. **Procesamiento asíncrono** para no bloquear respuestas
5. **Agregación** para estadísticas eficientes

## Consideraciones de Rendimiento

- Las notificaciones se crean de forma asíncrona para no afectar la respuesta principal
- Se implementan índices en MongoDB para consultas rápidas
- El sistema incluye limpieza automática de notificaciones antiguas
- Se usa agregación de MongoDB para estadísticas eficientes

## Próximas Mejoras

1. **Notificaciones push** en tiempo real con WebSockets
2. **Plantillas de notificación** personalizables
3. **Preferencias de usuario** para tipos de notificaciones
4. **Digest de notificaciones** por email
5. **Notificaciones push móviles** 