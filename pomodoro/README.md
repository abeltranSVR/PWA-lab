# 🍅 Pomodoro Focus Tracker — PWA

Temporizador Pomodoro con registro de sesiones, estadísticas y modo offline completo.

## Características

- **Temporizador configurable**: trabajo, descanso corto y descanso largo
- **Ciclos automáticos**: 4 pomodoros → descanso largo
- **Notificaciones push**: funcionan con pantalla apagada (Android)
- **Registro de sesiones**: etiqueta, descripción, timestamps
- **Estadísticas**: pomodoros por día, racha, horas totales, gráfico semanal
- **Exportar CSV**: historial completo con descripciones
- **100% offline**: funciona sin conexión después de la primera carga
- **IndexedDB**: almacenamiento robusto para grandes volúmenes de historial

## Archivos

```
├── index.html      → Shell principal de la app
├── styles.css      → Estilos mobile-first
├── app.js          → Lógica del temporizador, IndexedDB, historial
├── sw.js           → Service Worker (cache offline + notificaciones)
├── manifest.json   → Manifiesto PWA (íconos, colores, display)
├── icon-192.png    → Ícono 192x192
└── icon-512.png    → Ícono 512x512
```

## Cómo desplegar

### Opción 1: GitHub Pages

1. Crea un repositorio en GitHub
2. Sube todos los archivos a la rama `main`
3. Ve a Settings → Pages → Source: `main` / `/ (root)`
4. Tu app estará en `https://tu-usuario.github.io/tu-repo/`

### Opción 2: Netlify

1. Arrastra la carpeta completa a [app.netlify.com/drop](https://app.netlify.com/drop)
2. Listo. Netlify genera un URL con HTTPS automáticamente.

### Opción 3: Servidor local (para probar)

```bash
# Con Python
python3 -m http.server 8080

# Con Node.js
npx serve .
```

> ⚠️ **HTTPS es obligatorio** para que funcionen el Service Worker y las notificaciones.
> En `localhost` funciona sin HTTPS, pero en producción necesitas un certificado SSL.

## Cómo instalar en Android desde Chrome

1. Abre la URL de tu app en **Chrome para Android**
2. Espera unos segundos — Chrome detectará que es una PWA
3. Verás un banner "Añadir a pantalla de inicio" en la parte inferior
4. Si no aparece el banner:
   - Toca el menú **⋮** (tres puntos) arriba a la derecha
   - Selecciona **"Instalar app"** o **"Añadir a pantalla de inicio"**
5. La app se instalará como cualquier app nativa con su propio ícono

### Permisos necesarios

- **Notificaciones**: Chrome pedirá permiso la primera vez que inicies un pomodoro
- **Aceptar** para recibir alertas cuando termine cada ciclo (funciona con pantalla apagada)

## Estructura del código (para aprendizaje)

### `manifest.json`
Define la identidad de la PWA: nombre, colores, íconos y modo de display.
Chrome lo lee para ofrecer la instalación y para configurar la app standalone.

### `sw.js` (Service Worker)
Hilo separado del navegador que intercepta peticiones de red.
- **Install**: pre-cachea el "app shell" (todos los archivos)
- **Fetch**: estrategia cache-first (responde del cache, cae a red si no existe)
- **Notifications**: recibe mensajes del hilo principal y muestra notificaciones del sistema

### `app.js`
- **IndexedDB**: base de datos local con stores para sesiones y configuración
- **Timer Engine**: usa `Date.now()` para manejar drift del `setInterval`
- **Canvas Chart**: gráfico de barras semanal dibujado con Canvas 2D API

### `styles.css`
- CSS custom properties para theming consistente
- Mobile-first con `env(safe-area-inset-*)` para notched devices
- Animaciones CSS para transiciones suaves
