/* Calendario: competencias, eventos y días sin clase. El staff edita; todos ven.
   eventos/<id> = {fecha, fin, titulo, tipo, lugar, grupos[] ([] = todos), nota} */
(async function () {
  const RAIZ = "../../";
  const u = await Sesion.requerir(RAIZ);
  // ?s=GAV|GAF: fechas de esa sección y las de todo el club. eventos/<id>.seccion: "" = todo el club.
  const SEC = Sesion.seccionActual();
  UI.encabezado(SEC ? "Calendario " + SEC : "Calendario", RAIZ, u);
  const app = document.getElementById("app");
  const esc = UI.esc, $ = (id) => document.getElementById(id);
  const edita = Sesion.puede.publicar(u);
  const TIPOS = { Competencia: "bad", Evento: "warn", "Sin clase": "gris", Otro: "ok" };
  let gruposMios = null;
  if (!Sesion.esStaff(u)) gruposMios = new Set((await Sesion.atletasVisibles(u)).map((a) => a.grupo));
  let eventos = [];

  app.innerHTML = `
    <div class="panel no-imprimir"><div class="fila" style="align-items:center">
      <label style="flex-direction:row;align-items:center;gap:8px;flex:1"><input type="checkbox" id="c-pasados" style="width:auto"> Ver también los pasados</label>
      ${edita ? `<button class="btn principal" type="button" id="b-nuevo">+ Agregar</button>` : ""}
    </div></div>
    <div id="lista"></div>
    <dialog id="dlg"><form method="dialog" id="fe">
      <h2 id="fe-titulo">Evento</h2>
      <label>Título <input id="e-titulo" required maxlength="120"></label>
      <div class="fila"><label>Tipo <select id="e-tipo">${Object.keys(TIPOS).map((t) => `<option>${t}</option>`).join("")}</select></label>
        <label>Lugar <input id="e-lugar" maxlength="120"></label></div>
      <div class="fila"><label>Desde <input type="date" id="e-fecha" required></label><label>Hasta (opcional) <input type="date" id="e-fin"></label></div>
      <fieldset style="border:1px solid var(--line);border-radius:8px"><legend class="nota">Grupos (ninguno = ${SEC ? "toda la sección" : "todo el club"})</legend>
        ${Sesion.gruposDeSeccion(SEC).map((g) => `<label style="flex-direction:row;align-items:center;gap:8px;font-weight:500"><input type="checkbox" value="${esc(g.id)}" style="width:auto"> ${esc(g.nombre)}</label>`).join("")}</fieldset>
      ${SEC ? `<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="e-club" style="width:auto"> Para todo el club (GAV y GAF)</label>` : ""}
      <label>Nota <input id="e-nota" maxlength="300"></label>
      <div class="acciones"><button class="btn peligro" value="borrar" id="e-borrar" formnovalidate>Borrar</button><span style="flex:1"></span>
        <button class="btn" value="cancelar" formnovalidate>Cancelar</button><button class="btn principal" value="ok">Guardar</button></div>
    </form></dialog>`;

  function pintar() {
    const hoy = UI.hoy(), pasados = $("c-pasados").checked;
    let vis = eventos.filter((e) => pasados || (e.fin || e.fecha) >= hoy);
    if (gruposMios) vis = vis.filter((e) => !(e.grupos || []).length || e.grupos.some((g) => gruposMios.has(g)));
    if (SEC) vis = vis.filter((e) => !e.seccion || e.seccion === SEC);
    vis.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const porMes = {};
    vis.forEach((e) => (porMes[e.fecha.slice(0, 7)] = porMes[e.fecha.slice(0, 7)] || []).push(e));
    $("lista").innerHTML = Object.keys(porMes).length ? Object.entries(porMes).map(([m, es]) => `
      <div class="panel"><h2>${esc(UI.nombreMes(m))}</h2><div class="tabla-wrap"><table><tbody>
      ${es.map((e) => `<tr><td style="white-space:nowrap">${esc(UI.fecha(e.fecha))}${e.fin && e.fin !== e.fecha ? ` – ${esc(UI.fecha(e.fin))}` : ""}</td>
        <td><b>${esc(e.titulo)}</b>${e.lugar ? `<br><small class="nota">${esc(e.lugar)}</small>` : ""}${e.nota ? `<br><small class="nota">${esc(e.nota)}</small>` : ""}</td>
        <td><span class="etiqueta ${TIPOS[e.tipo] || "gris"}">${esc(e.tipo)}</span><br><small class="nota">${(e.grupos || []).length ? e.grupos.map((g) => esc(UI.grupo(g))).join(", ") : e.seccion ? "Todo " + esc(e.seccion) : "Todo el club"}</small></td>
        ${edita ? `<td class="num no-imprimir"><button class="btn chico" data-editar="${esc(e.id)}">Editar</button></td>` : ""}</tr>`).join("")}
      </tbody></table></div></div>`).join("") : `<p class="vacio">No hay fechas próximas.</p>`;
  }
  async function cargar() { eventos = await DB.listar("eventos"); pintar(); }
  $("c-pasados").onchange = pintar;

  if (edita) {
    let editando = null;
    const abrir = (e) => {
      editando = e ? e.id : null; $("fe").reset();
      $("fe-titulo").textContent = e ? "Editar" : "Agregar al calendario";
      $("e-titulo").value = e ? e.titulo : ""; $("e-tipo").value = e ? e.tipo : "Competencia"; $("e-lugar").value = e ? e.lugar || "" : "";
      $("e-fecha").value = e ? e.fecha : ""; $("e-fin").value = e ? e.fin || "" : ""; $("e-nota").value = e ? e.nota || "" : "";
      $("fe").querySelectorAll("fieldset input").forEach((i) => (i.checked = !!e && (e.grupos || []).includes(i.value)));
      if ($("e-club")) $("e-club").checked = !!e && !e.seccion;
      $("e-borrar").hidden = !e; $("dlg").showModal();
    };
    $("b-nuevo").onclick = () => abrir(null);
    $("lista").onclick = (ev) => { const b = ev.target.closest("[data-editar]"); if (b) abrir(eventos.find((e) => e.id === b.dataset.editar)); };
    $("fe").addEventListener("submit", async (ev) => {
      const v = ev.submitter && ev.submitter.value;
      if (v === "cancelar") return;
      ev.preventDefault();
      try {
        if (v === "borrar") { if (!confirm("¿Borrar esta fecha?")) return; await DB.borrar("eventos", editando); }
        else {
          const fecha = $("e-fecha").value, fin = $("e-fin").value;
          if (fin && fin < fecha) return UI.aviso("«Hasta» no puede ser antes de «Desde».", true);
          await DB.guardar("eventos", editando, { titulo: $("e-titulo").value.trim(), tipo: $("e-tipo").value, lugar: $("e-lugar").value.trim(),
            fecha, fin: fin || "", nota: $("e-nota").value.trim(), grupos: [...$("fe").querySelectorAll("fieldset input:checked")].map((i) => i.value),
            seccion: SEC && !($("e-club") && $("e-club").checked) ? SEC : "" }, { unir: false });
        }
        $("dlg").close(); UI.aviso("Guardado."); cargar();
      } catch (x) { UI.aviso("No se pudo guardar: " + x.message, true); }
    });
  }
  cargar();
})();
