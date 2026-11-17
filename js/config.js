/* ProGymnastics México — configuración del club.
   Lo marcado con "PENDIENTE" lo tiene que confirmar el club. */
window.CLUB = {
  nombre: "ProGymnastics México",
  nombreCorto: "ProGymnastics",

  // Grupos de entrenamiento (PENDIENTE: nombres reales, días y horarios).
  grupos: [
    { id: "INICIACION", nombre: "Iniciación", dias: "PENDIENTE", horario: "PENDIENTE" },
    { id: "PRE-EQUIPO", nombre: "Pre-equipo", dias: "PENDIENTE", horario: "PENDIENTE" },
    { id: "EQUIPO", nombre: "Equipo", dias: "PENDIENTE", horario: "PENDIENTE" }
  ],

  pagos: {
    moneda: "MXN",
    mensualidadBase: 0,          // PENDIENTE: cuota mensual general (cada atleta puede tener la suya)
    diaLimite: 10,               // PENDIENTE: día del mes en que vence la mensualidad
    recargo: 0,                  // PENDIENTE: recargo por pago tardío (0 = sin recargo)
    conceptos: ["Mensualidad", "Inscripción", "Uniforme", "Competencia", "Otro"],
    metodos: ["Efectivo", "Transferencia", "Tarjeta"],
    // PENDIENTE: datos para que las familias paguen (banco, CLABE, titular, a quién mandar el comprobante).
    datosParaPagar: ""
  },

  // Semáforo de asistencia (igual que aguilaskc.net).
  asistencia: { verde: 0.85, amarillo: 0.70 }
};

/* Proyecto de Firebase del club (PENDIENTE).
   Mientras sea null, la app funciona en MODO DEMOSTRACIÓN: los datos se guardan solo en
   este navegador y se entra eligiendo un perfil. Al crear el proyecto, pegar aquí su
   configuración web (Consola de Firebase → Configuración del proyecto → Tus apps → Web). */
window.FIREBASE_CONFIG = null;
/* Ejemplo:
window.FIREBASE_CONFIG = {
  apiKey: "…", authDomain: "progymnastics-mx.firebaseapp.com", projectId: "progymnastics-mx"
};
*/
