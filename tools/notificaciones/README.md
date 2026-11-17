# Notificaciones (correo y celular)

`enviar.mjs` lo corre la tarea **Notificaciones** de GitHub Actions cada 15 minutos:

1. Crea (una sola vez) las llaves de Web Push: la privada queda en `pg_config/push` (ningún usuario la puede leer) y la pública
   en `pg_config_publica/push`.
2. Crea los recordatorios de mensualidad, de 9:00 a 21:00 de Ciudad de México: 3 días antes del día límite
   (`CLUB.pagos.diaLimite`), el día límite y un día después si venció. Uno por atleta, mes y tipo.
3. Envía los avisos pendientes (`pg_notificaciones`, `estado: "pendiente"`) por correo y al celular a las cuentas de tutor o
   atleta ligadas al atleta, y los marca como enviados (con cuántos correos y celulares).

Los avisos de «Pago registrado» y «Cargo a tu tarjeta» los crea la app al registrar un pago (`js/avisos.js`); llegan en el
siguiente ciclo (máximo ~15 minutos).

## Secretos (Settings → Secrets and variables → Actions → New repository secret)
- `FIREBASE_SERVICE_ACCOUNT`: el JSON completo de la cuenta de servicio de `akc-con-reporte`
  (Consola de Firebase → ⚙ Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada). Da acceso total al
  proyecto (también a lo de AKC): no lo pegues en ningún otro lado; el script solo toca colecciones `pg_*`.
- `GMAIL_USER`: el correo que envía (p. ej. el Gmail del club).
- `GMAIL_APP_PASSWORD`: contraseña de aplicación de ese Gmail (Cuenta de Google → Seguridad → Verificación en dos pasos →
  Contraseñas de aplicaciones). No es la contraseña normal.

Sin `FIREBASE_SERVICE_ACCOUNT` la tarea no hace nada; sin los de Gmail, envía solo al celular.

## Notas
- GitHub pausa las tareas programadas de un repositorio público tras 60 días sin cambios; si pasa, se reactivan en Actions.
- En iPhone las notificaciones solo llegan con la app agregada a la pantalla de inicio (iOS 16.4 o más).
- Prueba local con el emulador: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8089 CORREO_PRUEBA=1 node enviar.mjs`.
