# Finanzas PWA — Servidor Local

## Estructura de archivos

```
finanzas/
├── server.js              ← servidor Node.js (sin dependencias externas)
├── finanzas-data.json     ← fuente de verdad (editá este archivo)
├── finanzas.html          ← la app
├── manifest.json          ← metadata de PWA
├── sw.js                  ← service worker (offline)
└── README.md
```

---

## Uso rápido

```bash
# Desde la carpeta del proyecto:
node server.js

# Luego abrir en el navegador:
# http://localhost:3000
```

---

## Primera vez: configurar íconos (opcional)

Para que la PWA se instale correctamente necesitás dos íconos PNG:
- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

Podés generarlos con cualquier editor de imágenes o herramienta online.
Sin ellos la app funciona igual, pero el instalador puede no mostrar ícono.

---

## Funciones de la sync bar (barra superior)

| Botón | Función |
|-------|---------|
| **↓ Exportar** | Descarga `finanzas-data-YYYY-MM-DD.json` con todos los datos actuales |
| **↑ Importar** | Carga un archivo JSON y actualiza la app + IndexedDB + servidor |
| **💾 Guardar** | Escribe los datos en `finanzas-data.json` via servidor (requiere `node server.js`) |

### Estados del indicador (punto de color)

- 🟢 Verde — servidor activo, guardar habilitado
- ⚪ Gris  — sin servidor, modo offline (export/import siguen funcionando)
- 🟠 Naranja parpadeante — guardando…
- 🔴 Rojo — error al guardar

---

## Modo offline

La app funciona **completamente offline** gracias al Service Worker y IndexedDB:

1. La primera vez que abrís la app con el servidor corriendo, los datos se cargan y se guardan en IndexedDB del navegador.
2. La próxima vez, aunque el servidor no esté corriendo, la app carga igual desde IndexedDB.
3. Para forzar recarga desde el JSON: abrí la consola del navegador y ejecutá `idbClearAll()`, luego F5.

---

## Instalar como app (PWA)

Con el servidor corriendo y la app abierta en Chrome/Edge:

- **Desktop**: Ícono de instalar en la barra de direcciones (o el banner que aparece en la app)
- **Android**: Menú ☰ → "Agregar a pantalla de inicio"
- **iOS/Safari**: Compartir → "Agregar a pantalla de inicio"

---

## Actualizar datos manualmente

Podés editar `finanzas-data.json` directamente con cualquier editor y luego:

```bash
# Opción A: usar el botón "Importar" en la app (seleccionás el archivo editado)

# Opción B: reiniciar el servidor y forzar recarga desde IDB
# Ejecutar en consola del navegador:
idbClearAll()
# Luego F5
```

---

## Backups automáticos

Cada vez que guardás desde la app, el servidor crea un backup automático:
```
finanzas-data.backup-2026-03-01T21-00-00.json
```

Podés borrarlos libremente cuando acumulen espacio.

---

## Puerto alternativo

```bash
node server.js --port 8080
# App disponible en http://localhost:8080
```
