/* Avisos: el staff publica; todos leen.
   avisos/<id> = {titulo, texto, seccion ("" = todo el club, "GAV", "GAF"), grupo ("" = toda la sección), programa ("" = todos),
     autor, autorUid, fecha}. Con «Enviar notificación» se crea además notificaciones/<id> con destino = {seccion, grupo, programa}:
     la tarea automática lo manda a la app, al correo y al WhatsApp de las familias de esos atletas (Manu, 18-nov-2026).
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
      <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="a-notif" style="width:auto" checked> Enviar notificación a las familias (app, correo y WhatsApp)</label>
      <div class="acciones"><button class="btn" value="cancelar" formnovalidate>Cancelar</button><button class="btn principal" value="ok">Publicar</button></div>
    </form></dialog>`;

  async function cargar() {
    let avisos = await DB.listar("avisos");
    if (mios) avisos = avisos.filter(meToca);
    if (SEC) avisos = avisos.filter((a) => (!a.seccion || a.seccion === SEC) && (!a.grupo || Sesion.seccionDeGrupo(a.grupo) === SEC));
    avisos.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    $("lista").innerHTML = avisos.length ? avisos.map((a) => `
      <article class="panel">
        <div class="fila" style="justify-content:space-between;align-items:start"><h2 style="margin:0;text-transform:none;letter-spacing:0;font-size:1.1rem">${esc(a.titulo)}</h2>
          ${Sesion.esAdmin(u) || a.autorUid === u.uid ? `<button class="btn chico peligro" data-borrar="${esc(a.id)}" aria-label="Borrar aviso">✕</button>` : ""}</div>
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
        $("dlg").close(); UI.aviso($("a-notif").checked ? "Aviso publicado. La notificación sale en unos minutos." : "Aviso publicado."); cargar();
      } catch (x) { UI.aviso("No se pudo publicar: " + x.message, true); }
    });
  }
  $("lista").onclick = async (e) => {
    const b = e.target.closest("[data-borrar]"); if (!b || !confirm("¿Borrar este aviso?")) return;
    try { await DB.borrar("avisos", b.dataset.borrar); cargar(); } catch (x) { UI.aviso("No se pudo borrar: " + x.message, true); }
  };
  cargar();
})();
