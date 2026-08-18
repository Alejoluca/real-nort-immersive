# NORT OS Server

Base de datos en `data/nort-os.json` (atómica). Migrable a Postgres después.

## Modelo de roles

| Rol | Crear owners | Asignar props | Editar anuncio | Ver métricas | Recibe mail |
|-----|--------------|---------------|----------------|--------------|-------------|
| **admin** | Sí | Sí | Status sí | Todas | Opcional |
| **owner** | No | No | **No** | Solo las suyas | Sí (email que vos cargás) |
| **público** | No | No | No | No | No |

El propietario **nunca** crea su cuenta. Vos la creás en el panel y le pasás usuario + contraseña.

## Arranque

```bash
cd server
npm install
npm run seed
npm start
```

Panel: `.../panel/?api=http://localhost:8787`

## Variables

- `NORT_ADMIN_USER` / `NORT_ADMIN_PASS` / `NORT_ADMIN_EMAIL` (seed)
- `PORT` (default 8787)
- `CORS_ORIGIN` (ej. https://alejoluca.github.io)
- `NORT_DB_PATH` (opcional)
