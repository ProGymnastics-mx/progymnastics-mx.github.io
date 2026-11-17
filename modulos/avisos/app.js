/* Avisos: el staff publica; todos leen. avisos/<id> = {titulo, texto, grupo ("" = todos), autor, autorUid, fecha} */
(async function () {
  const RAIZ = "../../";
  const u = await Sesion.requerir(RAIZ);
  UI.encabezado("Avisos", RAIZ, u);
  const app = document.getElementById("app");
  const esc = UI.esc, $ = (id) => document.getElementById(id);
  const publica = Sesion.puede.publicar(u);
  let gruposMios = null;
  if (!Sesion.esStaff(u)) gruposMios = new Set((await Sesion.atletasVisibles(u)).map((a) => a.grupo));

  app.innerHTML = `
    ${publica ? `<div class="panel"><button class="btn principal" type="button" id="b-nuevo">+ Publicar aviso</button></div>` : ""}
    <div id="lista"></div>
    <dialog id="dlg"><form method="dialog" id="fa">
      <h2>Nuevo aviso</h2>
      <label>Título <input id="a-titulo" required maxlength="120"></label>
      <label>Para <select id="a-grupo"><option value="">Todo el club</option>${CLUB.grupos.map((g) => `<option value="${esc(g.id)}">${esc(g.nombre)}</option>`).join("")}</select></label>
      <label>Texto <textarea id="a-texto" required maxlength="4000"></textarea></label>
      <div class="acciones"><button class="btn" value="cancelar" formnovalidate>Cancelar</button><button class="btn principal" value="ok">Publicar</button></div>
    </form></dialog>`;

  async function cargar() {
    let avisos = await DB.listar("avisos");
    if (gruposMios) avisos = avisos.filter((a) => !a.grupo || gruposMios.has(a.grupo));
    avisos.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    $("lista").innerHTML = avisos.length ? avisos.map((a) => `
      <article class="panel">
        <div class="fila" style="justify-content:space-between;align-items:start"><h2 style="margin:0;text-transform:none;letter-spacing:0;font-size:1.1rem">${esc(a.titulo)}</h2>
          ${Sesion.esAdmin(u) || a.autorUid === u.uid ? `<button class="btn chico peligro" data-borrar="${esc(a.id)}" aria-label="Borrar aviso">✕</button>` : ""}</div>
        <p class="nota" style="margin:4px 0 10px">${esc(UI.fecha(a.fecha))} · ${esc(a.autor || "")} · ${a.grupo ? esc(UI.grupo(a.grupo)) : "Todo el club"}</p>
        <p style="white-space:pre-wrap;margin:0">${esc(a.texto)}</p>
      </article>`).join("") : `<p class="vacio">No hay avisos.</p>`;
  }
  if (publica) {
    $("b-nuevo").onclick = () => { $("fa").reset(); $("dlg").showModal(); };
    $("fa").addEventListener("submit", async (ev) => {
      if (ev.submitter && ev.submitter.value !== "ok") return;
      ev.preventDefault();
      try {
        await DB.guardar("avisos", null, { titulo: $("a-titulo").value.trim(), texto: $("a-texto").value.trim(), grupo: $("a-grupo").value,
          autor: u.nombre, autorUid: u.uid, fecha: new Date().toISOString() });
        $("dlg").close(); UI.aviso("Aviso publicado."); cargar();
      } catch (x) { UI.aviso("No se pudo publicar: " + x.message, true); }
    });
  }
  $("lista").onclick = async (e) => {
    const b = e.target.closest("[data-borrar]"); if (!b || !confirm("¿Borrar este aviso?")) return;
    try { await DB.borrar("avisos", b.dataset.borrar); cargar(); } catch (x) { UI.aviso("No se pudo borrar: " + x.message, true); }
  };
  cargar();
})();
