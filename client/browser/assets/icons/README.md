# Iconos para PWA - RedDinámica

Este directorio debe contener los iconos necesarios para el Web App Manifest.

## Iconos Requeridos

Para que la aplicación funcione correctamente como PWA, necesitas generar los siguientes iconos:

### Iconos Principales
- `icon-72x72.png` (72x72px)
- `icon-96x96.png` (96x96px)
- `icon-128x128.png` (128x128px)
- `icon-144x144.png` (144x144px)
- `icon-152x152.png` (152x152px)
- `icon-192x192.png` (192x192px)
- `icon-384x384.png` (384x384px)
- `icon-512x512.png` (512x512px)

### Iconos para Shortcuts (Opcional)
- `academia-96x96.png` (96x96px)
- `feed-96x96.png` (96x96px)
- `profile-96x96.png` (96x96px)
- `resources-96x96.png` (96x96px)

## Cómo Generar los Iconos.
### Usando Node.js se lanzó el siguiente codigo:
```bash
npm install -g pwa-asset-generator
pwa-asset-generator logo.png assets/icons --manifest manifest.json
```

## Recomendaciones de Diseño

- **Formato**: PNG con transparencia
- **Estilo**: Simple y reconocible
- **Colores**: Consistente con la identidad de RedDinámica
- **Legibilidad**: Debe verse bien en tamaños pequeños
- **Maskable**: Considera crear versiones "maskable" para Android

## Actualizar el Manifest

Si se cambia los nombres o tamaños de los iconos, hay que actualizar el archivo `manifest.json` en la raíz del proyecto.
