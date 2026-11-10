# Research: proveedor de Notifications in-app para Cadence

Ticket: [#2](https://github.com/Dm19brea/cohort-005-project/issues/2) (mapa [#1](https://github.com/Dm19brea/cohort-005-project/issues/1)).
Fecha de la investigación: **2026-11-10**. Las páginas de precios no muestran fecha de versión salvo Courier ("Published Nov 10, 2026"); los precios citados son los vistos ese día. Versiones de paquetes tomadas de `npm view` el mismo día.

Contexto Cadence: React 19.2 / React Router 8.3 con SSR, Node, SQLite. Solo canal in-app, Notifications nacidas de eventos del sistema, plan gratuito, y desarrollo/tests en local sin red (como el `.outbox/` del mailer).

## Recomendación

**Knock** es la opción recomendada, con **Novu** de segunda opción.

Por qué Knock:

- El plan gratuito incluye 10.000 mensajes/mes, workflows ilimitados, feeds in-app con componentes prehechos, preferencias y logs de 30 días. Si se supera el límite no se corta el servicio: Knock avisa para añadir método de pago ([pricing](https://knock.app/pricing)).
- `@knocklabs/react` 0.15.1 declara `react ^17 || ^18 || ^19`. `next` y `@tanstack/react-router` son peers opcionales, así que no obliga a usar un framework ([npm](https://www.npmjs.com/package/@knocklabs/react)).
- Su modelo de preferencias es el más rico de los cinco. Hay preferencias por workflow, por categoría y por canal, y además *preference conditions* que permiten silenciar un recurso concreto (p. ej. un curso) ([preferences](https://docs.knock.app/preferences/overview), [conditions](https://docs.knock.app/preferences/preference-conditions)).
- La identidad usa IDs propios (`user.id` = id de usuario de Cadence) y, en producción, un JWT RS256 firmado en local por el servidor con `signUserToken` de `@knocklabs/node`, sin llamada de red ([security](https://docs.knock.app/in-app-ui/security-and-authentication)).

Por qué Novu queda segundo: es open source, `@novu/react` soporta React 19 y trae Inbox, Bell y Preferences listos. Pero el plan gratuito limita a **5 workflows** y a **24 h de retención** del activity feed ([pricing](https://novu.co/pricing)). Con un catálogo de Notifications para cuatro roles se pasa de 5 workflows enseguida.

## Comparativa

| Criterio | Knock | Novu | MagicBell | SuprSend | Courier |
|---|---|---|---|---|---|
| Plan gratuito | 10k mensajes/mes, workflows ilimitados, logs 30 días | 10k workflow runs/mes, **5 workflows**, suscriptores ilimitados, retención 24 h | **1.000 deliveries/mes**, usuarios ilimitados | 10k notificaciones/mes, feed con marca SuprSend | 10k sends/mes |
| Siguiente plan | Starter 250 $/mes | Pro desde 30 $/mes | Startup 249 $/mes | Essentials 100 $/mes | Business 0,005 $/send |
| React (bandeja + campana) | `@knocklabs/react` 0.15.1: `NotificationIconButton`, `NotificationFeedPopover`, `NotificationFeed`, hooks headless. Peer React 17–19 | `@novu/react` 3.19.2: `Inbox`, `Bell`, `Preferences`. Peer React 18–19 | `@magicbell/react` 1.14.0: `FloatingInbox`, `Inbox`, `UserPreferences`. No declara peer de React | `@suprsend/react` 1.5.0, peer `react >=16.8`, usa emotion | `@trycourier/courier-react` 9.3.5: `CourierInbox`, `CourierInboxPopupMenu`, `CourierPreferences`. Peer React >=18. Solo cliente |
| Preferencias | Workflow, categoría, canal, tenant, objeto + conditions (silenciar un curso) | Global y por workflow/canal, por tenant, workflows "critical" | Por categoría y canal | **Solo en el plan Business** | Topics, routing, digest |
| Tiempo real | WebSocket (Phoenix channels, dependencia `phoenix` de `@knocklabs/client`). Se desconecta en pestañas inactivas | WebSocket (`socket.io-client`/`partysocket` en `@novu/js`) | WebSocket (`reconnecting-websocket`) | No aparece en el plan gratuito | WebSocket con `inbox.listenForUpdates()` |
| SDK de Node | `@knocklabs/node` 1.41.1 | `@novu/api` 3.19.1 | `magicbell-js` | `@suprsend/node-sdk` 1.15.1 | `@trycourier/courier` 10.0.0 |
| Identidad | ID propio + JWT RS256 firmado en local (modo "enhanced security") | `subscriberId` propio + `subscriberHash` HMAC-SHA256 con la secret key | User JWT generado en el servidor | JWT de usuario firmado por el servidor (antes HMAC) | JWT emitido con la API key, más `userId` |
| Local sin red | Sin emulador. Hace falta un adaptador propio | Sin emulador: `npx novu dev` hace túnel a Novu Cloud | Sin emulador | Sin emulador | Sin emulador |

Fuentes por columna:
- Knock: [pricing](https://knock.app/pricing), [React feed](https://docs.knock.app/in-app-ui/react/feed), [React overview](https://docs.knock.app/in-app-ui/react/overview), [security](https://docs.knock.app/in-app-ui/security-and-authentication), [preferences](https://docs.knock.app/preferences/overview), [testing workflows](https://docs.knock.app/send-notifications/testing-workflows), [environments](https://docs.knock.app/concepts/environments).
- Novu: [pricing](https://novu.co/pricing), [Inbox](https://docs.novu.co/platform/inbox/overview), [prepare for production (HMAC)](https://docs.novu.co/platform/inbox/prepare-for-production), [preferences](https://docs.novu.co/platform/concepts/preferences), [Studio / `novu dev`](https://docs.novu.co/framework/studio).
- MagicBell: [pricing](https://www.magicbell.com/pricing), [React](https://www.magicbell.com/docs/libraries/magicbell-react).
- SuprSend: [pricing](https://www.suprsend.com/pricing), [Inbox React](https://docs.suprsend.com/docs/inbox-react).
- Courier: [pricing](https://www.courier.com/pricing), [React SDK](https://www.courier.com/docs/sdk-libraries/courier-react-web).
- Versiones y dependencias: `npm view <paquete> version peerDependencies dependencies`, ejecutado el 2026-11-10.

## Detalle por criterio (Knock)

### Plan gratuito
- 10.000 mensajes/mes. Un mensaje es una entrega a un usuario por un canal, así que una Notification in-app a una persona cuenta como 1. Los mensajes rebotados o fallidos no cuentan.
- Perfiles almacenados ilimitados, workflows ilimitados, multi-tenancy y feeds in-app.
- Además hay un límite de 500 "guide recipients", que solo aplica a banners y modales de Guides. No nos afecta.
- No hay corte duro al superar el límite ([pricing](https://knock.app/pricing)). Para un proyecto de curso, 10k mensajes/mes sobra.

### Componentes React y SSR
- `KnockProvider` (con `apiKey` y `user={{ id }}`) envuelve a `KnockFeedProvider` (con `feedId`, `userToken` y `colorMode`). Dentro van `NotificationIconButton` y `NotificationFeedPopover`.
- Hay que importar `@knocklabs/react/dist/index.css`. Se puede personalizar con las variables `--rnf-*` ([feed](https://docs.knock.app/in-app-ui/react/feed)).
- Las docs no tratan SSR. El feed abre sockets, así que en React Router hay que tratarlo como componente de cliente: renderizar la campana solo tras hidratar, o dentro de un boundary `ClientOnly`. **Pendiente de verificar en el prototipo.** Lo mismo ocurre con todos los proveedores (Courier lo dice explícitamente: "components render client-side only").

### Preferencias
- `PreferenceSet` con `workflows`, `categories`, `channel_types` y `channels`. Todo lo que no se define vale `true` por defecto.
- Silenciar por tipo: se pone a `false` el workflow o la categoría.
- Silenciar por curso: con *preference conditions*. Por ejemplo, `recipient.muted_courses not_contains data.course_id`, guardando los cursos silenciados como atributo del usuario. La alternativa son las preferencias por objeto, modelando el curso como object ([conditions](https://docs.knock.app/preferences/preference-conditions)). La página de precios no menciona restricciones de plan para las conditions.
- Hay una guía de "preference center" en React y hooks para construirla a medida. El kit prehecho no incluye un componente de preferencias ([overview](https://docs.knock.app/in-app-ui/react/overview)).

### Tiempo real
- El feed es en tiempo real por WebSocket: `@knocklabs/client` depende de `phoenix` 1.8.9.
- `auto_manage_socket_connection` desconecta las pestañas inactivas (2 s por defecto) y las reconecta al volver. Hay sincronización experimental entre pestañas con `BroadcastChannel` ([feed](https://docs.knock.app/in-app-ui/react/feed)).
- Incluido en el plan gratuito: los feeds in-app están en el plan y no se menciona ningún recargo.

### SDK de Node
- `@knocklabs/node` (1.41.1) dispara workflows con `knock.workflows.trigger(key, { recipients, data, actor })`. Incluye `signUserToken` para los JWT.
- Para tests con la API real existe `settings.sandbox_mode`, que ejecuta el workflow sin entregar a los destinatarios ([testing workflows](https://docs.knock.app/send-notifications/testing-workflows)). Aun así requiere red.

### Local y tests sin red
- **Ningún proveedor ofrece un emulador offline.** Novu `npx novu dev` es un túnel hacia Novu Cloud ([Studio](https://docs.novu.co/framework/studio)).
- El patrón para Cadence es el mismo que `app/lib/mailer.server.ts`: un módulo `notifier.server.ts` con una interfaz propia (`notify(event)`) y dos implementaciones. Una escribe a `.outbox/` (o una tabla) cuando no hay `KNOCK_API_KEY`, y la otra llama a Knock.
- Los tests verifican qué se dispara contra la implementación local.
- La campana en dev sin red necesita un fallback: ocultarla, o un feed local mínimo que lea esa outbox. Hay que decidirlo en el diseño o el prototipo.

### Identidad
- Recipient = el id de usuario de Cadence (string). No hace falta tabla de mapeo. El usuario se crea o actualiza al dispararle un workflow, o con `users.update` desde el servidor.
- Con **enhanced security** desactivado (lo normal en el entorno Development), basta la public key y `user.id`. Encaja con el cambio de usuario del DevUI: al cambiar de usuario cambia `user.id` y el provider se reconecta.
- En producción hay que activar enhanced security. El loader del root firma un JWT RS256 (`sub` = user id, `exp`) con `KNOCK_SIGNING_KEY` sin llamar a la red y lo pasa como `userToken`.
- Hay que alinear la caducidad con la sesión, o refrescar con `onUserTokenExpiring` ([security](https://docs.knock.app/in-app-ui/security-and-authentication)).

## Por qué se descartan los demás
- **Novu**: el producto es bueno, pero el plan gratuito limita a 5 workflows y a 24 h de activity feed. La identidad con HMAC (`subscriberHash`) es más simple que un JWT, pero el límite de workflows condiciona el catálogo de Notifications por rol. Es la mejor opción si se prefiere open source o pocos tipos de Notification.
- **MagicBell**: el plan gratuito es de solo 1.000 deliveries/mes y la página no deja claro qué incluye el plan Builder (inbox, tiempo real, preferencias).
- **SuprSend**: las preferencias de usuario solo están en Business (250 $/mes), el tiempo real no aparece en el plan gratuito y el feed lleva marca.
- **Courier**: la página de precios del plan Developer no lista Inbox ni preferencias. Su SDK React es v9, con peer React >=18, y solo funciona en cliente. Es viable, pero las condiciones del plan gratuito para in-app son menos claras.

## Avisos
- Ninguna página de precios lleva fecha salvo la de Courier. Hay que volver a comprobar los límites antes de comprometerse.
- Las docs de Knock no dicen si los entornos Development/Production están en el plan gratuito. Hay que comprobarlo al darse de alta. Si solo hubiera Production, se puede dejar enhanced security desactivado mientras dure el prototipo.
- Para prototipar con el proveedor real **hace falta darse de alta** en Knock y crear un canal in-app feed y al menos un workflow en el dashboard. Para el prototipo de UI con datos falsos no hace falta: se pueden usar los hooks headless o un mock local.
- Ninguno funciona sin red. El adaptador local tipo outbox es obligatorio para los tests.
