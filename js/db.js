/* Capa de datos: Firestore si hay FIREBASE_CONFIG; si no, modo demostración en localStorage.
   API (todas devuelven promesas):
     DB.obtener(col, id) → objeto o null (con .id)
     DB.listar(col, filtros) → arreglo; filtros = [[campo, "=="|">="|"<="|"in", valor], ...]
     DB.guardar(col, id|null, datos, {unir:true}) → id
     DB.borrar(col, id)
     DB.lote([{tipo:"guardar"|"borrar", col, id, datos}])
*/
(function () {
  // Modo demostración: sin FIREBASE_CONFIG, o abriendo la app con ?demo en la dirección.
  let pideDemo = /[?&]demo\b/.test(location.search);
  try { if (pideDemo) sessionStorage.setItem("pg_demo", "1"); else pideDemo = sessionStorage.getItem("pg_demo") === "1"; } catch (e) {}
  const DEMO = !window.FIREBASE_CONFIG || pideDemo;
  // Todas las colecciones del club llevan prefijo (pg_usuarios, pg_pagos…) para no mezclarse con otras apps del mismo proyecto.
  const P = window.COLECCION_PREFIJO || "";
  const C = (col) => fs.collection(P + col);
  const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const limpiar = (o) => JSON.parse(JSON.stringify(o)); // quita undefined

  let fs = null;
  if (!DEMO) {
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    fs = firebase.firestore();
  }

  // ---------- Modo demostración ----------
  const CLAVE = "pg_demo_db_v2"; // v2: grupos por sección (GAV/GAF)
  function leerDemo() {
    try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch (e) { return {}; }
  }
  let memoria = null;
  function base() {
    if (!memoria) { memoria = leerDemo(); if (!memoria.__sembrado) sembrar(memoria); }
    return memoria;
  }
  function escribirDemo() { try { localStorage.setItem(CLAVE, JSON.stringify(memoria)); } catch (e) {} }
  function cumple(doc, [campo, op, valor]) {
    const v = doc[campo];
    if (op === "==") return v === valor;
    if (op === ">=") return v >= valor;
    if (op === "<=") return v <= valor;
    if (op === "in") return valor.includes(v);
    if (op === "array-contains") return Array.isArray(v) && v.includes(valor);
    return false;
  }
  function sembrar(b) {
    // Datos inventados para ver la app funcionando; no son atletas reales.
    const g = window.CLUB.grupos.map((x) => x.id);
    const nombres = ["Atleta Demo 1", "Atleta Demo 2", "Atleta Demo 3", "Atleta Demo 4", "Atleta Demo 5", "Atleta Demo 6"];
    b.atletas = {};
    const d = new Date(); d.setMonth(d.getMonth() - 2);
    const desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    nombres.forEach((n, i) => {
      const id = "demo" + (i + 1);
      b.atletas[id] = { nombre: n, grupo: g[i % g.length], nivel: "", nacimiento: "", cuota: 1500, desde, activo: true, creado: new Date().toISOString() };
    });
    b.usuarios = {
      "demo-super": { nombre: "Desarrollador (demo)", email: "super@demo", rol: "SUPER", atletas: [] },
      "demo-owner": { nombre: "Dueño (demo)", email: "owner@demo", rol: "OWNER", atletas: [] },
      "demo-admin": { nombre: "Administración (demo)", email: "admin@demo", rol: "ADMIN", atletas: [] },
      "demo-coach": { nombre: "Coach GAV (demo)", email: "coach@demo", rol: "COACH", atletas: [], secciones: ["GAV"], grupos: [] },
      "demo-coach-gaf": { nombre: "Coach GAF (demo)", email: "coachf@demo", rol: "COACH", atletas: [], secciones: ["GAF"], grupos: [] },
      "demo-tutor": { nombre: "Tutor (demo)", email: "tutor@demo", rol: "TUTOR", atletas: ["demo1", "demo2"] },
      "demo-atleta": { nombre: "Atleta Demo 3", email: "atleta@demo", rol: "ATLETA", atletas: ["demo3"] }
    };
    b.avisos = {}; b.eventos = {}; b.pagos = {}; b.asistencia = {}; b.invitaciones = {};
    b.__sembrado = true;
  }

  const Demo = {
    async obtener(col, id) { const d = (base()[col] || {})[id]; return d ? { ...d, id } : null; },
    async listar(col, filtros = []) {
      const c = base()[col] || {};
      return Object.entries(c).map(([id, d]) => ({ ...d, id })).filter((d) => filtros.every((f) => cumple(d, f)));
    },
    async guardar(col, id, datos, op = {}) {
      const b = base(); b[col] = b[col] || {}; id = id || nuevoId();
      b[col][id] = op.unir === false ? limpiar(datos) : { ...(b[col][id] || {}), ...limpiar(datos) };
      escribirDemo(); return id;
    },
    async borrar(col, id) { const b = base(); if (b[col]) delete b[col][id]; escribirDemo(); },
    async lote(ops) { for (const o of ops) o.tipo === "borrar" ? await Demo.borrar(o.col, o.id) : await Demo.guardar(o.col, o.id, o.datos, o); },
    reiniciar() { localStorage.removeItem(CLAVE); memoria = null; }
  };

  // ---------- Firestore ----------
  const Nube = {
    async obtener(col, id) { const s = await C(col).doc(id).get(); return s.exists ? { ...s.data(), id: s.id } : null; },
    async listar(col, filtros = []) {
      // Firestore limita "in" a 10 valores: se parte en varias consultas.
      const conIn = filtros.find((f) => f[1] === "in");
      if (conIn && conIn[2].length > 10) {
        const out = [];
        for (let i = 0; i < conIn[2].length; i += 10) {
          const f2 = filtros.map((f) => (f === conIn ? [f[0], "in", f[2].slice(i, i + 10)] : f));
          out.push(...(await Nube.listar(col, f2)));
        }
        return out;
      }
      if (conIn && !conIn[2].length) return [];
      let q = C(col);
      filtros.forEach(([c, op, v]) => { q = q.where(c, op, v); });
      const s = await q.get();
      return s.docs.map((d) => ({ ...d.data(), id: d.id }));
    },
    async guardar(col, id, datos, op = {}) {
      const ref = id ? C(col).doc(id) : C(col).doc();
      await ref.set(limpiar(datos), { merge: op.unir !== false });
      return ref.id;
    },
    async borrar(col, id) { await C(col).doc(id).delete(); },
    async lote(ops) {
      for (let i = 0; i < ops.length; i += 450) {
        const b = fs.batch();
        ops.slice(i, i + 450).forEach((o) => {
          const ref = C(o.col).doc(o.id);
          o.tipo === "borrar" ? b.delete(ref) : b.set(ref, limpiar(o.datos), { merge: o.unir !== false });
        });
        await b.commit();
      }
    }
  };

  window.DB = Object.assign({ DEMO, nuevoId, fs: () => fs }, DEMO ? Demo : Nube);
})();
