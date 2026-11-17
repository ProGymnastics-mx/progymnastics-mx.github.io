# ProGymnastics México — App del club

Publicada en **https://progymnastics-mx.github.io/** (organización de GitHub `ProGymnastics-mx`, repo `progymnastics-mx.github.io`).

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
Abriendo la app con `?demo` (o con `FIREBASE_CONFIG = null`), funciona sin nube: se entra eligiendo un perfil
y los datos (inventados) se guardan solo en ese navegador.

## Firebase (proyecto `akc-con-reporte`, el de Manu)
La app usa el mismo proyecto de Firebase que las apps de AKC. Todo lo de ProGymnastics va en colecciones con
prefijo `pg_` (`COLECCION_PREFIJO` en `js/config.js`), así que no toca nada de AKC. La demostración sigue
disponible abriendo la app con `?demo`.

Pasos en la consola (https://console.firebase.google.com/project/akc-con-reporte):
1. Authentication → Método de acceso → activar **Correo electrónico/contraseña**.
2. Authentication → Configuración → Dominios autorizados → agregar `progymnastics-mx.github.io`.
3. Firestore → Reglas → **agregar** (no reemplazar) lo de `firestore.rules`, siguiendo las instrucciones de su encabezado.
4. Primeras cuentas: en Firestore crear la colección `pg_invitaciones` con dos documentos, cada uno con id = el
   correo en minúsculas y los campos `nombre` (texto), `rol` (texto) y `atletas` (arreglo vacío):
   - el del desarrollador con `rol` = `SUPER` (control total; nadie lo puede quitar ni cambiar desde la app);
   - el del dueño del club con `rol` = `OWNER`.
   Cada persona abre la app, escribe su correo y una contraseña y toca «Crear mi cuenta».
   Desde ahí todo lo demás se invita en **Equipo → Accesos**. (Los correos no se escriben en este repo: es público.)

## Datos (Firestore)
`pg_usuarios/<uid>`, `pg_invitaciones/<correo>`, `pg_atletas/<id>`, `pg_asistencia/<fecha>_<grupo>_<atletaId>`,
`pg_pagos/<id>`, `pg_avisos/<id>`, `pg_eventos/<id>` (en el código se escriben sin `pg_`; `js/db.js` lo agrega). Detalle de cada campo al inicio de cada `app.js`.
