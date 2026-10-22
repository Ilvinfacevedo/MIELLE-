# Mielle · Tienda online

Tienda de **Mielle** (Beauty & Lifestyle, República Dominicana) con catálogo, carrito, factura en imagen y pedido por WhatsApp. Incluye un panel en `/admin` para manejar productos, fotos, precios y envíos.

## Cómo está armado

| Archivo | Qué es |
| --- | --- |
| `index.html`, `styles.css`, `store.js` | La tienda que ven los clientes |
| `products.json` | Productos, envíos, métodos de pago y número de WhatsApp |
| `img/` | Fotos de los productos (las sube el panel) |
| `admin/` | Panel de administración con contraseña |
| `api/` | Funciones de Vercel que guardan los cambios del panel en este repo |

Cuando guardas en el panel, se crea un commit en GitHub y Vercel vuelve a publicar la tienda sola en 30 a 60 segundos.

## Publicar en Vercel (una sola vez)

1. **Crea un token de GitHub**
   - Ve a GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → *Generate new token*.
   - *Repository access*: **Only select repositories** → `MIELLE-`.
   - *Permissions* → *Repository permissions* → **Contents: Read and write**.
   - Copia el token (empieza con `github_pat_`). No lo compartas con nadie.

2. **Importa el repo en Vercel**
   - Entra a [vercel.com/new](https://vercel.com/new), elige `MIELLE-` y toca **Import**.
   - Framework Preset: **Other**. No hace falta comando de build.

3. **Agrega las variables de entorno** (en el mismo paso, o luego en Settings → Environment Variables):

   | Nombre | Valor |
   | --- | --- |
   | `ADMIN_PASSWORD` | La contraseña que usarás para entrar al panel. Usa una larga. |
   | `GITHUB_TOKEN` | El token del paso 1 |

   Opcionales: `GITHUB_REPO` (por defecto `Ilvinfacevedo/MIELLE-`) y `GITHUB_BRANCH` (por defecto `main`).

4. Toca **Deploy**. Si agregaste las variables después, haz *Redeploy* para que tomen efecto.

## Usar el panel

1. Entra a `https://TU-DOMINIO/admin` y escribe tu contraseña.
2. **Productos**: agrega, edita, borra u ordena productos. Puedes subir la foto desde el celular.
3. **Pedidos y envíos**: número de WhatsApp, costo de cada forma de envío, métodos de pago y datos para transferencia.
4. Toca **Guardar cambios**. La tienda se actualiza en más o menos un minuto.

## Cómo llega un pedido

El cliente agrega productos al carrito, llena sus datos (nombre, teléfono, provincia, dirección), elige el envío y el pago, y al confirmar:

- Ve su **factura en imagen** y la puede descargar o compartir.
- Se abre **WhatsApp** con un mensaje listo hacia el número configurado, con todos los datos del pedido y el total.
