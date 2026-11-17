# App ProGymnastics México — guía para Claude

App web (HTML/JS sin build) del club ProGymnastics México. Se publica con GitHub Pages desde `main` en **https://progymnastics-mx.github.io/** (repo `ProGymnastics-mx/progymnastics-mx.github.io`;
Manu lo pasó a la organización el 17-nov-2026 para que su nombre no salga en el enlace; ese dominio está autorizado en Firebase Authentication).
La pidió Manu (José Manuel Jaime Morales, 17-nov-2026): "clonar aguilaskc.net con la modalidad de la App GAV AKC (Firebase)",
con módulos de **pagos** y **asistencia**. Responder en español, claro y sin relleno.

## Estructura
- `index.html`: login (Firebase Auth correo/contraseña, o selector de perfil en modo demo) y menú en tarjetas.
- `js/config.js`: datos del club (grupos, cuotas, día límite, recargo, métodos, datos para pagar) y `FIREBASE_CONFIG`
  (`null` = modo demostración en localStorage).
- `js/db.js`: capa de datos única (Firestore o localStorage) — los módulos usan solo `DB.*`.
- `js/sesion.js`: sesión, perfiles y permisos (`Sesion.puede.*`), utilidades `UI.*` y encabezado de módulos.
- `modulos/<nombre>/index.html + app.js`: asistencia, pagos, equipo, avisos, calendario.
- **Firebase = `akc-con-reporte` (el de Manu, compartido con AKC; Manu, 17-nov-2026).** Todo va en colecciones `pg_*`
  (`COLECCION_PREFIJO`); nunca tocar colecciones ni reglas de AKC. `?demo` abre el modo demostración.
- `firestore.rules`: reglas de seguridad (se AGREGAN a las de AKC, no las reemplazan); cualquier permiso nuevo en `sesion.js` se refleja también aquí.
- Colores del logo: amarillo `#ffcb0b` y negro.

## Reglas
- **SUPER = Desarrollador (Manu, 17-nov-2026):** el club se vende; el dueño es OWNER, pero Manu debe poder manejar todo.
  SUPER tiene todo lo del OWNER y desde la app nadie lo da, cambia ni quita (reglas en `firestore.rules` y `equipo/app.js`);
  solo se crea a mano en la consola de Firebase. Los correos de Manu y del dueño no van en el repo (es público).
- Perfiles como aguilaskc.net: SUPER > OWNER > ADMIN > COACH > TUTOR/ATLETA. Tutor y atleta solo ven a sus atletas (`usuarios.atletas`).
  Coaches no ven pagos.
- Asistencia: P/R/S cuentan como asistencia, F y J como falta, clase cancelada = sin registros. Semáforo 85% / 70%.
- Pagos: estado del mes solo con concepto Mensualidad; antes del mes `desde` del atleta no hay adeudo.
- Textos de usuarios siempre escapados (`UI.esc`) o con `textContent`.
- Probar en ancho de celular (~390 px) y en impresión. Distinguir lo hecho, lo probado y lo verificado.
- No exponer contraseñas ni tokens.
