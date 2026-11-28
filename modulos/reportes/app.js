/* Reportes para papás (y para el staff): una página por atleta con
   - Competencias: historial por copa (AA, eficiencia, lugar), detalle por aparato y su mejor nota en cada aparato;
   - Rutina actual: nota de partida por aparato (rutinas_vista/<atletaId>, la publica el Editor de rutinas);
   - Normativos: % consolidado por aparato (normativos/<atletaId> + catálogo de la sección);
   - Asistencia: mes actual y año.
   El staff ve a todos los de sus grupos; tutor y atleta, solo a los suyos (cada dato vive en documentos por atleta). */
(async function () {
  const RAIZ = "../../";
  const u = await Sesion.requerir(RAIZ);
  const SEC = Sesion.seccionActual() || "GAV";
  const staff = Sesion.esStaff(u);
  UI.encabezado(staff ? "Reportes " + SEC : "Mi reporte", RAIZ, u, RAIZ + SEC.toLowerCase() + "/");
  const app = document.getElementById("app");
  const esc = UI.esc, E = PG_EFIC.seccion(SEC);
  const mios = new Set(Sesion.gruposDe(u, SEC).map((g) => g.id));
  const atletas = (await Sesion.atletasVisibles(u)).filter((a) => a.activo !== false && Sesion.seccionDeGrupo(a.grupo) === SEC && (!staff || mios.has(a.grupo)));
  let catalogo = null;
  try { catalogo = await (await fetch(`../normativos/catalogo-${SEC.toLowerCase()}.json`, { cache: "no-cache" })).json(); } catch (e) {}
  const iniciales = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const pct = (x) => (x == null ? "—" : Math.round(x * 100) + "%");
  const SEM = { V: "ok", A: "warn", R: "bad" };

  const st = document.createElement("style");
  st.textContent = `
    .avatar { flex: none; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; background: var(--relleno); color: var(--muted); font-size: 18px; font-weight: 600; }
    .barras { display: grid; gap: 10px; }
    .barras .b { display: grid; grid-template-columns: 92px 1fr 46px; gap: 10px; align-items: center; font-size: 15px; }
    .barras .pista { height: 10px; border-radius: 5px; background: var(--relleno); overflow: hidden; }
    .barras .pista span { display: block; height: 100%; border-radius: 5px; background: var(--verde); }
    .barras .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    .copa summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
    .copa summary::-webkit-details-marker { display: none; }
    .copa summary .txt { flex: 1; min-width: 0; }
    .copa summary b { display: block; font-weight: 500; }
    .copa summary small { color: var(--muted); font-size: 13px; }
    .copa[open] summary .chevron { transform: rotate(90deg); }
    .copa .det { padding: 0 16px 14px; }
    .lista li + li .copa summary { border-top: .5px solid var(--line); }
    .mejor { color: var(--ok); font-weight: 700; }
    .tendencia { display: flex; align-items: flex-end; gap: 8px; height: 120px; padding-top: 6px; }
    .tendencia div { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 4px; font-size: 11px; color: var(--muted); min-width: 0; }
    .tendencia i { display: block; width: 100%; max-width: 38px; border-radius: 6px 6px 0 0; }
    .tendencia small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    @media print { .copa .det { display: block !important; } .volver-lista { display: none !important; } }
  `;
  document.head.appendChild(st);

  // Staff: listas desplegables Grupo/Nivel/Atleta y abajo solo los del grupo o nivel elegido (Manu, 28-nov-2026).
  const SEL_ITEMS = atletas.map((a) => ({ v: a.id, t: a.nombre, nivel: a.nivel, grupo: UI.grupo(a.grupo) }));
  const SEL_CLAVE = "pg-reportes-" + SEC;
  if (staff) SELATL.config(SEL_CLAVE, { alElegir: (v) => { location.hash = "a=" + encodeURIComponent(v); }, alCambiar: () => pintar() });
  const ruta = () => new URLSearchParams(location.hash.slice(1)).get("a");
  window.addEventListener("hashchange", pintar);

  function pintar() {
    if (!atletas.length) { app.innerHTML = `<p class="vacio">${staff ? "No hay atletas activos de " + esc(SEC) + " en tus grupos." : "No hay atletas ligados a tu cuenta en " + esc(SEC) + "."}</p>`; return; }
    const id = ruta();
    if (id && atletas.some((a) => a.id === id)) return reporte(id);
    if (!staff && atletas.length === 1) return reporte(atletas[0].id);
    const porGrupo = {};
    let lista = atletas;
    if (staff) { const ids = new Set(SELATL.filtrados(SEL_CLAVE, SEL_ITEMS).map((x) => x.v)); lista = atletas.filter((a) => ids.has(a.id)); }
    lista.forEach((a) => (porGrupo[a.grupo] = porGrupo[a.grupo] || []).push(a));
    app.innerHTML = (staff ? SELATL.html(SEL_CLAVE, SEL_ITEMS, { ordenGrupos: CLUB.grupos.map((g) => g.nombre) }) : "") + Object.entries(porGrupo).map(([g, lista]) => `
      <div class="grupo-lista" style="padding:0"><h3>${esc(UI.grupo(g))}</h3><ul class="lista">${lista.map((a) => `
        <li><a href="#a=${esc(a.id)}"><span class="avatar" style="width:36px;height:36px;font-size:14px">${esc(iniciales(a.nombre))}</span>
        <span class="txt"><b>${esc(a.nombre)}</b><small>${a.nivel ? "Nivel " + esc(a.nivel) : esc(UI.grupo(a.grupo))}</small></span>${UI.chevron}</a></li>`).join("")}</ul></div>`).join("");
  }

  async function reporte(id) {
    const a = atletas.find((x) => x.id === id);
    app.innerHTML = `<p class="vacio">Cargando el reporte de ${esc(a.nombre)}…</p>`;
    const [norm, vista, res, asis] = await Promise.all([
      DB.obtener("normativos", id).catch(() => null),
      DB.obtener("rutinas_vista", id).catch(() => null),
      DB.listar("resultados", [["atletaId", "==", id]]).catch(() => []),
      DB.listar("asistencia", [["atletaId", "==", id]]).catch(() => [])
    ]);
    res.sort((x, y) => (y.fecha || "").localeCompare(x.fecha || ""));
    const calc = res.map((r) => ({ r, c: E.calcular(r) })).filter((x) => x.c.n);

    // Mejor nota final por aparato (de todas sus copas).
    const mejor = {};
    calc.forEach(({ r, c }) => E.APS.forEach(([k]) => { const x = c.ap[k]; if (x && (!mejor[k] || x.nf > mejor[k].nf)) mejor[k] = { nf: x.nf, copa: r.copa }; }));
    const ult = calc[0];

    // Normativos
    let normHTML = `<p class="nota">Aún sin evaluar.</p>`, normTotal = null, etapaHTML = "";
    if (catalogo) {
      const est = (norm && norm.estados) || {};
      let tc = 0, tt = 0;
      const filas = catalogo.aparatos.map((ap) => { const els = ap.clasificaciones.flatMap((c) => c.elementos); const c = els.filter((e) => est[e.k] === "C").length; tc += c; tt += els.length; return { n: ap.nombre, p: els.length ? c / els.length : 0 }; });
      normTotal = tt ? tc / tt : null;
      if (norm) normHTML = `<div class="barras">${filas.map((f) => `<div class="b"><span>${esc(f.n)}</span><span class="pista"><span style="width:${pct(f.p)}"></span></span><span class="num">${pct(f.p)}</span></div>`).join("")}</div>`;
      // ¿En qué etapa va? Por aparato: la primera clasificación (en el orden del catálogo, de lo básico a lo avanzado) con menos
      // del 80 % consolidado es la que está trabajando; se listan sus elementos en proceso y en proyección.
      if (norm) etapaHTML = `<ul class="lista">${catalogo.aparatos.map((ap) => {
        const actual = ap.clasificaciones.find((c) => c.elementos.filter((e) => est[e.k] === "C").length < 0.8 * c.elementos.length);
        if (!actual) return `<li><div class="fila-lista"><span class="icono" style="background:var(--verde)">${UI.icono("check")}</span><span class="txt"><b>${esc(ap.nombre)}</b><small>Domina todas las etapas de los normativos.</small></span></div></li>`;
        const c = actual.elementos.filter((e) => est[e.k] === "C").length;
        const proc = actual.elementos.filter((e) => est[e.k] === "EP").map((e) => e.n), proy = actual.elementos.filter((e) => est[e.k] === "P").map((e) => e.n);
        const corto = (l) => l.slice(0, 3).map((x) => esc(x.length > 60 ? x.slice(0, 58) + "…" : x)).join(" · ") + (l.length > 3 ? ` y ${l.length - 3} más` : "");
        return `<li><div class="fila-lista"><span class="icono" style="background:var(--indigo)">${UI.icono("lista")}</span><span class="txt"><b>${esc(ap.nombre)}: ${esc(actual.nombre)}</b>
          <small>${c} de ${actual.elementos.length} consolidados en esta etapa${proc.length ? ` · En proceso: ${corto(proc)}` : ""}${proy.length ? ` · Próximos: ${corto(proy)}` : ""}</small></span></div></li>`;
      }).join("")}</ul>`;
    }

    // Asistencia
    const asisDe = (desde) => { const rs = asis.filter((r) => r.fecha >= desde); const si = rs.filter((r) => ["P", "R", "S"].includes(r.estado)).length; return { n: rs.length, p: rs.length ? si / rs.length : null }; };
    const mes = asisDe(UI.mesActual() + "-01"), anio = asisDe(UI.hoy().slice(0, 4) + "-01-01");
    const semA = (p) => (p == null ? "gris" : p >= CLUB.asistencia.verde ? "ok" : p >= CLUB.asistencia.amarillo ? "warn" : "bad");

    // En GAF los normativos van primero (Manu: «en qué momento está su hija»); en GAV, al final.
    const PRIMERO_NORM = SEC === "GAF";
    const normBloque = (etapaHTML ? `<div class="grupo-lista" style="padding:0"><h3>¿En qué etapa va? (normativos)</h3>${etapaHTML}</div>` : "")
      + `<div class="grupo-lista" style="padding:0"><h3>Normativos (consolidado por aparato)</h3><div class="panel">${normHTML}</div></div>`;
    app.innerHTML = `
      ${staff || atletas.length > 1 ? `<a class="btn chico volver-lista" href="#" style="margin-bottom:12px">‹ Atletas</a>` : ""}
      <div class="panel" style="display:flex;align-items:center;gap:14px">
        <span class="avatar">${esc(iniciales(a.nombre))}</span>
        <div style="flex:1;min-width:0"><h2 style="margin:0">${esc(a.nombre)}</h2><span class="nota">${esc(UI.grupo(a.grupo))}${a.nivel ? " · Nivel " + esc(a.nivel) : ""} · ${esc(UI.fecha(UI.hoy()))}</span></div>
      </div>

      <div class="kpis">
        <div class="kpi"><span>Última eficiencia</span><b>${ult ? ult.c.ef.toFixed(1) + "%" : "—"}</b><small class="nota">${ult ? esc(ult.r.copa) : "Sin competencias"}</small></div>
        <div class="kpi"><span>Último all around</span><b>${ult ? ult.c.aa.toFixed(3) : "—"}</b><small class="nota">${ult && ult.r.lugar ? `Lugar ${esc(ult.r.lugar)}${ult.r.part ? " de " + esc(ult.r.part) : ""}` : "&nbsp;"}</small></div>
        <div class="kpi"><span>Normativos</span><b>${pct(normTotal)}</b><small class="nota">consolidado</small></div>
        <div class="kpi"><span>Asistencia del mes</span><b><span class="etiqueta ${semA(mes.p)}" style="font-size:20px">${pct(mes.p)}</span></b><small class="nota">${mes.n} clase(s) · año ${pct(anio.p)}</small></div>
      </div>

${PRIMERO_NORM ? normBloque : ""}
      <div class="grupo-lista" style="padding:0"><h3>Competencias</h3>
        ${calc.length ? `<div class="panel" style="margin-bottom:12px"><div class="tendencia">${calc.slice(0, 8).reverse().map(({ r, c }) => `<div><b style="color:var(--fg)">${c.ef.toFixed(0)}%</b><i class="" style="height:${Math.max(6, c.ef)}%;background:var(--${{ V: "verde", A: "naranja", R: "rojo" }[E.semEf(c.ef)]})"></i><small>${esc(r.copa)}</small></div>`).join("")}</div>
          <p class="nota" style="margin:8px 0 0">Eficiencia en cada copa (NF ÷ nota de partida, promedio de los aparatos que presentó).</p></div>
        <ul class="lista">${calc.map(({ r, c }) => { const g = E.grupo(r.nivel, r.tipo); return `<li><details class="copa"><summary>
          <span class="icono" style="background:var(--morado)">${UI.icono("trofeo")}</span>
          <span class="txt"><b>${esc(r.copa)}</b><small>${esc(UI.fecha(r.fecha))} · ${esc(E.nivelTexto(r.nivel))} · AA ${c.aa.toFixed(3)}${r.lugar ? ` · ${esc(r.lugar)}° lugar` : ""}</small></span>
          <span class="etiqueta ${SEM[E.semEf(c.ef)]}">${c.ef.toFixed(1)}%</span>${UI.chevron}</summary>
          <div class="det tabla-wrap"><table><thead><tr><th>Aparato</th><th class="num">NP juez</th><th class="num">NF</th><th class="num">%</th></tr></thead><tbody>
          ${E.APS.map(([k, l]) => { const x = c.ap[k]; return x ? `<tr><td>${l}</td><td class="num">${x.np.toFixed(1)}</td><td class="num ${mejor[k] && mejor[k].nf === x.nf ? "mejor" : ""}">${x.nf.toFixed(3)}</td><td class="num"><span class="etiqueta ${SEM[E.semPct(g, x.p)]}">${x.p.toFixed(1)}%</span></td></tr>` : `<tr><td>${l}</td><td colspan="3" class="num nota">No presentó</td></tr>`; }).join("")}
          </tbody></table></div></details></li>`; }).join("")}</ul>` : `<div class="panel"><p class="nota" style="margin:0">Aún no hay resultados de competencias.</p></div>`}
      </div>

      ${calc.length ? `<div class="grupo-lista" style="padding:0"><h3>Mejor nota por aparato</h3><div class="panel"><div class="tabla-wrap"><table><tbody>
        ${E.APS.map(([k, l]) => `<tr><td>${l}</td><td class="num">${mejor[k] ? `<b class="mejor">${mejor[k].nf.toFixed(3)}</b>` : "—"}</td><td class="nota">${mejor[k] ? esc(mejor[k].copa) : ""}</td></tr>`).join("")}
      </tbody></table></div></div></div>` : ""}

      <div class="grupo-lista" style="padding:0"><h3>Rutina actual (nota de partida)</h3><div class="panel">
        ${vista ? `<div class="tabla-wrap"><table><tbody>${E.APS.map(([k, l]) => `<tr><td>${l}</td><td class="num">${vista.np && vista.np[k] > 0 ? Number(vista.np[k]).toFixed(1) : "—"}</td></tr>`).join("")}
          <tr><td><b>All around</b></td><td class="num"><b>${vista.aa != null ? Number(vista.aa).toFixed(1) : "—"}</b></td></tr></tbody></table></div>
          <p class="nota" style="margin:8px 0 0">${vista.tipo === "O" ? "Obligatorios" : "Libres"} · ${esc(E.nivelTexto(vista.nivel))} · actualizada ${esc(UI.fecha(vista.actualizado))}</p>`
          : `<p class="nota" style="margin:0">Su entrenador aún no captura su rutina.</p>`}
      </div></div>

${PRIMERO_NORM ? "" : normBloque}
      <div class="acciones no-imprimir" style="margin-top:20px"><button class="btn chico" type="button" onclick="print()">Imprimir reporte</button></div>`;
    const v = app.querySelector(".volver-lista"); if (v) v.onclick = (e) => { e.preventDefault(); location.hash = ""; };
  }

  pintar();
})();
