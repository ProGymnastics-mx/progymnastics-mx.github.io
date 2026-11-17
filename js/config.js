/* ProGymnastics México — configuración del club.
   Lo marcado con "PENDIENTE" lo tiene que confirmar el club. */
window.CLUB = {
  nombre: "ProGymnastics México",
  nombreCorto: "ProGymnastics",

  // Secciones del club (como aguilaskc.net): cada una tiene su página con sus módulos.
  secciones: [
    { id: "GAV", nombre: "Gimnasia Artística Varonil" },
    { id: "GAF", nombre: "Gimnasia Artística Femenil" }
  ],

  // Grupos de entrenamiento; cada uno pertenece a una sección (PENDIENTE: nombres reales, días y horarios).
  // El id no puede llevar "/" (se usa en los registros de asistencia).
  grupos: [
    { id: "GAV-INICIACION", seccion: "GAV", nombre: "GAV Iniciación", dias: "PENDIENTE", horario: "PENDIENTE" },
    { id: "GAV-EQUIPO", seccion: "GAV", nombre: "GAV Equipo", dias: "PENDIENTE", horario: "PENDIENTE" },
    { id: "GAF-INICIACION", seccion: "GAF", nombre: "GAF Iniciación", dias: "PENDIENTE", horario: "PENDIENTE" },
    { id: "GAF-EQUIPO", seccion: "GAF", nombre: "GAF Equipo", dias: "PENDIENTE", horario: "PENDIENTE" }
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

/* Proyecto de Firebase: el de Manu (akc-con-reporte), 17-nov-2026. Lo comparte con las apps de AKC,
   por eso todo ProGymnastics va en colecciones con prefijo "pg_" (pg_usuarios, pg_pagos…), sin tocar las de AKC.
   Con null la app funcionaría en modo demostración; también se puede ver la demo abriendo la app con ?demo */
window.FIREBASE_CONFIG = { apiKey: "AIzaSyBNRAkDXLlw5fyiT01-ZfUyB0A7ShsAxyg", authDomain: "akc-con-reporte.firebaseapp.com", projectId: "akc-con-reporte" };
window.COLECCION_PREFIJO = "pg_";
