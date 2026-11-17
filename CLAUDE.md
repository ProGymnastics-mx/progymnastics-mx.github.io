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
- `admin/`: Herramientas administrativas = Pagos, Registro de atletas (`equipo?vista=atletas`), Bajas (`equipo?vista=bajas`,
  `atletas.baja = {fecha, motivo}`) y Reporte de asistencias (`asistencia?vista=reporte`, todo el club). Los módulos reciben `?v=admin`.
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
  y título grande (`UI.encabezado`), inicio como pantalla de inicio del iPhone (íconos de color), secciones y herramientas como
  listas de Ajustes (`PaginaMenu`), control segmentado en pestañas, interruptores en casillas, ventanas como hoja que sube desde
  abajo, colores del sistema de iOS (variables `--verde`, `--azul`…) e íconos de línea propios (`UI.icono`). Modo claro y oscuro,
  áreas seguras (`viewport-fit=cover`) y metas para instalarla en la pantalla de inicio. Todo módulo nuevo sigue este estilo.

## Etapas pedidas por Manu (17-nov-2026)
1. ✅ Estructura: inicio, secciones, herramientas administrativas y acceso; vistas por perfil (admin y coach primero).
   ✅ Normativos GAV (`modulos/normativos/`, `catalogo-gav.json` con ids estables `PISO-001`…, avances en `pg_normativos/<atletaId>`).
2. GAV: traer de aguilaskc.net (`Kids-Center-Gimnasia/AguilasKC`, `gav/app/`) Normativos, Editor de rutinas, Calendario,
   Competencias (subir resultados, notas de partida, eficiencia) y Reportes para papás. **No** Fuerza ni Plan anual
   (Manu aún no sabe si se los mandarán). Sin datos ni nombres de atletas de AKC: los atletas son los de `pg_atletas`.
3. GAF: crear Normativos femeniles de salto, barras, viga y piso con la misma lógica que los varoniles, basados en el
   programa USAG y el Código FIG femenil (fuentes: repos `APPBKA` —módulo femenil— y `Jueceofemenil`).
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
