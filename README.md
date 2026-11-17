# ProGymnastics México — App del club

App web (HTML/JS sin build) para ProGymnastics México, con el mismo modelo que la App GAV de AKC:
se publica con **GitHub Pages** y guarda los datos en **Firebase** (Auth + Firestore).
Toma la organización de aguilaskc.net (perfiles OWNER/ADMIN/COACH/TUTOR/ATLETA, avisos, calendario, asistencias),
pero sin servidor PHP.

## Módulos
| Módulo | Quién | Qué hace |
|---|---|---|
| Asistencia | Staff toma lista; tutor/atleta ven lo suyo | Lista por grupo y fecha (Presente, Retardo, Salió temprano, Falta, Justificada; clase cancelada). Tablero por mes o año con semáforo 85% / 70%. |
| Pagos | Administración; tutor/atleta ven lo suyo | Mensualidad por atleta, estado del mes (Pagado, Parcial, Pendiente, Vencido), registrar pago, recibo imprimible, CSV, historial. |
| Avisos | Staff publica; todos leen | Por club o por grupo. |
| Calendario | Staff edita; todos ven | Competencias, eventos, días sin clase. |
| Equipo | OWNER y ADMIN | Atletas (grupo, nivel, mensualidad, alta, baja) y accesos (invitaciones por correo). |

## Modo demostración
Mientras `FIREBASE_CONFIG` sea `null` en `js/config.js`, la app funciona sin nube: se entra eligiendo un perfil
y los datos (inventados) se guardan solo en ese navegador.

## Poner en marcha con Firebase
1. Crear un proyecto en https://console.firebase.google.com (p. ej. `progymnastics-mx`).
2. Authentication → Método de acceso → activar **Correo electrónico/contraseña**.
3. Firestore Database → Crear base de datos (modo producción, región `nam5` o `us-central`).
4. Firestore → Reglas → pegar `firestore.rules` y publicar.
5. Configuración del proyecto → Tus apps → Web → copiar la configuración en `FIREBASE_CONFIG` (`js/config.js`).
6. Authentication → Configuración → Dominios autorizados → agregar `<usuario>.github.io`.
7. Primer OWNER: en Firestore crear a mano el documento `invitaciones/<correo en minúsculas>` con
   `nombre` (texto), `rol` = `OWNER`, `atletas` = arreglo vacío. Luego esa persona abre la app, escribe su correo y
   una contraseña y toca «Crear mi cuenta». Desde ahí todo lo demás se invita en **Equipo → Accesos**.

## Datos (Firestore)
`usuarios/<uid>`, `invitaciones/<correo>`, `atletas/<id>`, `asistencia/<fecha>_<grupo>_<atletaId>`,
`pagos/<id>`, `avisos/<id>`, `eventos/<id>`. Detalle de cada campo al inicio de cada `app.js`.
