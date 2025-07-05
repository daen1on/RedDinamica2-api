# API de Likes y Comentarios Anidados - RedDinámica

## Resumen

Esta documentación describe los nuevos endpoints implementados para el sistema de likes en publicaciones y comentarios, así como el sistema de respuestas anidadas (hilos de conversación).

## Endpoints de Publicaciones

### 1. Toggle Like en Publicación

**POST** `/publication-like/:id`

Permite dar o quitar like a una publicación específica.

#### Parámetros
- `id` (URL): ID de la publicación

#### Headers
- `Authorization`: Token JWT del usuario autenticado

#### Respuesta Exitosa (200)
```json
{
  "message": "Publication liked successfully",
  "action": "liked",
  "likesCount": 5,
  "publication": {
    "_id": "publicationId",
    "likes": ["userId1", "userId2"],
    "likesCount": 5
  }
}
```

#### Respuesta de Error (404)
```json
{
  "message": "Publication not found"
}
```

### 2. Obtener Likes de Publicación

**GET** `/publication-likes/:id`

Obtiene la lista de usuarios que dieron like a una publicación.

#### Parámetros
- `id` (URL): ID de la publicación

#### Headers
- `Authorization`: Token JWT del usuario autenticado

#### Respuesta Exitosa (200)
```json
{
  "likes": [
    {
      "_id": "userId1",
      "name": "Juan",
      "surname": "Pérez",
      "picture": "avatar.jpg"
    }
  ],
  "likesCount": 1
}
```

## Endpoints de Comentarios

### 3. Toggle Like en Comentario

**POST** `/comment-like/:id`

Permite dar o quitar like a un comentario específico.

#### Parámetros
- `id` (URL): ID del comentario

#### Headers
- `Authorization`: Token JWT del usuario autenticado

#### Respuesta Exitosa (200)
```json
{
  "message": "Comment liked successfully",
  "action": "liked",
  "likesCount": 3,
  "comment": {
    "_id": "commentId",
    "likes": ["userId1", "userId2"],
    "likesCount": 3
  }
}
```

### 4. Obtener Likes de Comentario

**GET** `/comment-likes/:id`

Obtiene la lista de usuarios que dieron like a un comentario.

#### Parámetros
- `id` (URL): ID del comentario

#### Headers
- `Authorization`: Token JWT del usuario autenticado

#### Respuesta Exitosa (200)
```json
{
  "likes": [
    {
      "_id": "userId1",
      "name": "María",
      "surname": "García",
      "picture": "avatar2.jpg"
    }
  ],
  "likesCount": 1
}
```

### 5. Agregar Respuesta a Comentario

**POST** `/comment/:id/reply`

Crea una respuesta anidada a un comentario existente.

#### Parámetros
- `id` (URL): ID del comentario padre

#### Headers
- `Authorization`: Token JWT del usuario autenticado

#### Body
```json
{
  "text": "Esta es mi respuesta al comentario",
  "publication": "publicationId"
}
```

#### Respuesta Exitosa (200)
```json
{
  "reply": {
    "_id": "replyId",
    "text": "Esta es mi respuesta al comentario",
    "user": {
      "_id": "userId",
      "name": "Carlos",
      "surname": "López",
      "picture": "avatar3.jpg"
    },
    "created_at": "1640995200",
    "parentId": "parentCommentId",
    "likes": [],
    "likesCount": 0
  },
  "message": "Reply added successfully"
}
```

### 6. Obtener Respuestas de Comentario

**GET** `/comment/:id/replies`

Obtiene todas las respuestas anidadas de un comentario.

#### Parámetros
- `id` (URL): ID del comentario padre

#### Headers
- `Authorization`: Token JWT del usuario autenticado

#### Respuesta Exitosa (200)
```json
{
  "replies": [
    {
      "_id": "replyId1",
      "text": "Primera respuesta",
      "user": {
        "_id": "userId1",
        "name": "Ana",
        "surname": "Martín",
        "picture": "avatar4.jpg"
      },
      "created_at": "1640995200",
      "likes": [],
      "likesCount": 0
    }
  ]
}
```

## Modificaciones en Modelos

### Modelo Publication
```javascript
{
  text: String,
  user: {type: ObjectId, ref: 'User'},
  created_at: String,
  comments: [{type: ObjectId, ref: 'Comment'}],
  file: String,
  likes: [{type: ObjectId, ref: 'User'}],        // NUEVO
  likesCount: {type: Number, default: 0}         // NUEVO
}
```

### Modelo Comment
```javascript
{
  created_at: String,
  user: {type: ObjectId, ref: 'User'},
  text: String,
  score: {type: Number, default: 0},
  likes: [{type: ObjectId, ref: 'User'}],        // NUEVO
  likesCount: {type: Number, default: 0},        // NUEVO
  replies: [{type: ObjectId, ref: 'Comment'}],   // NUEVO
  parentId: {type: ObjectId, ref: 'Comment'},    // NUEVO
  publication: {type: ObjectId, ref: 'Publication'} // NUEVO
}
```

## Funcionalidades Implementadas

### Sistema de Likes
- **Toggle automático**: Un mismo endpoint maneja dar y quitar likes
- **Prevención de duplicados**: Un usuario no puede dar like múltiples veces
- **Contadores automáticos**: Se actualiza automáticamente el campo `likesCount`
- **Populate de usuarios**: Los endpoints de consulta incluyen información completa de usuarios

### Sistema de Respuestas Anidadas
- **Jerarquía de comentarios**: Comentarios principales y respuestas
- **Referencias bidireccionales**: `parentId` en respuestas y array `replies` en comentarios padre
- **Populate automático**: Las consultas incluyen respuestas con datos de usuarios
- **Notificaciones**: Se crean notificaciones automáticas al responder comentarios

### Mejoras en Consultas Existentes
- **getPublications**: Ahora incluye likes y respuestas anidadas
- **getUserPublications**: Incluye toda la información de interacciones sociales
- **Populate completo**: Todas las consultas incluyen usuarios, likes y respuestas

## Casos de Uso

### 1. Usuario da like a una publicación
```
POST /publication-like/507f1f77bcf86cd799439011
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Response: {"action": "liked", "likesCount": 6}
```

### 2. Usuario responde a un comentario
```
POST /comment/507f1f77bcf86cd799439012/reply
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Body: {
  "text": "Estoy de acuerdo con tu punto de vista",
  "publication": "507f1f77bcf86cd799439011"
}

Response: {reply: {...}, message: "Reply added successfully"}
```

### 3. Obtener publicaciones con likes y respuestas
```
GET /user-publications/507f1f77bcf86cd799439010/1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Response: {
  publications: [
    {
      _id: "...",
      text: "Mi publicación",
      likes: [{name: "Juan", surname: "Pérez"}],
      likesCount: 1,
      comments: [
        {
          text: "Comentario principal",
          likes: [],
          replies: [
            {
              text: "Respuesta anidada",
              user: {name: "María"}
            }
          ]
        }
      ]
    }
  ]
}
```

## Códigos de Error

- **200**: Operación exitosa
- **404**: Recurso no encontrado (publicación o comentario)
- **401**: Token de autenticación inválido
- **500**: Error interno del servidor

## Notas de Implementación

1. **Autenticación requerida**: Todos los endpoints requieren token JWT válido
2. **Validación de existencia**: Se verifica que publicaciones y comentarios existan antes de operar
3. **Atomicidad**: Las operaciones de like/unlike son atómicas
4. **Notificaciones**: Se generan notificaciones automáticas para respuestas
5. **Performance**: Las consultas usan populate eficiente para minimizar queries a BD

## Próximas Mejoras

- [ ] Paginación de respuestas para comentarios con muchas respuestas
- [ ] Límites de profundidad para respuestas anidadas
- [ ] Cache de contadores de likes para mejor performance
- [ ] Endpoint para obtener usuarios que dieron like (con paginación)
- [ ] Métricas de engagement por publicación 