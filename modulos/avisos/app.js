/* Avisos: el staff publica; todos leen.
   avisos/<id> = {titulo, texto, seccion ("" = todo el club, "GAV", "GAF"), grupo ("" = toda la sección), programa ("" = todos),
     autor, autorUid, fecha}. Con «Avisar en la app» se crea además notificaciones/<id> con destino = {seccion, grupo, programa}
     y la tarea automática lo manda a la app de esas familias. Al publicar (y con «WhatsApp» en cada aviso) se abre la lista de
     familias con su botón de WhatsApp y «Copiar mensaje» para el grupo del club (Manu, 23-nov-2026: sin correo).
   Con ?s=GAV se ven los de GAV y los de todo el club. */
(async function () {
  const RAIZ = "../../";
  const u = await Sesion.requerir(RAIZ);
  const SEC = Sesion.seccionActual();
  UI.encabezado(SEC ? "Avisos " + SEC : "Avisos", RAIZ, u);
  const app = document.getElementById("app");
  const esc = UI.esc, $ = (id) => document.getElementById(id);
  const publica = Sesion.puede.publicar(u);
  let gruposMios = null;
  let mios = null;
  if (!Sesion.esStaff(u)) { mios = await Sesion.atletasVisibles(u); gruposMios = new Set(mios.map((a) => a.grupo)); }
  // ¿Le toca a alguno de mis atletas?
  const meToca = (a) => mios.some((x) => (!a.grupo || x.grupo === a.grupo) && (!a.seccion || Sesion.seccionDeGrupo(x.grupo) === a.seccion) && (!a.programa || Sesion.programaDe(x) === a.programa));

  app.innerHTML = `
    ${publica ? `<div class="panel"><button class="btn principal" type="button" id="b-nuevo">+ Publicar aviso</button></div>` : ""}
    <div id="lista"></div>
    <dialog id="dlg"><form method="dialog" id="fa">
      <h2>Nuevo aviso</h2>
      <label>Título <input id="a-titulo" required maxlength="120"></label>
      <div class="fila"><label>Para <select id="a-grupo">${SEC ? `<option value="S">Todo ${esc(SEC)}</option>` : ""}<option value="">Todo el club</option>${UI.opcionesGrupos(Sesion.gruposDeSeccion(SEC))}</select></label>
        <label>Programa <select id="a-prog"><option value="">Todos</option>${Sesion.PROGRAMAS.map((x) => `<option>${esc(x)}</option>`).join("")}</select></label></div>
      <label>Texto <textarea id="a-texto" required maxlength="4000"></textarea></label>
      <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="a-notif" style="width:auto" checked> Avisar en la app de las familias</label>
      <p class="nota" style="margin:0">Al publicar te sale la lista de familias para mandarlo también por WhatsApp.</p>
      <div class="acciones"><button class="btn" value="cancelar" formnovalidate>Cancelar</button><button class="btn principal" value="ok">Publicar</button></div>
    </form></dialog>`;

  let avisosVistos = [];
  // Familias a las que les toca un aviso, cada una con sus teléfonos (una familia con dos atletas en el grupo sale una vez).
  async function whatsappAviso(a) {
    const [atl, usu] = await Promise.all([DB.listar("atletas"), Sesion.esAdmin(u) ? DB.listar("usuarios").catch(() => []) : []]);
    const toca = atl.filter((x) => x.activo !== false && (!a.grupo || x.grupo === a.grupo) && (!a.seccion || Sesion.seccionDeGrupo(x.grupo) === a.seccion) && (!a.programa || Sesion.programaDe(x) === a.programa));
    const familias = [];
    toca.sort((x, y) => x.nombre.localeCompare(y.nombre, "es")).forEach((x) => {
      const ds = WA.destinos(x, usu), f = familias.find((g) => g.destinos.some((d) => ds.some((e) => WA.numero(e.tel) === WA.numero(d.tel))));
      if (f) { f.nombres.push(x.nombre); ds.forEach((e) => { if (!f.destinos.some((d) => WA.numero(d.tel) === WA.numero(e.tel))) f.destinos.push(e); }); }
      else familias.push({ nombres: [x.nombre], destinos: ds });
    });
    const texto = `*${CLUB.nombre}*\n*${a.titulo}*\n${a.texto}\n\nMás avisos en la app: ${WA.appUrl()}`;
    WA.mostrar({ titulo: "Mandar por WhatsApp", copiar: texto,
      nota: `${familias.length} familia(s) · ${a.grupo ? UI.grupo(a.grupo) : a.seccion ? "Todo " + a.seccion : "Todo el club"}${a.programa ? " · " + a.programa : ""}. Toca cada botón o copia el mensaje para el grupo del club.`,
      envios: familias.map((f) => ({ titulo: f.nombres.join(", "), texto, destinos: f.destinos })) });
  }
  async function cargar() {
    let avisos = await DB.listar("avisos");
    if (mios) avisos = avisos.filter(meToca);
    if (SEC) avisos = avisos.filter((a) => (!a.seccion || a.seccion === SEC) && (!a.grupo || Sesion.seccionDeGrupo(a.grupo) === SEC));
    avisos.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    avisosVistos = avisos;
    $("lista").innerHTML = avisos.length ? avisos.map((a) => `
      <article class="panel">
        <div class="fila" style="justify-content:space-between;align-items:start"><h2 style="margin:0;text-transform:none;letter-spacing:0;font-size:1.1rem">${esc(a.titulo)}</h2>
          <span style="display:flex;gap:6px">${publica ? `<button class="btn chico" data-wa-aviso="${esc(a.id)}">WhatsApp</button>` : ""}${Sesion.esAdmin(u) || a.autorUid === u.uid ? `<button class="btn chico peligro" data-borrar="${esc(a.id)}" aria-label="Borrar aviso">✕</button>` : ""}</span></div>
        <p class="nota" style="margin:4px 0 10px">${esc(UI.fecha(a.fecha))} · ${esc(a.autor || "")} · ${a.grupo ? esc(UI.grupo(a.grupo)) : a.seccion ? "Todo " + esc(a.seccion) : "Todo el club"}${a.programa ? " · " + esc(a.programa) : ""}</p>
        <p style="white-space:pre-wrap;margin:0">${esc(a.texto)}</p>
      </article>`).join("") : `<p class="vacio">No hay avisos.</p>`;
  }
  if (publica) {
    $("b-nuevo").onclick = () => { $("fa").reset(); $("dlg").showModal(); };
    $("fa").addEventListener("submit", async (ev) => {
      if (ev.submitter && ev.submitter.value !== "ok") return;
      ev.preventDefault();
      try {
        const g = $("a-grupo").value;
        const aviso = { titulo: $("a-titulo").value.trim(), texto: $("a-texto").value.trim(), grupo: ["", "S"].includes(g) ? "" : g,
          seccion: g === "" ? "" : g === "S" ? SEC : Sesion.seccionDeGrupo(g), programa: $("a-prog").value,
          autor: u.nombre, autorUid: u.uid, fecha: new Date().toISOString() };
        const id = await DB.guardar("avisos", null, aviso);
        if ($("a-notif").checked) await DB.guardar("notificaciones", "aviso_" + id, { tipo: "aviso", avisoId: id, titulo: aviso.titulo, texto: aviso.texto,
          push: "Nuevo aviso: " + aviso.titulo.slice(0, 80), url: "modulos/avisos/" + (aviso.seccion ? "?s=" + aviso.seccion : ""),
          destino: { seccion: aviso.seccion, grupo: aviso.grupo, programa: aviso.programa }, autorUid: u.uid, creado: aviso.fecha, estado: "pendiente" });
        $("dlg").close(); UI.aviso($("a-notif").checked ? "Aviso publicado. Llega a la app en unos minutos." : "Aviso publicado."); cargar();
        whatsappAviso(aviso);
      } catch (x) { UI.aviso("No se pudo publicar: " + x.message, true); }
    });
  }
  $("lista").onclick = async (e) => {
    const w = e.target.closest("[data-wa-aviso]");
    if (w) return whatsappAviso(avisosVistos.find((x) => x.id === w.dataset.waAviso));
    const b = e.target.closest("[data-borrar]"); if (!b || !confirm("¿Borrar este aviso?")) return;
    try { await DB.borrar("avisos", b.dataset.borrar); cargar(); } catch (x) { UI.aviso("No se pudo borrar: " + x.message, true); }
  };
  cargar();
})();
