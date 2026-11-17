# App ProGymnastics México — guía para Claude

App web (HTML/JS sin build) del club ProGymnastics México. Se publica con GitHub Pages desde `main` en **https://progymnastics-mx.github.io/** (repo `ProGymnastics-mx/progymnastics-mx.github.io`;
Manu lo pasó a la organización el 17-nov-2026 para que su nombre no salga en el enlace; ese dominio está autorizado en Firebase Authentication).
La pidió Manu (José Manuel Jaime Morales, 17-nov-2026): "clonar aguilaskc.net con la modalidad de la App GAV AKC (Firebase)",
con módulos de **pagos** y **asistencia**. Responder en español, claro y sin relleno.

## Estructura
- `index.html`: login (Firebase Auth correo/contraseña, o selector de perfil en modo demo) e **inicio como aguilaskc.net**
  (Manu, 17-nov-2026): logo y tarjetas **GAV**, **GAF** (cada quien solo las suyas), **Herramientas administrativas** y
  **Administración de acceso** (estas dos, solo SUPER/OWNER/ADMIN).
- `gav/` y `gaf/` (`js/paginas.js`, `tarjetasSeccion`): página de cada sección. Tomar asistencia (coach) o Asistencia
  (tutor/atleta), Mis pagos (tutor/atleta), Avisos, Calendario y, en gris «Próximamente»: Normativos, Editor de rutinas,
  Competencias y Reportes para papás. Los módulos reciben `?s=GAV|GAF` y solo muestran esa sección (y lo de todo el club);
  «Volver» regresa a la sección.
- `admin/`: Herramientas administrativas (solo administración) = Pagos, Registro de atletas (`equipo?vista=atletas`) y Bajas
  (`equipo?vista=bajas`, `atletas.baja = {fecha, motivo}`). Los módulos reciben `?v=admin`.
- **Reporte de asistencia** (`asistencia?s=GAV&vista=reporte`): en cada sección, para TODOS (atletas, papás y entrenadores; Manu,
  17-nov-2026), con todos los atletas de la sección; papá/atleta ven además el día por día de los suyos. Por eso `pg_asistencia` la
  lee cualquier miembro y cada registro guarda el `nombre` del atleta.
- Administración de acceso = `equipo?vista=accesos`. Un COACH lleva `secciones` ([] = GAV y GAF) y `grupos` ([] = todos los
  de sus secciones): solo entra a esas secciones y toma lista de esos grupos.
- Cada grupo de `CLUB.grupos` pertenece a una sección (`seccion`); la sección de un atleta es la de su grupo.
- `js/config.js`: datos del club (grupos, cuotas, día límite, recargo, métodos, datos para pagar) y `FIREBASE_CONFIG`
  (`null` = modo demostración en localStorage).
- `js/db.js`: capa de datos única (Firestore o localStorage) — los módulos usan solo `DB.*`.
- `js/sesion.js`: sesión, perfiles y permisos (`Sesion.puede.*`), utilidades `UI.*` y encabezado de módulos.
- `modulos/<nombre>/index.html + app.js`: asistencia, pagos, equipo, avisos, calendario.
- **Firebase = `akc-con-reporte` (el de Manu, compartido con AKC; Manu, 17-nov-2026).** Todo va en colecciones `pg_*`
  (`COLECCION_PREFIJO`); nunca tocar colecciones ni reglas de AKC. `?demo` abre el modo demostración.
- `firestore.rules`: reglas COMPLETAS del proyecto (incluye el bloque abierto de AKC, que no se toca): Manu las copia enteras a la consola
  cada vez que cambian. Cualquier permiso o colección nueva en la app se refleja aquí y se prueba en el emulador antes de entregarlas.
- Colores del logo: amarillo `#ffcb0b` y negro.
- **Diseño de iPhone (cliente, vía Manu, 17-nov-2026):** que se vea y se sienta como app de iOS, fácil y accesible. `css/app.css`
  usa el lenguaje de iOS: letra del sistema, fondo agrupado (#f2f2f7 / negro), celdas redondeadas, barra traslúcida con «‹ Atrás»
  y título grande (`UI.encabezado`), **inicio con tarjetas anchas** (todo el ancho, ícono grande, nombre y una línea) y **secciones y
  herramientas como la pantalla de inicio del iPhone** (`PaginaMenu`: íconos grandes de color con solo su nombre corto `c`, 3 por fila
  en celular; en tableta todo más grande) — Manu, 17-nov-2026: «íconos más grandes, menos texto», control segmentado en pestañas, interruptores en casillas, ventanas como hoja que sube desde
  abajo, colores del sistema de iOS (variables `--verde`, `--azul`…) e íconos de línea propios (`UI.icono`). Modo claro y oscuro,
  áreas seguras (`viewport-fit=cover`) y metas para instalarla en la pantalla de inicio. Todo módulo nuevo sigue este estilo.

- **Notificaciones (Manu, 17-nov-2026: «celular y correo»)**: `js/avisos.js` (cliente), `sw.js` (service worker SOLO de notificaciones,
  sin caché), `modulos/notificaciones/` (activar en el celular y lista de avisos; fila con contador en el inicio). Al registrar un
  pago, administración crea `pg_notificaciones` («Pago registrado» o, con método Tarjeta, «Cargo a tu tarjeta»). La tarea de GitHub
  Actions `.github/workflows/notificaciones.yml` (cada 15 min, `tools/notificaciones/enviar.mjs` con firebase-admin) crea las llaves
  VAPID (privada en `pg_config`, que nadie lee; pública en `pg_config_publica`), los recordatorios de mensualidad (3 días antes, el
  día límite y un día después; 9 a 21 h CDMX) y envía los pendientes por correo (Gmail del club) y Web Push a tutores/atletas ligados.
  Secretos: FIREBASE_SERVICE_ACCOUNT, GMAIL_USER, GMAIL_APP_PASSWORD (ver `tools/notificaciones/README.md`). Pantalla bloqueada:
  texto corto sin nombres ni montos (`push`); el detalle va en correo y en la app. **Sin pago en línea** (Manu, 17-nov-2026): los papás
  pagan en efectivo, transferencia o tarjeta directamente en administración, que lo registra en la app y eso dispara la confirmación.

## Etapas pedidas por Manu (17-nov-2026)
1. ✅ Estructura: inicio, secciones, herramientas administrativas y acceso; vistas por perfil (admin y coach primero).
   ✅ Normativos GAV (`modulos/normativos/`, `catalogo-gav.json` con ids estables `PISO-001`…, avances en `pg_normativos/<atletaId>`).
   ✅ Editor de rutinas GAV (`modulos/rutinas/editor.*`, traído del de AKC con la misma lógica de cálculo de NP: Código FIG,
   FMG N9/N10, USAG N7/N8 y obligatorios 3–6). Cambios: atletas elegidos de `pg_atletas` de GAV (clave = nombre en mayúsculas),
   sin Excel de arranque (no hay «Volver a cargar del Excel» ni «Descargar Excel»), guarda en `pg_rutinas/estado` (solo staff;
   en demo, en el navegador), marca ProGymnastics y capa de estilo iPhone al final de `editor.css` (la impresión no cambia).
   Al guardar, publica la NP de cada atleta en `pg_rutinas_vista/<atletaId>` (para su reporte; un papá no lee `pg_rutinas`).
   ✅ Competencias GAV (`modulos/competencias/`, solo staff): copas en `pg_competencias` (todos las ven, con `podio` = el más
   eficiente de libres y obligatorios), resultados en `pg_resultados/<copaId>__<atletaId>` (NP juez, NF, NP de rutina tomada de
   `pg_rutinas_vista`), captura con % en vivo y concentrado con colores. Reglas de eficiencia en `js/eficiencia.js` (las de AKC).
   ✅ Reportes GAV (`modulos/reportes/`): por atleta, competencias (tendencia, detalle, mejor nota por aparato), rutina actual,
   normativos y asistencia; papá/atleta solo los suyos. En AKC los papás ven el ranking completo de la última copa; aquí, por
   ahora, solo el «más eficiente» (podio) y lo de su hijo — preguntar a Manu si el cliente quiere el ranking completo.
2. GAV: traer de aguilaskc.net (`Kids-Center-Gimnasia/AguilasKC`, `gav/app/`) Normativos, Editor de rutinas, Calendario,
   Competencias (subir resultados, notas de partida, eficiencia) y Reportes para papás. **No** Fuerza ni Plan anual
   (Manu aún no sabe si se los mandarán). Sin datos ni nombres de atletas de AKC: los atletas son los de `pg_atletas`.
3. ✅ GAF: Normativos femeniles (`modulos/normativos/catalogo-gaf.json`, 269 elementos ≈ los 267 de GAV; generado con
   `tools/catalogo_gaf.py`): salto 35 (fundamentos de carrera/trampolín, progresión USAG de salto L6-7 y saltos del Código de valor
   ≤ 4.4), barras 61, viga 86 y piso 87 (fundamentos de las compulsorias USAG L1-5 + elementos **A y B** del Código FIG femenil
   2025-28 con su descripción UPAG, número y letra en `ref`). Manu (17-nov-2026) lo redujo de 371 a lo sugerido «Sí» + «Revisar»
   (quitó los C y los saltos de más de 4.4). Fuente de datos: `Jueceofemenil/app/datos/elementos_fig_wag.json`. Versión inicial: revisarla con
   los entrenadores del club; para agregar, al final de su aparato con id nuevo (ids `GAF-<APARATO>-NNN`, nunca reutilizarlos).
   ✅ GAF completo (Manu, 17-nov-2026): **Editor de rutinas** `modulos/rutinas-gaf/` = el editor femenil de APPBKA/Jueceofemenil
   (misma lógica: USAG N6-N10 Development 2026-30, Junior FIG y FIG GAF 2025-28; datos en `datos/`), con atletas de GAF del club,
   guardado en `pg_rutinas_gaf/estado` (solo staff), sin rutina EJEMPLO ni «Mi cuenta», y NP por atleta en `pg_rutinas_vista`.
   **Competencias** y **Reportes** son los mismos módulos con `?s=GAF`: `PG_EFIC.seccion("GAF")` pone salto, barras, viga y piso y
   obligatorios = niveles 1-5 (libres 6-10, Junior y FIG). El reporte trae «¿En qué etapa va?» (por aparato, la primera
   clasificación de Normativos con < 80 % consolidado, con lo que tiene en proceso y lo próximo); en GAF va hasta arriba.
4. Vistas de papá y atleta.
Cada colección nueva (`pg_normativos`, `pg_rutinas`…) necesita su bloque en `firestore.rules`, y Manu debe pegar las reglas
otra vez en la consola; sin eso Firestore la rechaza.

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
