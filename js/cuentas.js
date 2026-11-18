/* Cuentas con usuario y contraseña que crea Administración (Manu, 18-nov-2026: «al dar de alta me diga su usuario y
   contraseña para entrar a la app, con el perfil que quiero»).
   - Firebase Auth pide un correo: la cuenta usa <usuario>@DOMINIO_USUARIOS (dominio .invalid, que no existe: nunca se le
     manda nada). El correo real de la persona se guarda aparte en pg_usuarios.correo y es al que llegan los avisos.
   - Se crea con una segunda instancia de Firebase ("alta") para no cerrar la sesión de quien da el alta: Administración
     deja la invitación (pg_invitaciones/<correo de la cuenta>), la cuenta nueva se crea a sí misma su pg_usuarios igual a la
     invitación (la misma regla del primer ingreso) y borra la invitación.
   - Contraseña nueva: Administración la deja en pg_claves/<uid> y la tarea de notificaciones (cada 15 min) la aplica. */
window.Cuentas = (function () {
  const DOMINIO = "usuarios.progymnastics.invalid";
  const P = window.COLECCION_PREFIJO || "";
  const sinAcentos = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const correoDe = (usuario) => String(usuario).trim().toLowerCase() + "@" + DOMINIO;
  const esInterno = (email) => String(email || "").toLowerCase().endsWith("@" + DOMINIO);
  // Lo que escribe la persona en el login: usuario o correo.
  const loginDe = (texto) => { const t = String(texto || "").trim().toLowerCase(); return t.includes("@") ? t : correoDe(t); };
  const valido = (usuario) => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(usuario);

  // Sugerencia: nombre.apellido (sin acentos ni espacios), con número si ya existe.
  function sugerir(nombre, ocupados) {
    const p = sinAcentos(nombre).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    let base = p.length > 1 ? p[0] + "." + p[1] : p[0] || "usuario";
    base = base.slice(0, 24); if (base.length < 3) base = (base + "pg").slice(0, 3) + "pg";
    const usados = new Set([...(ocupados || [])].map((x) => String(x).toLowerCase()));
    let u = base, n = 2;
    while (usados.has(u)) u = base + n++;
    return u;
  }
  // Contraseña fácil de dictar: palabra + 4 números (sin letras que se confunden).
  function clave() {
    const palabras = ["Salto", "Barra", "Viga", "Piso", "Anillo", "Arzon", "Giro", "Mortal", "Rueda", "Paloma", "Vela", "Puente", "Split", "Medalla", "Podio"];
    const r = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
    return palabras[r(palabras.length)] + "-" + String(1000 + r(9000));
  }

  const MENSAJES = { "auth/email-already-in-use": "Ese usuario ya existe: elige otro.", "auth/invalid-email": "El usuario solo puede llevar letras, números, punto, guion y guion bajo.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.", "auth/network-request-failed": "Sin conexión a internet." };

  // datos = {usuario, clave, nombre, rol, atletas, secciones, grupos, telefono, correo}; regresa el uid.
  async function crear(datos, yo) {
    const usuario = String(datos.usuario || "").trim().toLowerCase();
    if (!valido(usuario)) throw new Error("Usuario no válido: de 3 a 30 letras o números (también . _ -), sin espacios ni acentos.");
    const email = correoDe(usuario);
    const perfil = { nombre: datos.nombre, rol: datos.rol, atletas: datos.atletas || [], secciones: datos.secciones || [], grupos: datos.grupos || [] };
    const extra = { usuario, telefono: datos.telefono || "", correo: (datos.correo || "").trim().toLowerCase(), creadoPor: yo ? yo.uid : "", desde: new Date().toISOString() };
    if (DB.DEMO) {
      const ya = await DB.listar("usuarios", [["usuario", "==", usuario]]);
      if (ya.length) throw new Error(MENSAJES["auth/email-already-in-use"]);
      return DB.guardar("usuarios", null, { ...perfil, ...extra, email, claveDemo: datos.clave });
    }
    await DB.guardar("invitaciones", email, { ...perfil, email, invitadoPor: extra.creadoPor, creado: extra.desde }, { unir: false });
    const app = firebase.initializeApp(window.FIREBASE_CONFIG, "alta-" + Date.now());
    if (window.PG_EMULADOR) window.PG_EMULADOR(app); // solo en pruebas locales
    try {
      await app.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);
      let cred;
      try { cred = await app.auth().createUserWithEmailAndPassword(email, datos.clave); }
      catch (e) { await DB.borrar("invitaciones", email).catch(() => {}); throw new Error(MENSAJES[e.code] || e.message); }
      const uid = cred.user.uid, fs = app.firestore();
      await fs.collection(P + "usuarios").doc(uid).set(JSON.parse(JSON.stringify({ ...perfil, ...extra, email })));
      await fs.collection(P + "invitaciones").doc(email).delete().catch(() => {});
      await app.auth().signOut();
      return uid;
    } finally { app.delete().catch(() => {}); }
  }

  // Contraseña nueva para una cuenta existente: la aplica la tarea de notificaciones (máximo ~15 min).
  async function nuevaClave(uid, yo) {
    const c = clave();
    if (DB.DEMO) { await DB.guardar("usuarios", uid, { claveDemo: c }); return c; }
    await DB.guardar("claves", uid, { clave: c, por: yo ? yo.uid : "", fecha: new Date().toISOString() }, { unir: false });
    return c;
  }

  // Ventana con los accesos recién creados: usuario, contraseña, Copiar y Compartir.
  function mostrar(lista, nota) {
    const url = location.origin + location.pathname.replace(/(modulos\/.*|admin\/.*|gav\/.*|gaf\/.*|index\.html)$/, "");
    const texto = (x) => `ProGymnastics México\nEntra en ${url}\nUsuario: ${x.usuario}\nContraseña: ${x.clave}`;
    let d = document.getElementById("dlg-cuentas");
    if (!d) { d = document.createElement("dialog"); d.id = "dlg-cuentas"; document.body.appendChild(d); }
    d.innerHTML = `<form method="dialog"><h2>Accesos a la app</h2>
      <p class="nota">${UI.esc(nota || "Compártelos con cada persona. La contraseña solo se ve ahora; si se pierde, se genera otra.")}</p>
      ${lista.map((x, i) => `<div class="panel" style="margin:8px 0">
        <p style="margin:0 0 6px"><strong>${UI.esc(x.nombre)}</strong> <span class="etiqueta gris">${UI.esc(Sesion.ROLES[x.rol] || x.rol)}</span></p>
        ${x.error ? `<p class="nota" style="color:var(--bad)">${UI.esc(x.error)}</p>` : x.ligado ? `<p class="nota">Ya tenía cuenta (usuario <strong>${UI.esc(x.usuario)}</strong>): se le agregó este atleta.</p>` : `
        <p style="margin:2px 0">Usuario: <strong style="font-family:ui-monospace,monospace">${UI.esc(x.usuario)}</strong></p>
        <p style="margin:2px 0">Contraseña: <strong style="font-family:ui-monospace,monospace">${UI.esc(x.clave)}</strong></p>
        <div class="fila" style="margin-top:8px"><button class="btn chico" type="button" data-copiar="${i}">Copiar</button>
          ${x.telefono ? `<a class="btn chico" target="_blank" rel="noopener" href="https://wa.me/${UI.esc(String(x.telefono).replace(/\D/g, "").replace(/^(\d{10})$/, "52$1"))}?text=${encodeURIComponent(texto(x))}">Enviar por WhatsApp</a>` : ""}
          ${navigator.share ? `<button class="btn chico" type="button" data-compartir="${i}">Compartir</button>` : ""}</div>`}</div>`).join("")}
      <div class="acciones"><span style="flex:1"></span><button class="btn principal" value="ok">Listo</button></div></form>`;
    d.onclick = async (e) => {
      const c = e.target.closest("[data-copiar]"), s = e.target.closest("[data-compartir]");
      if (c) { try { await navigator.clipboard.writeText(texto(lista[c.dataset.copiar])); UI.aviso("Copiado."); } catch (x) { UI.aviso("No se pudo copiar.", true); } }
      if (s) navigator.share({ text: texto(lista[s.dataset.compartir]) }).catch(() => {});
    };
    d.showModal();
  }

  return { DOMINIO, correoDe, esInterno, loginDe, valido, sugerir, clave, crear, nuevaClave, mostrar };
})();
