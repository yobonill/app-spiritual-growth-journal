# Diario de Crecimiento Espiritual

PWA personal para registrar sesiones de oración, peticiones y lectura bíblica. Toda la información se guarda localmente en IndexedDB; no requiere login, Firebase ni backend.

## Stack

- React + TypeScript + Vite
- vite-plugin-pwa / Workbox
- IndexedDB
- `chapter-and-verse` para la estructura canónica de capítulos y versículos
- GitHub Actions + GitHub Pages

## Desarrollo

```bash
npm install
npm run dev
```

La aplicación se abre en `http://localhost:4317`.

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` asume que el repositorio se llama:

`spiritual-growth-journal`

Por eso usa:

`VITE_BASE_PATH=/spiritual-growth-journal/`

Si el repositorio usa otro nombre, cambia esa variable en el workflow antes de desplegar.

En GitHub, configura **Settings → Pages → Source → GitHub Actions**.

## Datos

Base local: `spiritual-growth-journal-db`

Cache PWA: `spiritual-growth-journal-shell`

El respaldo JSON incluye todos los datos de la aplicación y puede reimportarse desde Configuración.
