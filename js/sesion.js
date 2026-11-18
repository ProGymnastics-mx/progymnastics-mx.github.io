/* Sesión, roles y utilidades comunes de la interfaz.
   Perfiles, de mayor a menor: SUPER, OWNER, ADMIN, COACH, TUTOR / ATLETA (como aguilaskc.net).
   - SUPER (Desarrollador, Manu): todo, incluido lo del OWNER. Solo se da desde la consola de Firebase:
     nadie lo puede dar, cambiar ni quitar desde la app, ni el dueño del club.
   - OWNER y ADMIN: todo (equipo, pagos de todos, asistencia, avisos, calendario).
   - COACH: toma asistencia, publica avisos y calendario; no ve pagos. Solo entra a sus secciones
     (usuarios.secciones: ["GAV"], ["GAF"] o ambas; vacío = las dos) y, si tiene usuarios.grupos, solo a esos grupos.
   - TUTOR: ve asistencia y pagos solo de sus atletas (campo atletas).
   - ATLETA: ve su propia asistencia y pagos. */
(function () {
  const ROLES = { SUPER: "Desarrollador", OWNER: "Owner", ADMIN: "Administración", COACH: "Coach", TUTOR: "Tutor", ATLETA: "Atleta" };
  const esAdmin = (u) => u && ["SUPER", "OWNER", "ADMIN"].includes(u.rol);
  const esOwner = (u) => u && ["SUPER", "OWNER"].includes(u.rol);
  const esStaff = (u) => u && (esAdmin(u) || u.rol === "COACH");
  const puede = {
    equipo: esAdmin,
    pagosTodos: esAdmin,
    registrarPagos: esAdmin,
    tomarAsistencia: esStaff,
    asistenciaTodos: esStaff,
    publicar: esStaff,
    herramientasAdmin: esAdmin,
    accesos: esAdmin
  };

  // ---------- Secciones (GAV, GAF) y grupos ----------
  const SECCIONES = () => window.CLUB.secciones;
  // Programas (Manu, 18-nov-2026). Sin dato: Equipo si el grupo es de equipo; si no, Desarrollo.
  const PROGRAMAS = ["Equipo", "Desarrollo", "Adultos", "Bebés", "Preescolar"];
  const programaDe = (a) => (a && a.programa) || (/EQUIPO/i.test((a && a.grupo) || "") ? "Equipo" : "Desarrollo");
  const seccionDeGrupo = (g) => (window.CLUB.grupos.find((x) => x.id === g) || {}).seccion || "";
  const gruposDeSeccion = (sec) => window.CLUB.grupos.filter((g) => !sec || g.seccion === sec);
  // Secciones a las que entra cada quien. Tutor y atleta: las de los grupos de sus atletas.
  function seccionesDe(u, atletas) {
    const todas = SECCIONES().map((x) => x.id);
    if (esAdmin(u)) return todas;
    if (u.rol === "COACH") return (u.secciones && u.secciones.length) ? todas.filter((x) => u.secciones.includes(x)) : todas;
    const mias = new Set((atletas || []).map((a) => seccionDeGrupo(a.grupo)));
    return todas.filter((x) => mias.has(x));
  }
  // Grupos que el usuario puede manejar (tomar lista) en una sección.
  function gruposDe(u, sec) {
    let g = gruposDeSeccion(sec);
    if (u.rol === "COACH") {
      if (u.secciones && u.secciones.length) g = g.filter((x) => u.secciones.includes(x.seccion));
      if (u.grupos && u.grupos.length) g = g.filter((x) => u.grupos.includes(x.id));
    }
    return g;
  }
  // Parámetros de la dirección: ?s=GAV (sección) y ?v=admin (vuelve a Herramientas administrativas).
  const param = (k) => new URLSearchParams(location.search).get(k) || "";
  function seccionActual() { const s = param("s").toUpperCase(); return SECCIONES().some((x) => x.id === s) ? s : ""; }

  function auth() { return window.firebase && firebase.apps.length ? firebase.auth() : null; }

  // Devuelve el usuario de la app ({uid, nombre, email, rol, atletas}) o null.
  async function actual() {
    if (DB.DEMO) {
      const uid = localStorage.getItem("pg_demo_uid");
      if (!uid) return null;
      const u = await DB.obtener("usuarios", uid);
      return u ? { ...u, uid } : null;
    }
    const fbUser = await new Promise((res) => { const off = auth().onAuthStateChanged((x) => { off(); res(x); }); });
    if (!fbUser) return null;
    let u = await DB.obtener("usuarios", fbUser.uid);
    if (!u) {
      // Primer ingreso: la cuenta toma su perfil de la invitación que dejó Administración.
      const email = (fbUser.email || "").toLowerCase();
      const inv = await DB.obtener("invitaciones", email).catch(() => null);
      if (!inv) { await auth().signOut(); throw new Error("Este correo no tiene invitación del club. Pídela a Administración."); }
      u = { nombre: inv.nombre || email, email, rol: inv.rol, atletas: inv.atletas || [], desde: new Date().toISOString() };
      if (inv.secciones) u.secciones = inv.secciones;
      if (inv.grupos) u.grupos = inv.grupos;
      await DB.guardar("usuarios", fbUser.uid, u, { unir: false });
      await DB.borrar("invitaciones", email).catch(() => {}); // ya se usó
    }
    return { ...u, uid: fbUser.uid };
  }

  // Para páginas internas: exige sesión (y opcionalmente un permiso) o regresa al inicio.
  async function requerir(raiz, permiso) {
    let u = null;
    try { u = await actual(); } catch (e) { /* sin invitación */ }
    if (!u) { location.href = raiz + "index.html"; return new Promise(() => {}); }
    if (permiso && !puede[permiso](u)) { location.href = raiz + "index.html"; return new Promise(() => {}); }
    return u;
  }

  async function salir(raiz) {
    if (DB.DEMO) { localStorage.removeItem("pg_demo_uid"); location.href = raiz + "index.html?demo"; return; }
    else await auth().signOut();
    location.href = raiz + "index.html";
  }

  // ---------- utilidades de interfaz ----------
  const pad = (n) => String(n).padStart(2, "0");
  const UI = {
    esc: (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    hoy: () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
    mesActual: () => UI.hoy().slice(0, 7),
    MESES: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    nombreMes: (p) => { const [a, m] = p.split("-"); return `${UI.MESES[+m - 1]} ${a}`; },
    fecha: (iso) => { if (!iso) return ""; const [a, m, d] = iso.slice(0, 10).split("-"); return `${+d} ${UI.MESES[+m - 1].slice(0, 3)} ${a}`; },
    dinero: (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: window.CLUB.pagos.moneda || "MXN" }),
    grupo: (id) => (window.CLUB.grupos.find((g) => g.id === id) || { nombre: id || "Sin grupo" }).nombre,
    seccion: (id) => (window.CLUB.secciones.find((x) => x.id === id) || { nombre: id }).nombre,
    // <option> de grupos agrupados por sección (lista = grupos permitidos).
    opcionesGrupos(lista, elegido) {
      return window.CLUB.secciones.map((sec) => {
        const gs = (lista || window.CLUB.grupos).filter((g) => g.seccion === sec.id);
        return gs.length ? `<optgroup label="${UI.esc(sec.id)}">${gs.map((g) => `<option value="${UI.esc(g.id)}"${g.id === elegido ? " selected" : ""}>${UI.esc(g.nombre)}</option>`).join("")}</optgroup>` : "";
      }).join("");
    },
    aviso(msg, error) {
      let t = document.getElementById("pg-toast");
      if (!t) { t = document.createElement("div"); t.id = "pg-toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
      t.textContent = msg; t.classList.toggle("error", !!error); t.classList.add("ver");
      clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("ver"), 3200);
    },
    // Íconos de línea (blancos sobre cuadro de color, como iOS). Trazos propios, 24×24.
    ICONOS: {
      check: '<path d="M20 6 9 17l-5-5"/>',
      tarjeta: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
      megafono: '<path d="M4 10v4a1 1 0 0 0 1 1h3l6 4V5L8 9H5a1 1 0 0 0-1 1z"/><path d="M18 9a4 4 0 0 1 0 6"/>',
      calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
      lista: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 3h6v3H9zM8.5 11h7M8.5 15h5"/>',
      lapiz: '<path d="M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 7l3 3"/>',
      trofeo: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4v3h-4z"/>',
      grafica: '<path d="M4 4v16h16"/><path d="M8 15l3.5-3.5 3 3L20 9"/>',
      carpeta: '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.6l2 2h7.4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
      candado: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
      alta: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>',
      baja: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0M16 11h6"/>',
      barras: '<path d="M6 20V11M12 20V5M18 20v-6M3.5 20h17"/>',
      personas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>'
    },
    icono(nombre) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI.ICONOS[nombre] || ""}</svg>`;
    },
    chevron: '<svg class="chevron" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    // Barra de navegación de iOS: «‹ Atrás» a la izquierda, título chico al centro (aparece al bajar) y título grande en la página.
    // "Volver" regresa a la página de la que se llegó: la sección (?s=GAV), Herramientas administrativas (?v=admin) o el inicio.
    encabezado(titulo, raiz, u, volver) {
      if (!volver) {
        const sec = seccionActual();
        volver = sec ? raiz + sec.toLowerCase() + "/" : param("v") === "admin" ? raiz + "admin/" : raiz + "index.html";
      }
      const etiqueta = /admin\/$/.test(volver) ? "Herramientas" : /gav\/$/.test(volver) ? "GAV" : /gaf\/$/.test(volver) ? "GAF" : "Inicio";
      const h = document.createElement("header");
      h.className = "barra";
      h.innerHTML = `
        <a class="volver" href="${UI.esc(volver)}"><svg viewBox="0 0 13 21" aria-hidden="true"><path d="M11 2L2.5 10.5 11 19" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>${UI.esc(etiqueta)}</a>
        <h1>${UI.esc(titulo)}</h1>
        <button type="button" class="salir">Salir</button>`;
      h.querySelector(".salir").onclick = () => { if (confirm(`¿Cerrar la sesión de ${u.nombre}?`)) salir(raiz); };
      document.body.prepend(h);
      const grande = document.createElement("div");
      grande.className = "titulo-grande";
      grande.innerHTML = `<h2>${UI.esc(titulo)}</h2><p>${UI.esc(u.nombre)} · ${UI.esc(ROLES[u.rol] || u.rol)}</p>`;
      h.after(grande);
      if (DB.DEMO) {
        const d = document.createElement("div"); d.className = "liston-demo";
        d.textContent = "Modo demostración: los datos se guardan solo en este navegador.";
        grande.after(d);
      }
      // Al bajar, el título grande se esconde y aparece el chico en la barra (como iOS).
      if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => h.classList.toggle("con-linea", !e.isIntersecting), { rootMargin: "-50px 0px 0px 0px" }).observe(grande);
      else h.classList.add("con-linea");
    }
  };

  // Atletas que puede ver el usuario: el staff ve a todos; tutor y atleta, solo los suyos.
  async function atletasVisibles(u) {
    let lista;
    if (esStaff(u)) lista = await DB.listar("atletas");
    else lista = (await Promise.all((u.atletas || []).map((id) => DB.obtener("atletas", id).catch(() => null)))).filter(Boolean);
    return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  window.Sesion = { ROLES, puede, esAdmin, esOwner, esStaff, actual, requerir, salir, atletasVisibles,
    seccionDeGrupo, gruposDeSeccion, PROGRAMAS, programaDe, seccionesDe, gruposDe, seccionActual, param };
  window.UI = UI;
})();
