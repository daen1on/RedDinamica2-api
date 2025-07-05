# Interacciones de Notificaciones - RedDinámica API

## Descripción General

Este documento describe las interacciones específicas implementadas en el sistema de notificaciones para diferentes eventos de la plataforma.

## Interacciones Implementadas

### 1. Comentarios en Publicaciones

**Trigger**: Cuando un usuario comenta en una publicación
**Controlador**: `comment.controller.js` - función `saveComment`
**Notificación**: Se envía al autor de la publicación (si no es el mismo que comenta)

```javascript
// Endpoint: POST /api/comment
// Body: { text: "comentario", publicationId: "id_publicacion" }
```

**Resultado**:
- Título: "Nuevo comentario en tu publicación"
- Contenido: "[Usuario] comentó: [primeros 50 caracteres]..."
- Link: `/publications/[publicationId]`
- Prioridad: medium

### 2. Mensajes en Lecciones

**Trigger**: Cuando un usuario envía un mensaje en una lección
**Controlador**: `lesson.controller.js` - función `addLessonMessage`
**Notificación**: Se envía a todos los participantes de la lección (excepto el autor del mensaje)

```javascript
// Endpoint: POST /api/lesson/:id/message
// Body: { text: "mensaje", conversationTitle: "General" }
```

**Participantes incluidos**:
- Autor de la lección
- Líder de la lección
- Experto asignado
- Miembros del grupo de desarrollo

**Resultado**:
- Título: "Nuevo mensaje en lección"
- Contenido: "[Usuario] escribió en [título lección]: [primeros 50 caracteres]..."
- Link: `/lessons/[lessonId]`
- Prioridad: medium

### 3. Cambios de Estado en Lecciones

**Trigger**: Cuando se cambia el estado de una lección
**Controlador**: `lesson.controller.js` - función `changeLessonState`
**Notificación**: Se envía a todos los participantes de la lección

```javascript
// Endpoint: PUT /api/lesson/:id/state
// Body: { state: "nuevo_estado", reason: "motivo opcional" }
```

**Estados soportados**:
- `pending`: pendiente de revisión
- `in_progress`: en progreso
- `completed`: completada
- `cancelled`: cancelada
- `approved`: aprobada
- `rejected`: rechazada

**Resultado**:
- Título: "Cambio de estado en lección"
- Contenido: "La lección [título] cambió de [estado anterior] a [estado nuevo]"
- Link: `/lessons/[lessonId]`
- Prioridad: high

### 4. Nuevos Seguidores

**Trigger**: Cuando un usuario sigue a otro
**Controlador**: `follow.controller.js` - función `saveFollow`
**Notificación**: Se envía al usuario que es seguido

```javascript
// Endpoint: POST /api/follow
// Body: { followed: "id_usuario_a_seguir" }
```

**Resultado**:
- Título: "Nuevo seguidor"
- Contenido: "[Usuario] ha comenzado a seguirte"
- Link: `/profile/[fromUserId]`
- Prioridad: low

### 5. Nuevas Convocatorias

**Trigger**: Cuando se crea una convocatoria para una lección
**Controlador**: `lesson.controller.js` - función `createCall`
**Notificación**: Se envía a usuarios interesados en la convocatoria

```javascript
// Endpoint: POST /api/lesson/:id/call
// Body: { text: "descripción convocatoria", visible: true }
```

**Resultado**:
- Título: "Nueva convocatoria disponible"
- Contenido: "[Usuario] ha creado una convocatoria para [título lección]: [primeros 100 caracteres]..."
- Link: `/lessons/[lessonId]`
- Prioridad: high

### 6. Recursos Aprobados

**Trigger**: Cuando un administrador aprueba un recurso sugerido
**Controlador**: `resource.controller.js` - función `approveResource`
**Notificación**: Se envía al autor del recurso

```javascript
// Endpoint: PUT /api/resource/:id/approve
```

**Resultado**:
- Título: "¡Tu recurso fue aprobado!"
- Contenido: "Tu recurso [nombre] ha sido aprobado y ahora está visible en la red"
- Link: `/resources/[resourceId]`
- Prioridad: high

### 7. Recursos Rechazados

**Trigger**: Cuando un administrador rechaza un recurso sugerido
**Controlador**: `resource.controller.js` - función `rejectResource`
**Notificación**: Se envía al autor del recurso

```javascript
// Endpoint: PUT /api/resource/:id/reject
// Body: { reason: "motivo del rechazo" }
```

**Resultado**:
- Título: "Tu recurso necesita revisión"
- Contenido: "Tu recurso [nombre] necesita ser revisado: [motivo]"
- Link: `/resources/[resourceId]`
- Prioridad: high

## Flujo de Navegación

### Desde las Notificaciones

1. **Comentarios en publicaciones**: 
   - Click → Navega a `/publications/[id]`
   - Muestra la publicación con todos los comentarios

2. **Mensajes en lecciones**: 
   - Click → Navega a `/lessons/[id]`
   - Abre la lección en la sección de conversaciones

3. **Cambios de estado**: 
   - Click → Navega a `/lessons/[id]`
   - Muestra el estado actual de la lección

4. **Nuevos seguidores**: 
   - Click → Navega a `/profile/[userId]`
   - Muestra el perfil del usuario que siguió

5. **Convocatorias**: 
   - Click → Navega a `/lessons/[id]`
   - Muestra la lección con la convocatoria activa

6. **Recursos aprobados/rechazados**: 
   - Click → Navega a `/resources/[id]`
   - Muestra el recurso con su estado actual

## Configuración de Prioridades

- **High**: Cambios de estado, convocatorias, aprobación/rechazo de recursos
- **Medium**: Mensajes en lecciones, comentarios en publicaciones
- **Low**: Nuevos seguidores

## Filtros Aplicados

- **Auto-exclusión**: Los usuarios no reciben notificaciones de sus propias acciones
- **Verificación de existencia**: Se verifica que el objeto relacionado existe antes de crear la notificación
- **Participantes únicos**: En lecciones, se evitan notificaciones duplicadas a los mismos usuarios

## Manejo de Errores

Todas las notificaciones se crean de forma asíncrona usando `.catch()` para evitar que errores en el sistema de notificaciones afecten la funcionalidad principal:

```javascript
await NotificationService.createNotification(...)
    .catch(err => console.error('Error creating notification:', err));
```

## Testing de Endpoints

### Comentarios en Publicaciones
```bash
curl -X POST http://localhost:3800/api/comment \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{"text": "Gran publicación!", "publicationId": "60d5ec49f1b2c8b1f8e4e1a1"}'
```

### Mensajes en Lecciones
```bash
curl -X POST http://localhost:3800/api/lesson/60d5ec49f1b2c8b1f8e4e1a1/message \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{"text": "¿Cuándo empezamos?", "conversationTitle": "General"}'
```

### Cambio de Estado
```bash
curl -X PUT http://localhost:3800/api/lesson/60d5ec49f1b2c8b1f8e4e1a1/state \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{"state": "in_progress", "reason": "Iniciando desarrollo"}'
```

### Aprobar Recurso
```bash
curl -X PUT http://localhost:3800/api/resource/60d5ec49f1b2c8b1f8e4e1a1/approve \
  -H "Authorization: Bearer [token]"
```

## Consideraciones de Rendimiento

1. **Procesamiento asíncrono**: Las notificaciones no bloquean las respuestas principales
2. **Filtrado eficiente**: Se evitan consultas innecesarias verificando condiciones antes de crear notificaciones
3. **Populate selectivo**: Solo se cargan los campos necesarios de usuarios relacionados
4. **Batch inserts**: Para notificaciones múltiples se usa `insertMany()`

## Próximas Mejoras

1. **Notificaciones en tiempo real**: Implementar WebSockets para notificaciones instantáneas
2. **Preferencias de usuario**: Permitir que usuarios configuren qué notificaciones recibir
3. **Digest de notificaciones**: Agrupar notificaciones similares
4. **Notificaciones push**: Implementar notificaciones del navegador 