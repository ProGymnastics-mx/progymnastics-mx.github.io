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
    // Encabezado común de los módulos: volver, título, usuario y Salir.
    // "Volver" regresa a la página de la que se llegó: la sección (?s=GAV), Herramientas administrativas (?v=admin) o el inicio.
    encabezado(titulo, raiz, u, volver) {
      if (!volver) {
        const sec = seccionActual();
        volver = sec ? raiz + sec.toLowerCase() + "/" : param("v") === "admin" ? raiz + "admin/" : raiz + "index.html";
      }
      const h = document.createElement("header");
      h.className = "barra";
      h.innerHTML = `
        <a class="volver" href="${UI.esc(volver)}" aria-label="Volver">‹</a>
        <img class="mini-logo" src="${raiz}img/icono-192.png" alt="" width="36" height="36">
        <h1>${UI.esc(titulo)}</h1>
        <span class="quien">${UI.esc(u.nombre)}<small>${UI.esc(ROLES[u.rol] || u.rol)}</small></span>
        <button type="button" class="salir">Salir</button>`;
      h.querySelector(".salir").onclick = () => { if (confirm("¿Cerrar sesión?")) salir(raiz); };
      document.body.prepend(h);
      if (DB.DEMO) {
        const d = document.createElement("div"); d.className = "liston-demo";
        d.textContent = "Modo demostración: los datos se guardan solo en este navegador.";
        h.after(d);
      }
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
    seccionDeGrupo, gruposDeSeccion, seccionesDe, gruposDe, seccionActual, param };
  window.UI = UI;
})();
