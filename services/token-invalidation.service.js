'use strict';

// Set para almacenar tokens invalidados (en producción usar Redis)
const invalidatedTokens = new Set();

// Map para almacenar timestamps de cuando los usuarios fueron actualizados
const userUpdateTimestamps = new Map();

class TokenInvalidationService {
    
    // Invalidar token específico
    static invalidateToken(token) {
        invalidatedTokens.add(token);
        console.log('Token invalidated:', token.substring(0, 20) + '...');
    }
    
    // Verificar si un token está invalidado
    static isTokenInvalidated(token) {
        return invalidatedTokens.has(token);
    }
    
    // Marcar que un usuario fue actualizado (para invalidar todos sus tokens)
    static markUserAsUpdated(userId) {
        const timestamp = Date.now();
        userUpdateTimestamps.set(userId, timestamp);
        console.log(`User ${userId} marked as updated at ${timestamp}`);
        return timestamp;
    }
    
    // Verificar si el token es anterior a la última actualización del usuario
    static isTokenOutdated(userId, tokenIssuedAt) {
        const userUpdateTime = userUpdateTimestamps.get(userId);
        if (!userUpdateTime) {
            return false; // Usuario nunca fue actualizado
        }
        
        // Convertir tokenIssuedAt a milliseconds si está en seconds
        const tokenTime = tokenIssuedAt * 1000;
        return tokenTime < userUpdateTime;
    }
    
    // Limpiar tokens invalidados antiguos (ejecutar periódicamente)
    static cleanupInvalidatedTokens() {
        // En un entorno real, esto se haría con expiración automática en Redis
        // Por ahora, limpiar tokens después de 24 horas
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        
        for (const [userId, timestamp] of userUpdateTimestamps.entries()) {
            if (timestamp < oneDayAgo) {
                userUpdateTimestamps.delete(userId);
            }
        }
        
        console.log('Token cleanup completed');
    }
    
    // Obtener estadísticas
    static getStats() {
        return {
            invalidatedTokensCount: invalidatedTokens.size,
            updatedUsersCount: userUpdateTimestamps.size,
            updatedUsers: Array.from(userUpdateTimestamps.entries())
        };
    }
}

// Limpiar tokens cada hora
setInterval(() => {
    TokenInvalidationService.cleanupInvalidatedTokens();
}, 60 * 60 * 1000);

module.exports = TokenInvalidationService; 