# NORT OS — API pública

## Deploy en Render (recomendado, gratis)

1. Creá cuenta en https://render.com
2. **New → Web Service**
3. Conectá el repo `Alejoluca/real-nort-immersive`
4. Configuración:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node src/index.js`
5. Variables de entorno:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `https://alejoluca.github.io` |
| `NORT_ADMIN_USER` | `admin` |
| `NORT_ADMIN_PASS` | *(elegí una segura)* |
| `NORT_ADMIN_EMAIL` | `alejolucatelli@gmail.com` |

6. Create Web Service → esperá la URL, ej:  
   `https://nort-os-api.onrender.com`

7. Probar: `https://TU-URL.onrender.com/api/health` → `{"ok":true,...}`

8. Panel con API:

```
https://alejoluca.github.io/real-nort-immersive/panel/?api=https://TU-URL.onrender.com
```

O una sola vez en la consola del panel:

```js
localStorage.setItem('nort_api', 'https://TU-URL.onrender.com')
location.reload()
```

## Login admin

Usuario y pass = los de `NORT_ADMIN_*` en Render.

## Nota free tier Render

El servicio se duerme tras ~15 min sin tráfico. El primer request puede tardar 30–60 s.

## Railway (alternativa)

```bash
# en carpeta server
railway init
railway up
railway variables set CORS_ORIGIN=https://alejoluca.github.io
railway variables set NORT_ADMIN_PASS=tu-pass
```
