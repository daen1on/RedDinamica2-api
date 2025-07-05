# Sistema de Invalidación de Tokens - RedDinámica

## **Problema Resuelto**

Cuando un administrador aprueba o actualiza un usuario, el usuario necesitaba hacer logout y login nuevamente para ver los cambios. Esto se debía a que el token JWT contenía información desactualizada.

## **Solución Implementada**

### **1. Servicio de Invalidación de Tokens**
- **Archivo**: `services/token-invalidation.service.js`
- **Funcionalidad**: Gestiona tokens invalidados y usuarios actualizados
- **Características**:
  - Invalidación de tokens específicos
  - Marcado de usuarios como actualizados
  - Verificación de tokens desactualizados
  - Limpieza automática cada hora

### **2. Middleware de Autenticación Mejorado**
- **Archivo**: `middlewares/auth.middleware.js`
- **Nuevas Validaciones**:
  - Tokens específicamente invalidados
  - Tokens anteriores a actualizaciones de usuario
  - Mensajes específicos por tipo de invalidación

### **3. Controlador de Usuarios Actualizado**
- **Archivo**: `controllers/user.controller.js`
- **Funciones Agregadas**:
  - `forceUserLogout()`: Fuerza logout de usuario específico
  - `getTokenStats()`: Estadísticas de tokens invalidados
- **Funciones Modificadas**:
  - `updateUser()`: Invalida tokens automáticamente cuando admin actualiza usuario

### **4. Rutas Nuevas**
- **Archivo**: `routes/user.routes.js`
- `POST /api/force-logout/:id`: Fuerza logout de usuario (solo admins)
- `GET /api/token-stats`: Estadísticas de tokens (solo admins)

### **5. Frontend Actualizado**
- **Archivo**: `AuthInterceptor.ts`
- **Mejoras**:
  - Mensajes específicos para tokens invalidados
  - Diferenciación entre expiración y invalidación
- **Archivo**: `user.service.ts`
- **Función Agregada**: `forceUserLogout()` para llamar API

## **Flujo de Funcionamiento**

### **Cuando Admin Actualiza Usuario:**
1. Admin llama `PUT /api/user-update/:id`
2. Controlador actualiza usuario en BD
3. Si es admin actualizando otro usuario → `TokenInvalidationService.markUserAsUpdated()`
4. Se almacena timestamp de actualización

### **Cuando Usuario Hace Request:**
1. Middleware `ensureAuth` verifica token
2. Verifica si token específico está invalidado
3. Verifica si token es anterior a última actualización de usuario
4. Si cualquier validación falla → 401 con código específico

### **Cuando Frontend Recibe 401:**
1. `AuthInterceptor` detecta error 401
2. Verifica código de error (`TOKEN_INVALIDATED`, `TOKEN_OUTDATED`)
3. Muestra mensaje específico al usuario
4. Redirige a login

## **Códigos de Error**

| Código | Descripción | Mensaje |
|--------|-------------|---------|
| `TOKEN_INVALIDATED` | Token específicamente invalidado | "Su cuenta fue actualizada por un administrador" |
| `TOKEN_OUTDATED` | Token anterior a actualización | "Su cuenta fue actualizada. Inicie sesión para ver cambios" |
| Sin código | Token expirado normalmente | "La sesión ha expirado" |

## **Endpoints de Administración**

### **Forzar Logout de Usuario**
```http
POST /api/force-logout/:id
Authorization: Bearer <admin_token>
```

**Respuesta:**
```json
{
  "message": "User has been logged out successfully",
  "userId": "user_id"
}
```

### **Estadísticas de Tokens**
```http
GET /api/token-stats
Authorization: Bearer <admin_token>
```

**Respuesta:**
```json
{
  "invalidatedTokensCount": 5,
  "updatedUsersCount": 3,
  "updatedUsers": [
    ["user_id_1", 1640995200000],
    ["user_id_2", 1640995300000]
  ]
}
```

## **Uso en Frontend**

### **Forzar Logout de Usuario**
```typescript
// En componente de administración
this.userService.forceUserLogout(userId).subscribe(
  response => {
    console.log('Usuario deslogueado:', response);
  },
  error => {
    console.error('Error:', error);
  }
);
```

## **Consideraciones de Producción**

### **Escalabilidad**
- **Actual**: Almacenamiento en memoria (Map/Set)
- **Recomendado para producción**: Redis con expiración automática
- **Migración**: Cambiar implementación en `TokenInvalidationService`

### **Seguridad**
- Solo admins pueden invalidar tokens
- Tokens se invalidan automáticamente al actualizar usuarios
- Limpieza automática previene acumulación de datos

### **Rendimiento**
- Verificaciones O(1) con Map/Set
- Limpieza automática cada hora
- Sin impacto significativo en requests normales

## **Configuración**

### **Variables de Entorno**
```env
SECRET_KEY=your_jwt_secret_key
```

### **Intervalos de Limpieza**
- **Actual**: 1 hora (3600000 ms)
- **Configurable**: Modificar en `token-invalidation.service.js`

## **Monitoreo**

### **Logs Importantes**
- `Token invalidated: xxx...` - Token específico invalidado
- `User {id} marked as updated at {timestamp}` - Usuario marcado como actualizado
- `Admin {id} updated user {id}. Tokens invalidated.` - Admin actualizó usuario
- `Token cleanup completed` - Limpieza automática ejecutada

### **Métricas Recomendadas**
- Número de tokens invalidados por hora
- Usuarios actualizados por admins
- Frecuencia de invalidaciones

## **Troubleshooting**

### **Usuario No Ve Cambios Después de Actualización**
1. Verificar logs de invalidación
2. Verificar que middleware esté aplicado
3. Verificar respuesta 401 en frontend
4. Verificar redirección a login

### **Demasiadas Invalidaciones**
1. Revisar logs de `getTokenStats`
2. Verificar que limpieza automática funcione
3. Considerar reducir tiempo de limpieza

### **Problemas de Rendimiento**
1. Verificar tamaño de Map/Set en memoria
2. Considerar migración a Redis
3. Ajustar intervalo de limpieza 