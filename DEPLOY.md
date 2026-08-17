# Real Nort — Deploy automatizado

## Token de GitHub (una vez)

1. https://github.com/settings/tokens → Generate new token (classic)
2. Scope: `repo`
3. `export GH_TOKEN=ghp_...`

## En tu máquina

```bash
cd real-nort-immersive
npm run deploy    # build limpio + publish con tu token
```

Live: https://alejoluca.github.io/real-nort-immersive/

## Opcional: sync Drive

```bash
export GOOGLE_API_KEY=...
npm run sync && npm run deploy
```

## GitHub Actions

- Secret opcional: `GOOGLE_API_KEY`
- Workflow: Actions → Sync Drive + Deploy → Run workflow
- Cron diario 15:00 UTC

## Build garantiza

- 46 props, 0 imágenes compartidas
- data1.js + data2.js síncronos (sin race de fetch)
