/* Asistencia: el staff toma lista por grupo y fecha; todos ven el tablero (tutor y atleta, solo lo suyo).
   Un registro por atleta y clase: asistencia/<fecha>_<grupo>_<atletaId> = {fecha, grupo, atletaId, estado}.
   Estados: P presente, R retardo, S salida temprana (los tres cuentan como asistencia), F falta, J falta justificada
   (cuenta como falta). Clase cancelada = sin registros (no cuenta ni como impartida ni como falta), como aguilaskc.net. */
(async function () {
  const RAIZ = "../../";
  const u = await Sesion.requerir(RAIZ);
  UI.encabezado("Asistencia", RAIZ, u);
  const app = document.getElementById("app");
  const esc = UI.esc;
  const ESTADOS = [
    { k: "P", t: "Presente", c: "ok" }, { k: "R", t: "Retardo", c: "warn" }, { k: "S", t: "Salió temprano", c: "warn" },
    { k: "F", t: "Falta", c: "bad" }, { k: "J", t: "Justificada", c: "gris" }
  ];
  const ASISTIO = new Set(["P", "R", "S"]);
  const staff = Sesion.puede.tomarAsistencia(u);
  let atletas = await Sesion.atletasVisibles(u);
  const porId = Object.fromEntries(atletas.map((a) => [a.id, a]));

  app.innerHTML = `
    ${staff ? `<div class="pestanas" role="tablist">
      <button role="tab" data-p="lista" aria-selected="true">Tomar lista</button>
      <button role="tab" data-p="tablero" aria-selected="false">Tablero</button></div>` : ""}
    <section id="p-lista" ${staff ? "" : "hidden"}></section>
    <section id="p-tablero" ${staff ? "hidden" : ""}></section>`;
  if (staff) {
    app.querySelector(".pestanas").onclick = (e) => {
      const b = e.target.closest("button[data-p]"); if (!b) return;
      app.querySelectorAll(".pestanas button").forEach((x) => x.setAttribute("aria-selected", x === b));
      document.getElementById("p-lista").hidden = b.dataset.p !== "lista";
      document.getElementById("p-tablero").hidden = b.dataset.p !== "tablero";
      if (b.dataset.p === "tablero") tablero();
    };
    tomarLista();
  } else tablero();

  // ---------------- Tomar lista ----------------
  function tomarLista() {
    const p = document.getElementById("p-lista");
    p.innerHTML = `
      <style>
        .alumno { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 0; border-bottom: 1px solid var(--line); }
        .alumno b { flex: 1 1 160px; }
        .marcas { display: flex; gap: 6px; flex-wrap: wrap; }
        .marcas button { min-width: 44px; height: 40px; padding: 0 10px; border-radius: 8px; border: 1.5px solid var(--line); background: var(--bg); cursor: pointer; font-weight: 700; }
        .marcas button[aria-pressed="true"].ok { background: var(--ok); border-color: var(--ok); color: #fff; }
        .marcas button[aria-pressed="true"].warn { background: var(--warn); border-color: var(--warn); color: #fff; }
        .marcas button[aria-pressed="true"].bad { background: var(--bad); border-color: var(--bad); color: #fff; }
        .marcas button[aria-pressed="true"].gris { background: var(--muted); border-color: var(--muted); color: #fff; }
        .leyenda { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: .82rem; color: var(--muted); margin: 6px 0 4px; }
      </style>
      <div class="panel">
        <div class="fila">
          <label>Fecha <input type="date" id="l-fecha" value="${UI.hoy()}"></label>
          <label>Grupo <select id="l-grupo">${CLUB.grupos.map((g) => `<option value="${esc(g.id)}">${esc(g.nombre)}</option>`).join("")}</select></label>
        </div>
        <div class="leyenda">${ESTADOS.map((e) => `<span><b>${e.k}</b> = ${e.t}</span>`).join("")}</div>
      </div>
      <div class="panel">
        <div class="fila" style="justify-content:space-between;align-items:center">
          <h2 style="margin:0" id="l-titulo"></h2>
          <button class="btn chico" type="button" id="l-todos">Todos presentes</button>
        </div>
        <div id="l-alumnos"></div>
        <p class="nota" id="l-estado"></p>
        <div class="acciones" style="margin-top:10px">
          <button class="btn peligro chico" type="button" id="l-cancelar">Clase cancelada</button>
          <button class="btn principal" type="button" id="l-guardar">Guardar lista</button>
        </div>
      </div>`;
    const $ = (id) => document.getElementById(id);
    let marcas = {}, previos = {};

    async function cargar() {
      const fecha = $("l-fecha").value, grupo = $("l-grupo").value;
      if (!fecha) return;
      const delGrupo = atletas.filter((a) => a.grupo === grupo && a.activo !== false);
      const regs = await DB.listar("asistencia", [["fecha", "==", fecha], ["grupo", "==", grupo]]);
      previos = {}; regs.forEach((r) => { previos[r.atletaId] = r.estado; });
      marcas = { ...previos };
      // Atletas que tienen registro ese día aunque ya no estén en el grupo
      const extra = regs.map((r) => porId[r.atletaId]).filter((a) => a && !delGrupo.includes(a));
      const lista = delGrupo.concat(extra);
      $("l-titulo").textContent = `${UI.grupo(grupo)} · ${UI.fecha(fecha)}`;
      $("l-alumnos").innerHTML = lista.length ? lista.map((a) => `
        <div class="alumno" data-id="${esc(a.id)}"><b>${esc(a.nombre)}</b>
          <div class="marcas" role="group" aria-label="Asistencia de ${esc(a.nombre)}">
            ${ESTADOS.map((e) => `<button type="button" class="${e.c}" data-k="${e.k}" title="${e.t}" aria-pressed="${marcas[a.id] === e.k}">${e.k}</button>`).join("")}
          </div></div>`).join("")
        : `<p class="vacio">No hay atletas activos en este grupo. Agrégalos en Equipo.</p>`;
      $("l-estado").textContent = regs.length ? `Lista guardada antes (${regs.length} registros). Puedes corregirla.` : "Aún no se ha tomado lista.";
    }
    $("l-alumnos").onclick = (e) => {
      const b = e.target.closest("button[data-k]"); if (!b) return;
      const id = b.closest(".alumno").dataset.id;
      marcas[id] = marcas[id] === b.dataset.k ? undefined : b.dataset.k;
      b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.k === marcas[id]));
    };
    $("l-todos").onclick = () => {
      $("l-alumnos").querySelectorAll(".alumno").forEach((f) => {
        if (!marcas[f.dataset.id]) marcas[f.dataset.id] = "P";
        f.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.k === marcas[f.dataset.id]));
      });
    };
    const docId = (fecha, grupo, id) => `${fecha}_${grupo}_${id}`;
    $("l-guardar").onclick = async () => {
      const fecha = $("l-fecha").value, grupo = $("l-grupo").value;
      const ids = [...$("l-alumnos").querySelectorAll(".alumno")].map((f) => f.dataset.id);
      const sinMarcar = ids.filter((id) => !marcas[id]);
      if (sinMarcar.length && !confirm(`${sinMarcar.length} atleta(s) sin marcar no se guardarán. ¿Continuar?`)) return;
      const ops = [];
      ids.forEach((id) => {
        if (marcas[id]) ops.push({ tipo: "guardar", col: "asistencia", id: docId(fecha, grupo, id), unir: false,
          datos: { fecha, grupo, atletaId: id, estado: marcas[id], por: u.uid, actualizado: new Date().toISOString() } });
        else if (previos[id]) ops.push({ tipo: "borrar", col: "asistencia", id: docId(fecha, grupo, id) });
      });
      $("l-guardar").disabled = true;
      try { await DB.lote(ops); UI.aviso("Lista guardada."); await cargar(); }
      catch (x) { UI.aviso("No se pudo guardar: " + x.message, true); }
      finally { $("l-guardar").disabled = false; }
    };
    $("l-cancelar").onclick = async () => {
      const fecha = $("l-fecha").value, grupo = $("l-grupo").value;
      if (!confirm(`¿Marcar la clase de ${UI.grupo(grupo)} del ${UI.fecha(fecha)} como cancelada? Se borra su lista: no cuenta como clase impartida ni como falta.`)) return;
      try { await DB.lote(Object.keys(previos).map((id) => ({ tipo: "borrar", col: "asistencia", id: docId(fecha, grupo, id) }))); UI.aviso("Clase marcada como cancelada."); await cargar(); }
      catch (x) { UI.aviso("No se pudo: " + x.message, true); }
    };
    $("l-fecha").onchange = cargar; $("l-grupo").onchange = cargar;
    cargar();
  }

  // ---------------- Tablero ----------------
  async function tablero() {
    const p = document.getElementById("p-tablero");
    if (!p.dataset.listo) {
      p.dataset.listo = "1";
      const hoy = UI.hoy();
      p.innerHTML = `
        <div class="panel no-imprimir"><div class="fila">
          <label>Periodo <select id="t-tipo"><option value="mes">Mes</option><option value="anio">Año</option></select></label>
          <label id="t-mes-l">Mes <input type="month" id="t-mes" value="${hoy.slice(0, 7)}"></label>
          <label id="t-anio-l" hidden>Año <input type="number" id="t-anio" value="${hoy.slice(0, 4)}" min="2020" max="2100"></label>
          ${staff ? `<label>Grupo <select id="t-grupo"><option value="">Todos</option>${CLUB.grupos.map((g) => `<option value="${esc(g.id)}">${esc(g.nombre)}</option>`).join("")}</select></label>` : ""}
          <button class="btn chico" type="button" onclick="print()">Imprimir</button>
        </div></div>
        <div class="kpis" id="t-kpis"></div>
        <div class="panel"><h2 id="t-titulo">Asistencia individual</h2>
          <p class="nota">Verde: 85% o más · Amarillo: 70% a 84% · Rojo: menos de 70%. Retardos y salidas tempranas cuentan como asistencia; las justificadas cuentan como falta; las clases canceladas no cuentan.</p>
          <div class="tabla-wrap" id="t-tabla"></div></div>
        <div id="t-detalle"></div>`;
      const $ = (id) => document.getElementById(id);
      $("t-tipo").onchange = () => { $("t-mes-l").hidden = $("t-tipo").value !== "mes"; $("t-anio-l").hidden = $("t-tipo").value === "mes"; tablero(); };
      ["t-mes", "t-anio", "t-grupo"].forEach((id) => $(id) && ($(id).onchange = tablero));
    }
    const $ = (id) => document.getElementById(id);
    const tipo = $("t-tipo").value;
    const desde = tipo === "mes" ? $("t-mes").value + "-01" : $("t-anio").value + "-01-01";
    const hasta = tipo === "mes" ? $("t-mes").value + "-31" : $("t-anio").value + "-12-31";
    const grupo = staff ? $("t-grupo").value : "";
    let regs;
    if (staff) regs = await DB.listar("asistencia", [["fecha", ">=", desde], ["fecha", "<=", hasta]]);
    else regs = (await Promise.all((u.atletas || []).map((id) => DB.listar("asistencia", [["atletaId", "==", id]])))).flat()
      .filter((r) => r.fecha >= desde && r.fecha <= hasta);
    if (grupo) regs = regs.filter((r) => r.grupo === grupo);

    const por = {};
    regs.forEach((r) => {
      const o = por[r.atletaId] || (por[r.atletaId] = { id: r.atletaId, ses: 0, asis: 0, faltas: 0, just: 0, ret: 0, sal: 0, regs: [] });
      o.ses++; o.regs.push(r);
      if (ASISTIO.has(r.estado)) o.asis++; else o.faltas++;
      if (r.estado === "J") o.just++; if (r.estado === "R") o.ret++; if (r.estado === "S") o.sal++;
    });
    const filas = Object.values(por).map((o) => ({ ...o, nombre: (porId[o.id] || {}).nombre || "(atleta borrado)", pct: o.ses ? o.asis / o.ses : null }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    const T = filas.reduce((t, o) => { t.ses += o.ses; t.asis += o.asis; t.ret += o.ret; t.sal += o.sal; return t; }, { ses: 0, asis: 0, ret: 0, sal: 0 });
    const pct = (x) => (x == null ? "—" : Math.round(x * 100) + "%");
    const color = (x) => (x == null ? "gris" : x >= CLUB.asistencia.verde ? "ok" : x >= CLUB.asistencia.amarillo ? "warn" : "bad");
    const periodo = tipo === "mes" ? UI.nombreMes($("t-mes").value) : $("t-anio").value;

    $("t-kpis").innerHTML = `
      <div class="kpi"><span>Asistencia</span><b>${pct(T.ses ? T.asis / T.ses : null)}</b></div>
      <div class="kpi"><span>Clases asistidas</span><b>${T.asis}</b><small class="nota">de ${T.ses} registradas</small></div>
      <div class="kpi"><span>Retardos</span><b>${T.ret}</b></div>
      <div class="kpi"><span>Salidas tempranas</span><b>${T.sal}</b></div>`;
    $("t-titulo").textContent = `Asistencia individual · ${periodo}`;
    $("t-tabla").innerHTML = filas.length ? `<table><thead><tr><th>Atleta</th><th class="num">Clases</th><th class="num">Asistidas</th>
      <th class="num">Faltas</th><th class="num">Justif.</th><th class="num">Retardos</th><th class="num">Salidas</th><th class="num">Asistencia</th></tr></thead><tbody>
      ${filas.map((o) => `<tr><td>${esc(o.nombre)}</td><td class="num">${o.ses}</td><td class="num">${o.asis}</td><td class="num">${o.faltas}</td>
        <td class="num">${o.just}</td><td class="num">${o.ret}</td><td class="num">${o.sal}</td>
        <td class="num"><span class="etiqueta ${color(o.pct)}">${pct(o.pct)}</span></td></tr>`).join("")}</tbody></table>`
      : `<p class="vacio">No hay asistencia registrada en ${esc(periodo)}.</p>`;

    // Tutor y atleta: detalle por día.
    $("t-detalle").innerHTML = staff ? "" : filas.map((o) => `
      <div class="panel"><h2>${esc(o.nombre)} · día por día</h2><div class="tabla-wrap"><table><tbody>
      ${o.regs.sort((a, b) => b.fecha.localeCompare(a.fecha)).map((r) => { const e = ESTADOS.find((x) => x.k === r.estado) || { t: r.estado, c: "gris" };
        return `<tr><td>${UI.fecha(r.fecha)}</td><td>${esc(UI.grupo(r.grupo))}</td><td class="num"><span class="etiqueta ${e.c}">${e.t}</span></td></tr>`; }).join("")}
      </tbody></table></div></div>`).join("");
  }
})();
