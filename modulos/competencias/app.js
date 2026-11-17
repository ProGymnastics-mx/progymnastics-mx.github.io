/* Competencias (como «Subir información de competencia» de la App GAV de AKC, con estilo de iPhone). Solo staff.
   competencias/<id> = {nombre, fecha, sede, seccion, creado, podio: {L: {nombre, ef}, O: {nombre, ef}}}
   resultados/<copaId>__<atletaId> = {copaId, copa, fecha, atletaId, nombre, grupo, nivel, tipo, cat, lugar, part,
     np: {AP: NP del juez}, nf: {AP: nota final}, ref: {AP: NP de la rutina}}  (un documento por atleta: su papá lo puede leer)
   La NP de la rutina sale de rutinas_vista/<atletaId>, que publica el Editor de rutinas. Reglas de eficiencia: js/eficiencia.js. */
(async function () {
  const RAIZ = "../../";
  const u = await Sesion.requerir(RAIZ, "publicar");
  const SEC = Sesion.seccionActual() || "GAV";
  UI.encabezado("Competencias " + SEC, RAIZ, u, RAIZ + SEC.toLowerCase() + "/");
  const app = document.getElementById("app");
  const esc = UI.esc, $ = (id) => document.getElementById(id);
  const E = PG_EFIC.seccion(SEC); // aparatos y cortes de la sección (GAV o GAF)

  const mios = new Set(Sesion.gruposDe(u, SEC).map((g) => g.id));
  const atletas = (await Sesion.atletasVisibles(u)).filter((a) => a.activo !== false && Sesion.seccionDeGrupo(a.grupo) === SEC && mios.has(a.grupo));
  const vistas = {}; (await DB.listar("rutinas_vista").catch(() => [])).forEach((v) => (vistas[v.id] = v));
  let copas = [], resultados = [];

  async function cargarCopas() {
    copas = (await DB.listar("competencias")).filter((c) => (c.seccion || "GAV") === SEC)
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  }
  const ruta = () => { const h = new URLSearchParams(location.hash.slice(1)); return { c: h.get("c"), v: h.get("v") || "captura" }; };
  const ir = (o) => (location.hash = new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString());
  window.addEventListener("hashchange", pintar);

  app.innerHTML = `<div id="vista"></div>
    <dialog id="dlg-copa"><form method="dialog" id="f-copa">
      <h2>Nueva copa</h2>
      <label>Nombre <input id="c-nombre" required maxlength="120" placeholder="Ej. Copa Estatal 2027"></label>
      <div class="fila"><label>Fecha <input type="date" id="c-fecha" required></label><label>Sede <input id="c-sede" maxlength="80"></label></div>
      <div class="acciones"><button class="btn" value="cancelar" formnovalidate>Cancelar</button><button class="btn principal" value="ok">Crear</button></div>
    </form></dialog>
    <dialog id="dlg-res"><form method="dialog" id="f-res"></form></dialog>`;

  async function pintar() {
    const r = ruta();
    const copa = copas.find((c) => c.id === r.c);
    if (!copa) return vistaCopas();
    resultados = (await DB.listar("resultados", [["copaId", "==", copa.id]])).filter((x) => x.atletaId);
    r.v === "concentrado" ? vistaConcentrado(copa) : vistaCaptura(copa);
  }

  // ---------- lista de copas ----------
  function vistaCopas() {
    $("vista").innerHTML = `
      <div class="acciones" style="justify-content:flex-start;margin-bottom:8px"><button class="btn principal" type="button" id="b-copa">+ Nueva copa</button></div>
      ${copas.length ? `<div class="grupo-lista" style="padding:0"><h3>Copas de ${esc(SEC)}</h3><ul class="lista">${copas.map((c) => `
        <li><a href="#c=${esc(c.id)}"><span class="icono" style="background:var(--morado)">${UI.icono("trofeo")}</span>
          <span class="txt"><b>${esc(c.nombre)}</b><small>${esc(UI.fecha(c.fecha))}${c.sede ? " · " + esc(c.sede) : ""}${c.podio && c.podio.L ? " · Más eficiente: " + esc(c.podio.L.nombre) : ""}</small></span>${UI.chevron}</a></li>`).join("")}</ul></div>`
        : `<p class="vacio">Aún no hay copas. Crea la primera para capturar resultados.</p>`}`;
    $("b-copa").onclick = () => { $("f-copa").reset(); $("c-fecha").value = UI.hoy(); $("dlg-copa").showModal(); };
  }
  $("f-copa").addEventListener("submit", async (ev) => {
    if (ev.submitter && ev.submitter.value !== "ok") return;
    ev.preventDefault();
    try {
      const id = await DB.guardar("competencias", null, { nombre: $("c-nombre").value.trim(), fecha: $("c-fecha").value, sede: $("c-sede").value.trim(), seccion: SEC, creado: new Date().toISOString(), por: u.nombre });
      $("dlg-copa").close(); await cargarCopas(); ir({ c: id });
    } catch (x) { UI.aviso("No se pudo crear: " + x.message, true); }
  });

  function cabeceraCopa(copa, v) {
    return `<button class="btn chico no-imprimir" type="button" id="b-copas" style="margin-bottom:12px">‹ Copas</button>
      <div class="panel"><h2 style="margin:0">${esc(copa.nombre)}</h2><span class="nota">${esc(UI.fecha(copa.fecha))}${copa.sede ? " · " + esc(copa.sede) : ""} · ${resultados.length} atleta(s) con resultados</span></div>
      <div class="pestanas no-imprimir" role="tablist"><button role="tab" aria-selected="${v === "captura"}" data-v="captura">Capturar</button><button role="tab" aria-selected="${v === "concentrado"}" data-v="concentrado">Concentrado</button></div>`;
  }
  function engancharCabecera(copa) {
    $("b-copas").onclick = () => ir({});
    $("vista").querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => ir({ c: copa.id, v: b.dataset.v })));
  }

  // ---------- captura por atleta ----------
  function vistaCaptura(copa) {
    const porGrupo = {};
    atletas.forEach((a) => (porGrupo[a.grupo] = porGrupo[a.grupo] || []).push(a));
    $("vista").innerHTML = cabeceraCopa(copa, "captura") + (atletas.length ? Object.entries(porGrupo).map(([g, lista]) => `
      <div class="grupo-lista" style="padding:0"><h3>${esc(UI.grupo(g))}</h3><ul class="lista">${lista.map((a) => {
        const r = resultados.find((x) => x.atletaId === a.id), c = r && E.calcular(r);
        return `<li><a href="#" data-a="${esc(a.id)}"><span class="icono" style="background:var(--${c && c.n ? "verde" : "gris"})">${UI.icono(c && c.n ? "check" : "lapiz")}</span>
          <span class="txt"><b>${esc(a.nombre)}</b><small>${c && c.n ? `Eficiencia ${c.ef.toFixed(1)}% · AA ${c.aa.toFixed(3)} · ${c.n} aparato(s)` : "Sin capturar"}</small></span>${UI.chevron}</a></li>`;
      }).join("")}</ul></div>`).join("") : `<p class="vacio">No hay atletas activos de ${esc(SEC)} en tus grupos.</p>`)
      + (Sesion.esAdmin(u) ? `<div class="acciones no-imprimir" style="margin-top:24px"><button class="btn peligro chico" type="button" id="b-borrar-copa">Borrar copa</button></div>` : "");
    engancharCabecera(copa);
    $("vista").querySelectorAll("[data-a]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); abrirCaptura(copa, atletas.find((a) => a.id === b.dataset.a)); }));
    if ($("b-borrar-copa")) $("b-borrar-copa").onclick = async () => {
      if (!confirm(`¿Borrar «${copa.nombre}» y sus ${resultados.length} resultado(s)? No se puede deshacer.`)) return;
      try { await DB.lote([...resultados.map((r) => ({ tipo: "borrar", col: "resultados", id: r.id })), { tipo: "borrar", col: "competencias", id: copa.id }]); await cargarCopas(); ir({}); UI.aviso("Copa borrada."); }
      catch (x) { UI.aviso("No se pudo borrar: " + x.message, true); }
    };
  }

  function abrirCaptura(copa, a) {
    const r = resultados.find((x) => x.atletaId === a.id) || {};
    const v = vistas[a.id] || {};
    const nivel = r.nivel || v.nivel || a.nivel || "";
    const ref = { ...(v.np || {}), ...(r.ref || {}) };
    const num = (x) => (x == null || x === "" ? "" : x);
    $("f-res").innerHTML = `
      <h2>${esc(a.nombre)}</h2>
      <div class="fila"><label>Nivel <input id="r-nivel" value="${esc(nivel)}" maxlength="10" placeholder="Ej. 4, N9, FIG"></label>
        <label>Categoría <input id="r-cat" value="${esc(r.cat || "")}" maxlength="20"></label></div>
      <div class="tabla-wrap"><table style="font-size:14px"><thead><tr><th>Aparato</th><th class="num">Rutina</th><th class="num">NP juez</th><th class="num">NF</th><th class="num">%</th></tr></thead><tbody>
        ${E.APS.map(([k, l]) => `<tr><td>${l}</td><td class="num nota">${ref[k] > 0 ? Number(ref[k]).toFixed(1) : "—"}</td>
          <td class="num"><input data-np="${k}" inputmode="decimal" value="${num((r.np || {})[k])}" style="width:64px;min-width:0;padding:8px;text-align:right"></td>
          <td class="num"><input data-nf="${k}" inputmode="decimal" value="${num((r.nf || {})[k])}" style="width:70px;min-width:0;padding:8px;text-align:right"></td>
          <td class="num" data-p="${k}">—</td></tr>`).join("")}
      </tbody></table></div>
      <p class="nota" style="margin:0">Deja vacío el aparato que no presentó. La NP de la rutina sale del Editor de rutinas.</p>
      <div class="fila"><label>Lugar oficial (all around) <input id="r-lugar" inputmode="numeric" value="${esc(r.lugar || "")}"></label>
        <label>De cuántos <input id="r-part" inputmode="numeric" value="${esc(r.part || "")}"></label></div>
      <div class="kpis" style="margin:0"><div class="kpi"><span>AA</span><b id="r-aa">—</b></div><div class="kpi"><span>Eficiencia</span><b id="r-ef">—</b></div></div>
      <div class="acciones">${r.id ? `<button class="btn peligro" value="borrar" formnovalidate>Borrar</button>` : ""}<button class="btn" value="cancelar" formnovalidate>Cancelar</button><button class="btn principal" value="ok">Guardar</button></div>`;
    const leer = () => {
      const n = (s) => { const t = String(s || "").replace(",", ".").trim(); return t === "" ? null : Number(t); };
      const np = {}, nf = {};
      E.APS.forEach(([k]) => { const a1 = n($("f-res").querySelector(`[data-np="${k}"]`).value), b1 = n($("f-res").querySelector(`[data-nf="${k}"]`).value);
        if (a1 != null && b1 != null && !isNaN(a1) && !isNaN(b1)) { np[k] = a1; nf[k] = b1; } });
      const refUsado = Object.fromEntries(Object.entries(ref).filter(([k, x]) => np[k] != null && x != null));
      return { np, nf, ref: refUsado, nivel: $("r-nivel").value.trim(), cat: $("r-cat").value.trim(), lugar: n($("r-lugar").value), part: n($("r-part").value) };
    };
    const vivo = () => {
      const d = leer(), c = E.calcular(d), g = E.grupo(d.nivel);
      E.APS.forEach(([k]) => { const x = c.ap[k], td = $("f-res").querySelector(`[data-p="${k}"]`); td.innerHTML = x ? `<span class="etiqueta ${{ V: "ok", A: "warn", R: "bad" }[E.semPct(g, x.p)]}">${x.p.toFixed(1)}%</span>` : "—"; });
      $("r-aa").textContent = c.n ? c.aa.toFixed(3) : "—"; $("r-ef").textContent = c.n ? c.ef.toFixed(1) + "%" : "—";
    };
    $("f-res").oninput = vivo; vivo();
    $("f-res").onsubmit = async (ev) => {
      const accion = ev.submitter && ev.submitter.value;
      if (accion === "cancelar") return;
      ev.preventDefault();
      const id = `${copa.id}__${a.id}`;
      try {
        if (accion === "borrar") { if (!confirm("¿Borrar el resultado de " + a.nombre + "?")) return; await DB.borrar("resultados", id); }
        else {
          const d = leer();
          if (!Object.keys(d.np).length) return UI.aviso("Escribe la NP del juez y la NF de al menos un aparato.", true);
          await DB.guardar("resultados", id, { ...d, copaId: copa.id, copa: copa.nombre, fecha: copa.fecha, atletaId: a.id, nombre: a.nombre, grupo: a.grupo,
            tipo: E.grupo(d.nivel), actualizado: new Date().toISOString(), por: u.nombre }, { unir: false });
        }
        $("dlg-res").close();
        resultados = (await DB.listar("resultados", [["copaId", "==", copa.id]])).filter((x) => x.atletaId);
        await guardarPodio(copa); UI.aviso("Guardado."); vistaCaptura(copa);
      } catch (x) { UI.aviso("No se pudo guardar: " + x.message, true); }
    };
    $("dlg-res").showModal();
  }

  // «El más eficiente» de cada bloque queda en la copa: lo ven todos (papás incluidos) sin leer los resultados de otros.
  async function guardarPodio(copa) {
    const rk = E.ranking(resultados), p = {};
    ["L", "O"].forEach((g) => { const f = rk[g][0]; p[g] = f ? { nombre: f.r.nombre, ef: Math.round(f.calc.ef * 10) / 10, aa: Math.round(f.calc.aa * 1000) / 1000 } : null; });
    copa.podio = p;
    await DB.guardar("competencias", copa.id, { podio: p });
  }

  // ---------- concentrado con colores ----------
  function vistaConcentrado(copa) {
    const rk = E.ranking(resultados);
    const ganador = (g, t) => { const f = rk[g][0]; return f ? `<div class="kpi"><span>Más eficiente · ${t}</span><b style="font-size:20px">${esc(f.r.nombre)}</b><small class="nota">${f.calc.ef.toFixed(1)}% · AA ${f.calc.aa.toFixed(3)}</small></div>` : ""; };
    $("vista").innerHTML = cabeceraCopa(copa, "concentrado") + (resultados.length ? `
      <div class="kpis">${ganador("L", "Libres")}${ganador("O", "Obligatorios")}</div>
      ${E.concentrado(resultados, (r) => r.nombre)}
      <div class="acciones no-imprimir" style="margin-top:12px"><button class="btn chico" type="button" onclick="print()">Imprimir</button></div>`
      : `<p class="vacio">Aún no hay resultados capturados en esta copa.</p>`);
    engancharCabecera(copa);
  }

  await cargarCopas();
  pintar();
})();
