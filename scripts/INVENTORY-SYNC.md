# Automatización de inventario (Google Drive → sitio)

## Flujo

```
Drive (2 carpetas raíz)
    → npm run sync      → data.json + inventory-report.json
    → npm run build     → data1.js + data2.js
    → npm run publish   → GitHub Pages live
```

Atajo: `npm run sync:full` (requiere `GOOGLE_API_KEY` + `GH_TOKEN`).

## Secrets

| Variable | Dónde | Para qué |
|----------|--------|----------|
| `GOOGLE_API_KEY` | local + GitHub Actions | Listar carpetas/fotos Drive |
| `GH_TOKEN` | local (`export`) | Publish a `main` |

### Google API Key
1. [Google Cloud Console](https://console.cloud.google.com/) → proyecto
2. APIs → habilitar **Google Drive API**
3. Credenciales → API Key
4. Las carpetas raíz deben ser **Cualquier persona con el enlace → Lector**

### GitHub Actions
Repo → Settings → Secrets → Actions → `GOOGLE_API_KEY`

Workflow: **Sync Drive + Deploy**
- Manual: Actions → Run workflow
- Automático: diario 15:00 UTC

## Permisos Drive (obligatorio)

Sobre:
- `1BO3ET48R5Spnfh-sfsYasqmcmRV9TUg6` (Real Nort)
- `1vh6NpZeesycS-RdnDl04bY0G8z0AXdh9` (Departamentos Tulum)

Compartir → Acceso general → **Cualquier persona con el enlace** → **Lector**.

## Reportes

Tras `npm run sync`:
- `data.json` — fuente de verdad (`driveFolderId` + imágenes)
- `inventory-report.json` — totales, nuevas, removidas, carpetas vacías

## Reglas del sync

- 1 carpeta Drive = 1 propiedad
- 0 imágenes compartidas entre props (falla si detecta cruce)
- Conserva precios/descripciones curadas de `data.json` previo
- Actualiza siempre la lista de fotos desde Drive
