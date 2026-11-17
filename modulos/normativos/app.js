/* Normativos (como los de aguilaskc.net, con estilo de iPhone): qué domina cada atleta por aparato.
   Catálogo: catalogo-<sección>.json (aparato → clasificación → elementos con id estable "k" y referencia "ref" opcional),
   sin datos de atletas. GAV: el de AKC. GAF: fundamentos USAG + elementos A-C del Código FIG femenil (ver su campo fuente).
   Avances: normativos/<atletaId> = {estados: {<k>: "C"|"EP"|"P"|"NA"}, actualizado, por}. Sin registro = No adquirido.
   C Consolidado (dominado según el entrenador), EP En proceso, P Proyección (previsto para desarrollar), NA No adquirido.
   % dominio = consolidados ÷ elementos del catálogo (igual que la ficha del Excel de AKC).
   El staff marca (un coach, solo atletas de sus grupos); tutor y atleta ven lo suyo, sin editar. */
(async function () {
  const RAIZ = "../../";
  const u = await Sesion.requerir(RAIZ);
  const SEC = Sesion.seccionActual() || "GAV";
  UI.encabezado("Normativos " + SEC, RAIZ, u, RAIZ + SEC.toLowerCase() + "/");
  const app = document.getElementById("app");
  const esc = UI.esc;
  const staff = Sesion.esStaff(u);
  const ESTADOS = [
    { k: "C", t: "Consolidado", corto: "Cons.", color: "verde", c: "ok" },
    { k: "EP", t: "En proceso", corto: "Proceso", color: "naranja", c: "warn" },
    { k: "P", t: "Proyección", corto: "Proy.", color: "azul", c: "azul" },
    { k: "NA", t: "No adquirido", corto: "No", color: "rojo", c: "bad" }
  ];
  const EST = Object.fromEntries(ESTADOS.map((e) => [e.k, e]));

  let catalogo;
  try { catalogo = await (await fetch(`catalogo-${SEC.toLowerCase()}.json`, { cache: "no-cache" })).json(); }
  catch (e) { app.innerHTML = `<p class="vacio">Los normativos de ${esc(SEC)} todavía no están listos.</p>`; return; }
  const APARATOS = catalogo.aparatos;
  const elementosDe = (ap) => ap.clasificaciones.flatMap((c) => c.elementos);
  const TOTAL = APARATOS.reduce((s, a) => s + elementosDe(a).length, 0);

  // Atletas de la sección (activos); un coach, solo los de sus grupos.
  const mios = new Set(Sesion.gruposDe(u, SEC).map((g) => g.id));
  const atletas = (await Sesion.atletasVisibles(u)).filter((a) => a.activo !== false && Sesion.seccionDeGrupo(a.grupo) === SEC && (!staff || mios.has(a.grupo)));
  const docs = {};
  if (staff) (await DB.listar("normativos")).forEach((d) => (docs[d.id] = d));
  else await Promise.all(atletas.map(async (a) => { const d = await DB.obtener("normativos", a.id).catch(() => null); if (d) docs[a.id] = d; }));
  const estado = (id, k) => ((docs[id] || {}).estados || {})[k] || "NA";
  function cuenta(id, ap) {
    const lista = ap ? elementosDe(ap) : APARATOS.flatMap(elementosDe);
    const n = { C: 0, EP: 0, P: 0, NA: 0, total: lista.length };
    lista.forEach((e) => n[estado(id, e.k)]++);
    n.pct = n.total ? n.C / n.total : 0;
    return n;
  }
  const pct = (x) => Math.round(x * 100) + "%";
  const colorPct = (x) => (x >= 0.85 ? "ok" : x >= 0.6 ? "warn" : "bad");
  const iniciales = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  // Estilos propios del módulo (estado de cada elemento como control segmentado de colores).
  const st = document.createElement("style");
  st.textContent = `
    .seg-ap { display: flex; overflow-x: auto; scrollbar-width: none; margin-bottom: 14px; }
    .seg-ap::-webkit-scrollbar { display: none; }
    .seg-ap button { flex: 1 0 auto; min-width: 84px; }
    .avatar { flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: var(--relleno); color: var(--muted); font-size: 14px; font-weight: 600; }
    .elem { display: block !important; padding: 10px 16px !important; }
    .elem .ref { display: block; margin-top: 2px; font-size: 12px; color: var(--muted); }
    .elem .nom { display: flex; justify-content: space-between; gap: 10px; align-items: center; font-size: 16px; }
    .marcar { display: flex; gap: 2px; margin-top: 8px; padding: 2px; border-radius: 9px; background: var(--relleno); }
    .marcar button { flex: 1; min-height: 32px; border: 0; border-radius: 7px; background: transparent; color: var(--fg); font-size: 13px; font-weight: 500; cursor: pointer; }
    .marcar button[aria-pressed="true"] { color: #fff; font-weight: 600; box-shadow: 0 2px 6px rgba(0,0,0,.15); }
    ${ESTADOS.map((e) => `.marcar button[aria-pressed="true"][data-v="${e.k}"] { background: var(--${e.color}); }`).join("\n")}
    .etiqueta.azul { background: color-mix(in srgb, var(--azul) 16%, transparent); color: var(--azul); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 14px; }
    .chips button { border: 0; border-radius: 999px; padding: 7px 12px; background: var(--panel); color: var(--fg); font-size: 14px; cursor: pointer; }
    .chips button[aria-pressed="true"] { background: var(--fg); color: var(--bg); }
    .chips i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; }
    .barra-pct { height: 6px; border-radius: 3px; background: var(--relleno); overflow: hidden; margin-top: 6px; }
    .barra-pct span { display: block; height: 100%; background: var(--verde); }
    .volver-lista { display: inline-flex; align-items: center; gap: 4px; margin: 0 0 12px; padding: 0; border: 0; background: none; color: var(--tinte); font-size: 17px; cursor: pointer; }
    @media print { .marcar, .chips, .seg-ap, .volver-lista, .acciones-masa { display: none !important; } .elem .etiqueta.solo-print { display: inline-block !important; } }
  `;
  document.head.appendChild(st);

  // ---------- navegación interna: #a=<atletaId>&ap=<aparato> ----------
  let filtro = "all";
  function ruta() { const h = new URLSearchParams(location.hash.slice(1)); return { a: h.get("a"), ap: h.get("ap"), v: h.get("v") }; }
  function ir(obj) { location.hash = new URLSearchParams(Object.entries(obj).filter(([, v]) => v)).toString(); }
  window.addEventListener("hashchange", pintar);

  function pintar() {
    const r = ruta();
    if (!atletas.length) {
      app.innerHTML = `<p class="vacio">${staff ? "No hay atletas activos en tus grupos de " + esc(SEC) + ". Agrégalos en Herramientas → Registro de atletas." : "No hay atletas ligados a tu cuenta en " + esc(SEC) + "."}</p>`;
      return;
    }
    if (r.a && atletas.some((a) => a.id === r.a)) return vistaAtleta(r.a, r.ap);
    if (!staff && atletas.length === 1) return vistaAtleta(atletas[0].id, r.ap);
    if (staff && r.v === "resumen") return vistaResumen();
    vistaLista();
  }

  function segmentoVistas(actual) {
    return staff ? `<div class="pestanas" role="tablist">
      <button role="tab" aria-selected="${actual === "lista"}" data-ir="lista">Atletas</button>
      <button role="tab" aria-selected="${actual === "resumen"}" data-ir="resumen">Resumen del grupo</button></div>` : "";
  }
  function engancharVistas() {
    app.querySelectorAll("[data-ir]").forEach((b) => (b.onclick = () => ir(b.dataset.ir === "resumen" ? { v: "resumen" } : {})));
  }

  // ---------- lista de atletas (por grupo) ----------
  function vistaLista() {
    const porGrupo = {};
    atletas.forEach((a) => (porGrupo[a.grupo] = porGrupo[a.grupo] || []).push(a));
    app.innerHTML = segmentoVistas("lista") + Object.entries(porGrupo).map(([g, lista]) => `
      <div class="grupo-lista" style="padding:0"><h3>${esc(UI.grupo(g))}</h3><ul class="lista">
      ${lista.map((a) => { const n = cuenta(a.id); return `<li><a href="#a=${esc(a.id)}">
        <span class="avatar">${esc(iniciales(a.nombre))}</span>
        <span class="txt"><b>${esc(a.nombre)}</b><small>${pct(n.pct)} consolidado · ${n.EP} en proceso${a.nivel ? " · Nivel " + esc(a.nivel) : ""}</small>
          <span class="barra-pct"><span style="width:${pct(n.pct)}"></span></span></span>${UI.chevron}</a></li>`; }).join("")}
      </ul></div>`).join("") + `<p class="nota" style="margin:14px 4px 0">${TOTAL} elementos en ${APARATOS.length} aparatos.</p>`;
    engancharVistas();
  }

  // ---------- resumen del grupo: % consolidado por aparato ----------
  function vistaResumen() {
    app.innerHTML = segmentoVistas("resumen") + `<div class="panel"><h2>Consolidado por aparato</h2>
      <div class="tabla-wrap"><table><thead><tr><th>Atleta</th>${APARATOS.map((ap) => `<th class="num">${esc(ap.nombre)}</th>`).join("")}<th class="num">Total</th></tr></thead><tbody>
      ${atletas.map((a) => `<tr><td><a href="#a=${esc(a.id)}">${esc(a.nombre)}</a></td>${APARATOS.map((ap) => { const n = cuenta(a.id, ap); return `<td class="num">${pct(n.pct)}</td>`; }).join("")}
        <td class="num"><span class="etiqueta ${colorPct(cuenta(a.id).pct)}">${pct(cuenta(a.id).pct)}</span></td></tr>`).join("")}
      </tbody></table></div>
      <p class="nota">Porcentaje de elementos consolidados. Verde: 85% o más · Amarillo: 60% a 84% · Rojo: menos de 60%.</p>
      <div class="acciones no-imprimir"><button class="btn chico" onclick="print()">Imprimir</button></div></div>`;
    engancharVistas();
  }

  // ---------- ficha de un atleta ----------
  function vistaAtleta(id, apId) {
    const a = atletas.find((x) => x.id === id);
    const ap = APARATOS.find((x) => x.id === apId) || APARATOS[0];
    const n = cuenta(id, ap), nt = cuenta(id);
    const visibles = (e) => filtro === "all" || estado(id, e.k) === filtro;
    app.innerHTML = `
      ${staff || atletas.length > 1 ? `<button class="volver-lista no-imprimir" type="button" data-volver>‹ Todos los atletas</button>` : ""}
      <div class="panel">
        <div style="display:flex;align-items:center;gap:12px"><span class="avatar" style="width:48px;height:48px;font-size:18px">${esc(iniciales(a.nombre))}</span>
          <div style="flex:1;min-width:0"><h2 style="margin:0">${esc(a.nombre)}</h2><span class="nota">${esc(UI.grupo(a.grupo))}${a.nivel ? " · Nivel " + esc(a.nivel) : ""}</span></div>
          <div style="text-align:right"><b style="font-size:24px">${pct(nt.pct)}</b><br><span class="nota">dominio total</span></div></div>
        <div class="barra-pct" style="height:8px;margin-top:12px"><span style="width:${pct(nt.pct)}"></span></div>
      </div>
      <div class="pestanas seg-ap" role="tablist">${APARATOS.map((x) => `<button role="tab" aria-selected="${x.id === ap.id}" data-ap="${esc(x.id)}">${esc(x.nombre)}</button>`).join("")}</div>
      <div class="kpis">
        <div class="kpi"><span>Dominio en ${esc(ap.nombre)}</span><b>${pct(n.pct)}</b><small class="nota">${n.C} de ${n.total} consolidados</small></div>
        <div class="kpi"><span>Por trabajar</span><b>${n.EP + n.P}</b><small class="nota">${n.EP} en proceso · ${n.P} en proyección</small></div>
      </div>
      <div class="chips no-imprimir">
        <button aria-pressed="${filtro === "all"}" data-f="all">Todos · ${n.total}</button>
        ${ESTADOS.map((e) => `<button aria-pressed="${filtro === e.k}" data-f="${e.k}"><i style="background:var(--${e.color})"></i>${e.t} · ${n[e.k]}</button>`).join("")}
      </div>
      ${ap.clasificaciones.map((c) => { const els = c.elementos.filter(visibles); return els.length ? `
        <div class="grupo-lista" style="padding:0"><h3>${esc(c.nombre)}</h3><ul class="lista">
        ${els.map((e) => { const v = estado(id, e.k); return `<li><div class="fila-lista elem">
          <div class="nom"><span>${esc(e.n)}${e.ref ? `<small class="ref">${esc(e.ref)}</small>` : ""}</span>${staff ? `<span class="etiqueta ${EST[v].c} solo-print" style="display:none">${EST[v].t}</span>` : `<span class="etiqueta ${EST[v].c}">${EST[v].t}</span>`}</div>
          ${staff ? `<div class="marcar" role="group" aria-label="Estado de ${esc(e.n)}">${ESTADOS.map((x) => `<button type="button" data-k="${esc(e.k)}" data-v="${x.k}" aria-pressed="${v === x.k}" title="${x.t}">${x.corto}</button>`).join("")}</div>` : ""}
        </div></li>`; }).join("")}</ul></div>` : ""; }).join("") || `<p class="vacio">No hay elementos con ese filtro.</p>`}
      ${staff ? `<div class="panel acciones-masa" style="margin-top:20px"><div class="fila">
        <label>Marcar todos los elementos que se ven como <select id="masa">${ESTADOS.map((e) => `<option value="${e.k}">${e.t}</option>`).join("")}</select></label>
        <button class="btn" type="button" id="masa-ok">Aplicar</button></div></div>` : ""}
      <p class="nota" style="margin:16px 4px">Consolidado: lo domina según el entrenador · En proceso: se trabaja pero aún no lo domina · Proyección: previsto para desarrollar · No adquirido: aún no le sale.</p>
      <div class="acciones no-imprimir"><button class="btn chico" onclick="print()">Imprimir</button></div>`;

    app.querySelector("[data-volver]") && (app.querySelector("[data-volver]").onclick = () => ir(staff ? {} : {}));
    app.querySelectorAll("[data-ap]").forEach((b) => (b.onclick = () => ir({ a: id, ap: b.dataset.ap })));
    app.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { filtro = b.dataset.f; vistaAtleta(id, ap.id); }));
    if (!staff) return;
    app.querySelectorAll(".marcar button").forEach((b) => (b.onclick = () => guardar(id, { [b.dataset.k]: b.dataset.v }, ap.id)));
    $("masa-ok").onclick = () => {
      const v = $("masa").value, els = ap.clasificaciones.flatMap((c) => c.elementos).filter(visibles);
      if (!els.length || !confirm(`¿Marcar ${els.length} elemento(s) de ${ap.nombre} como «${EST[v].t}»?`)) return;
      guardar(id, Object.fromEntries(els.map((e) => [e.k, v])), ap.id);
    };
  }
  const $ = (x) => document.getElementById(x);

  // Guarda al momento (merge por elemento); si falla, regresa como estaba.
  async function guardar(id, cambios, apId) {
    const antes = { ...((docs[id] || {}).estados || {}) };
    docs[id] = { ...(docs[id] || {}), estados: { ...antes, ...cambios } };
    const y = scrollY; vistaAtleta(id, apId); scrollTo(0, y);
    try { await DB.guardar("normativos", id, { estados: cambios, actualizado: new Date().toISOString(), por: u.nombre }); }
    catch (x) { docs[id].estados = antes; vistaAtleta(id, apId); scrollTo(0, y); UI.aviso("No se guardó: " + x.message, true); }
  }

  pintar();
})();
