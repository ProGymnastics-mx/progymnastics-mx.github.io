/* Pagos.
   pagos/<id> = {atletaId, concepto, periodo "AAAA-MM", monto, fecha, metodo, referencia, nota, registradoPor, creado}
   La mensualidad de cada atleta es atletas/<id>.cuota (0 = beca o sin cuota).
   Estado del mes (solo concepto Mensualidad): Pagado, Parcial, Pendiente (aún no vence), Vencido (pasó el día límite).
   Administración (OWNER/ADMIN) ve y registra todo; tutor y atleta ven solo lo suyo. Los coaches no entran. */
(async function () {
  const RAIZ = "../../";
  const u = await Sesion.requerir(RAIZ);
  if (u.rol === "COACH") { location.href = RAIZ + "index.html"; return; }
  UI.encabezado("Pagos", RAIZ, u);
  const app = document.getElementById("app");
  const esc = UI.esc, $ = (id) => document.getElementById(id);
  const P = CLUB.pagos;
  const admin = Sesion.puede.pagosTodos(u);
  const atletas = await Sesion.atletasVisibles(u);
  const porId = Object.fromEntries(atletas.map((a) => [a.id, a]));

  const cuotaDe = (a) => (a.cuota != null && a.cuota !== "" ? Number(a.cuota) : Number(P.mensualidadBase) || 0);
  function vencio(periodo) {
    const mes = UI.mesActual();
    if (periodo < mes) return true;
    if (periodo > mes) return false;
    return new Date().getDate() > (Number(P.diaLimite) || 31);
  }
  // Mes en que el atleta entró al club: antes de eso no debe nada.
  const altaDe = (a) => a.desde || (a.creado || "").slice(0, 7) || "";
  function estadoMes(a, periodo, pagos) {
    if (altaDe(a) && periodo < altaDe(a)) return { k: "na", t: "Aún no inscrito", c: "gris", cuota: 0, pagado: 0, saldo: 0, recargo: 0 };
    const cuota = cuotaDe(a);
    const pagado = pagos.filter((p) => p.atletaId === a.id && p.periodo === periodo && p.concepto === "Mensualidad").reduce((s, p) => s + Number(p.monto || 0), 0);
    let e;
    if (cuota <= 0) e = { k: "beca", t: "Sin cuota", c: "gris" };
    else if (pagado >= cuota) e = { k: "pagado", t: "Pagado", c: "ok" };
    else if (vencio(periodo)) e = { k: "vencido", t: pagado > 0 ? "Parcial · vencido" : "Vencido", c: "bad" };
    else e = { k: "pendiente", t: pagado > 0 ? "Parcial" : "Pendiente", c: "warn" };
    const recargo = e.k === "vencido" && Number(P.recargo) > 0 ? Number(P.recargo) : 0;
    return { ...e, cuota, pagado, saldo: Math.max(0, cuota - pagado), recargo };
  }

  // ---------- Recibo imprimible ----------
  function recibo(p) {
    const a = porId[p.atletaId] || { nombre: "(atleta borrado)" };
    const w = window.open("", "_blank");
    if (!w) return UI.aviso("Permite ventanas emergentes para ver el recibo.", true);
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recibo ${esc(p.id)}</title>
      <style>body{font-family:system-ui,sans-serif;max-width:560px;margin:24px auto;padding:0 16px;color:#111;background:#fff}
      img{width:220px}h1{font-size:1.2rem;border-bottom:3px solid #ffcb0b;padding-bottom:6px}td{padding:6px 4px;border-bottom:1px solid #ddd}
      td:first-child{color:#555;width:40%}.total{font-size:1.4rem;font-weight:700}</style></head><body>
      <img src="${location.origin}${location.pathname.replace(/modulos\/pagos\/.*$/, "")}img/logo-ancho.jpg" alt="ProGymnastics México">
      <h1>Recibo de pago</h1><table>
      <tr><td>Atleta</td><td>${esc(a.nombre)}</td></tr>
      <tr><td>Concepto</td><td>${esc(p.concepto)} · ${esc(UI.nombreMes(p.periodo))}</td></tr>
      <tr><td>Fecha de pago</td><td>${esc(UI.fecha(p.fecha))}</td></tr>
      <tr><td>Método</td><td>${esc(p.metodo)}${p.referencia ? " · " + esc(p.referencia) : ""}</td></tr>
      <tr><td>Folio</td><td>${esc(p.id)}</td></tr>
      <tr><td>Monto</td><td class="total">${UI.dinero(p.monto)}</td></tr></table>
      ${p.nota ? `<p>${esc(p.nota)}</p>` : ""}<p style="color:#555;font-size:.85rem">${esc(CLUB.nombre)}</p>
      <script>onload=()=>print()<\/script></body></html>`);
    w.document.close();
  }

  // ---------- Vista de tutor / atleta ----------
  if (!admin) {
    const pagos = (await Promise.all(atletas.map((a) => DB.listar("pagos", [["atletaId", "==", a.id]])))).flat();
    const meses = []; { const d = new Date(); d.setDate(1); for (let i = 0; i < 6; i++) { meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); d.setMonth(d.getMonth() - 1); } }
    app.innerHTML = (P.datosParaPagar ? `<div class="panel"><h2>Cómo pagar</h2><p style="white-space:pre-wrap;margin:0">${esc(P.datosParaPagar)}</p></div>` : "") +
      (atletas.length ? atletas.map((a) => {
        const mios = pagos.filter((p) => p.atletaId === a.id).sort((x, y) => (y.fecha || "").localeCompare(x.fecha || ""));
        const e = estadoMes(a, UI.mesActual(), pagos);
        return `<div class="panel"><h2>${esc(a.nombre)}</h2>
          <div class="kpis"><div class="kpi"><span>Mensualidad</span><b>${UI.dinero(e.cuota)}</b></div>
            <div class="kpi"><span>${esc(UI.nombreMes(UI.mesActual()))}</span><b><span class="etiqueta ${e.c}">${e.t}</span></b>
              ${e.saldo && e.cuota ? `<small class="nota">Saldo ${UI.dinero(e.saldo)}${e.recargo ? ` + recargo ${UI.dinero(e.recargo)}` : ""} · vence el día ${P.diaLimite}</small>` : ""}</div></div>
          <h2 style="font-size:.85rem">Últimos meses</h2>
          <div class="tabla-wrap"><table><tbody>${meses.filter((m) => !altaDe(a) || m >= altaDe(a)).map((m) => { const x = estadoMes(a, m, pagos);
            return `<tr><td>${esc(UI.nombreMes(m))}</td><td class="num">${UI.dinero(x.pagado)}</td><td class="num"><span class="etiqueta ${x.c}">${x.t}</span></td></tr>`; }).join("")}</tbody></table></div>
          <h2 style="font-size:.85rem;margin-top:14px">Pagos registrados</h2>
          ${mios.length ? `<div class="tabla-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Monto</th><th></th></tr></thead><tbody>
            ${mios.map((p) => `<tr><td>${esc(UI.fecha(p.fecha))}</td><td>${esc(p.concepto)} · ${esc(UI.nombreMes(p.periodo))}</td><td class="num">${UI.dinero(p.monto)}</td>
            <td class="num"><button class="btn chico" data-recibo="${esc(p.id)}">Recibo</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="vacio">Aún no hay pagos registrados.</p>`}
        </div>`; }).join("") : `<p class="vacio">Tu cuenta no tiene atletas ligados. Pídelo a Administración.</p>`);
    app.onclick = (ev) => { const b = ev.target.closest("[data-recibo]"); if (b) recibo(pagos.find((p) => p.id === b.dataset.recibo)); };
    return;
  }

  // ---------- Vista de Administración ----------
  app.innerHTML = `
    <div class="pestanas" role="tablist">
      <button role="tab" data-p="mes" aria-selected="true">Mensualidades</button>
      <button role="tab" data-p="hist" aria-selected="false">Pagos del mes</button>
    </div>
    <div class="panel no-imprimir"><div class="fila">
      <label>Mes <input type="month" id="f-mes" value="${UI.mesActual()}"></label>
      <label>Grupo <select id="f-grupo"><option value="">Todos</option>${CLUB.grupos.map((g) => `<option value="${esc(g.id)}">${esc(g.nombre)}</option>`).join("")}</select></label>
      <label>Estado <select id="f-estado"><option value="">Todos</option><option value="pendiente">Pendientes</option><option value="vencido">Vencidos</option><option value="pagado">Pagados</option><option value="beca">Sin cuota</option></select></label>
      <button class="btn principal" type="button" id="b-nuevo">+ Registrar pago</button>
    </div></div>
    <div class="kpis" id="kpis"></div>
    <div class="panel" id="v-mes"></div>
    <div class="panel" id="v-hist" hidden></div>

    <dialog id="dlg"><form method="dialog" id="fp">
      <h2>Registrar pago</h2>
      <label>Atleta <select id="p-atleta" required>${atletas.map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)}${a.activo === false ? " (baja)" : ""}</option>`).join("")}</select></label>
      <div class="fila"><label>Concepto <select id="p-concepto">${P.conceptos.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
        <label>Mes que cubre <input type="month" id="p-periodo" required></label></div>
      <div class="fila"><label>Monto <input type="number" id="p-monto" min="0" step="0.01" inputmode="decimal" required></label>
        <label>Fecha de pago <input type="date" id="p-fecha" required></label></div>
      <div class="fila"><label>Método <select id="p-metodo">${P.metodos.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
        <label>Referencia / folio <input id="p-ref" maxlength="80"></label></div>
      <label>Nota <input id="p-nota" maxlength="200"></label>
      <div class="acciones"><button class="btn" value="cancelar" formnovalidate>Cancelar</button><button class="btn principal" value="ok" id="p-ok">Guardar</button></div>
    </form></dialog>`;

  let pagosMes = [], vista = "mes";
  app.querySelector(".pestanas").onclick = (e) => {
    const b = e.target.closest("button[data-p]"); if (!b) return;
    vista = b.dataset.p;
    app.querySelectorAll(".pestanas button").forEach((x) => x.setAttribute("aria-selected", x === b));
    $("v-mes").hidden = vista !== "mes"; $("v-hist").hidden = vista !== "hist"; pintar();
  };
  ["f-mes", "f-grupo", "f-estado"].forEach((id) => ($(id).onchange = id === "f-mes" ? cargar : pintar));

  async function cargar() {
    pagosMes = await DB.listar("pagos", [["periodo", "==", $("f-mes").value]]);
    pintar();
  }
  function pintar() {
    const mes = $("f-mes").value, grupo = $("f-grupo").value, fe = $("f-estado").value;
    const conPago = (a) => pagosMes.some((p) => p.atletaId === a.id);
    const lista = atletas.filter((a) => ((a.activo !== false && !(altaDe(a) && mes < altaDe(a))) || conPago(a)) && (!grupo || a.grupo === grupo));
    const filas = lista.map((a) => ({ a, e: estadoMes(a, mes, pagosMes) }));
    const esperado = filas.reduce((s, f) => s + f.e.cuota, 0);
    const cobradoMens = filas.reduce((s, f) => s + Math.min(f.e.pagado, f.e.cuota || f.e.pagado), 0);
    const ids = new Set(lista.map((a) => a.id));
    const cobradoTotal = pagosMes.filter((p) => ids.has(p.atletaId)).reduce((s, p) => s + Number(p.monto || 0), 0);
    const n = (k) => filas.filter((f) => f.e.k === k).length;
    $("kpis").innerHTML = `
      <div class="kpi"><span>Mensualidades esperadas</span><b>${UI.dinero(esperado)}</b></div>
      <div class="kpi"><span>Mensualidades cobradas</span><b>${UI.dinero(cobradoMens)}</b><small class="nota">${esperado ? Math.round((cobradoMens / esperado) * 100) : 0}%</small></div>
      <div class="kpi"><span>Por cobrar</span><b>${UI.dinero(Math.max(0, esperado - cobradoMens))}</b><small class="nota">${n("pendiente")} pendientes · ${n("vencido")} vencidos</small></div>
      <div class="kpi"><span>Ingresos del mes</span><b>${UI.dinero(cobradoTotal)}</b><small class="nota">todos los conceptos</small></div>`;

    const vis = filas.filter((f) => !fe || f.e.k === fe);
    $("v-mes").innerHTML = `<div class="fila" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h2 style="margin:0">Mensualidades · ${esc(UI.nombreMes(mes))}</h2>
      <span class="no-imprimir" style="display:flex;gap:6px"><button class="btn chico" id="b-csv">Descargar CSV</button><button class="btn chico" onclick="print()">Imprimir</button></span></div>
      ${vis.length ? `<div class="tabla-wrap"><table><thead><tr><th>Atleta</th><th class="col-grupo">Grupo</th><th class="num">Cuota</th><th class="num">Pagado</th><th class="num">Saldo</th><th>Estado</th><th class="no-imprimir"></th></tr></thead><tbody>
      ${vis.map(({ a, e }) => `<tr><td>${esc(a.nombre)}</td><td class="col-grupo">${esc(UI.grupo(a.grupo))}</td><td class="num">${UI.dinero(e.cuota)}</td><td class="num">${UI.dinero(e.pagado)}</td>
        <td class="num">${UI.dinero(e.saldo)}${e.recargo ? `<br><small class="nota">+ ${UI.dinero(e.recargo)} recargo</small>` : ""}</td><td><span class="etiqueta ${e.c}">${e.t}</span></td>
        <td class="num no-imprimir">${e.saldo > 0 ? `<button class="btn chico" data-cobrar="${esc(a.id)}">Cobrar</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="vacio">${atletas.length ? "Nadie con ese filtro." : "Aún no hay atletas. Agrégalos en Equipo."}</p>`}`;

    const hist = pagosMes.filter((p) => !grupo || (porId[p.atletaId] || {}).grupo === grupo).sort((x, y) => (y.fecha || "").localeCompare(x.fecha || ""));
    $("v-hist").innerHTML = `<h2>Pagos que corresponden a ${esc(UI.nombreMes(mes))}</h2>
      ${hist.length ? `<div class="tabla-wrap"><table><thead><tr><th>Fecha</th><th>Atleta</th><th>Concepto</th><th>Método</th><th class="num">Monto</th><th class="no-imprimir"></th></tr></thead><tbody>
      ${hist.map((p) => `<tr><td>${esc(UI.fecha(p.fecha))}</td><td>${esc((porId[p.atletaId] || {}).nombre || "(borrado)")}</td><td>${esc(p.concepto)}</td>
        <td>${esc(p.metodo)}${p.referencia ? `<br><small class="nota">${esc(p.referencia)}</small>` : ""}</td><td class="num">${UI.dinero(p.monto)}</td>
        <td class="num no-imprimir" style="white-space:nowrap"><button class="btn chico" data-recibo="${esc(p.id)}">Recibo</button> <button class="btn chico peligro" data-borrar="${esc(p.id)}" aria-label="Borrar pago">✕</button></td></tr>`).join("")}</tbody></table></div>`
      : `<p class="vacio">No hay pagos registrados para este mes.</p>`}`;

    const csv = $("b-csv");
    if (csv) csv.onclick = () => {
      const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
      const txt = "﻿Atleta,Grupo,Cuota,Pagado,Saldo,Estado\n" + vis.map(({ a, e }) => [a.nombre, UI.grupo(a.grupo), e.cuota, e.pagado, e.saldo, e.t].map(q).join(",")).join("\n");
      const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([txt], { type: "text/csv" })); link.download = `mensualidades_${mes}.csv`; link.click();
    };
  }

  function abrir(atletaId) {
    const mes = $("f-mes").value;
    $("fp").reset();
    if (atletaId) $("p-atleta").value = atletaId;
    $("p-periodo").value = mes; $("p-fecha").value = UI.hoy();
    const ponerMonto = () => {
      const a = porId[$("p-atleta").value];
      if (a && $("p-concepto").value === "Mensualidad") { const e = estadoMes(a, $("p-periodo").value, pagosMes); $("p-monto").value = e.saldo + e.recargo || ""; }
    };
    $("p-atleta").onchange = $("p-concepto").onchange = $("p-periodo").onchange = ponerMonto;
    ponerMonto();
    $("dlg").showModal();
  }
  $("b-nuevo").onclick = () => abrir();
  app.addEventListener("click", async (ev) => {
    const c = ev.target.closest("[data-cobrar]"), r = ev.target.closest("[data-recibo]"), b = ev.target.closest("[data-borrar]");
    if (c) abrir(c.dataset.cobrar);
    if (r) recibo(pagosMes.find((p) => p.id === r.dataset.recibo));
    if (b) {
      const p = pagosMes.find((x) => x.id === b.dataset.borrar);
      if (!confirm(`¿Borrar el pago de ${UI.dinero(p.monto)} de ${(porId[p.atletaId] || {}).nombre || ""}? No se puede deshacer.`)) return;
      try { await DB.borrar("pagos", p.id); UI.aviso("Pago borrado."); cargar(); } catch (x) { UI.aviso("No se pudo borrar: " + x.message, true); }
    }
  });
  $("fp").addEventListener("submit", async (ev) => {
    if (ev.submitter && ev.submitter.value !== "ok") return;
    ev.preventDefault();
    const monto = Number($("p-monto").value);
    if (!(monto > 0)) return UI.aviso("Escribe un monto mayor a cero.", true);
    const datos = { atletaId: $("p-atleta").value, concepto: $("p-concepto").value, periodo: $("p-periodo").value, monto,
      fecha: $("p-fecha").value, metodo: $("p-metodo").value, referencia: $("p-ref").value.trim(), nota: $("p-nota").value.trim(),
      registradoPor: u.uid, creado: new Date().toISOString() };
    $("p-ok").disabled = true;
    try {
      const id = await DB.guardar("pagos", null, datos);
      $("dlg").close(); UI.aviso(`Pago de ${UI.dinero(monto)} registrado.`);
      if (datos.periodo !== $("f-mes").value) $("f-mes").value = datos.periodo;
      await cargar();
      if (confirm("¿Imprimir recibo?")) recibo({ ...datos, id });
    } catch (x) { UI.aviso("No se pudo guardar: " + x.message, true); }
    finally { $("p-ok").disabled = false; }
  });
  cargar();
})();
