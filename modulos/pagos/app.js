/* Pagos.
   pagos/<id> = {atletaId, concepto, periodo "AAAA-MM", monto, fecha, hora "HH:MM", metodo, referencia, nota, registradoPor,
     registradoPorNombre, creado}
   «Enviar recordatorio» (Manu, 18-nov-2026: «si no ha pagado, que se le envíe»): notificaciones/<id> tipo "recordatorio" con
   periodo: la tarea automática lo manda a la app de la familia, y aquí mismo se abre WhatsApp con el mensaje listo para
   mamá y papá (js/whatsapp.js; Manu, 23-nov-2026: sin correo ni WhatsApp Business). El envío por WhatsApp se anota en
   notificaciones.whatsapp = {<número>: fecha}.
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
  const usuarios = admin ? await DB.listar("usuarios").catch(() => []) : []; // teléfonos de las cuentas ligadas (WhatsApp)

  // "18:05" → "6:05 p. m."
  const horaTxt = (h) => { if (!h) return ""; const [H, M] = h.split(":").map(Number); return `${H % 12 || 12}:${String(M).padStart(2, "0")} ${H < 12 ? "a. m." : "p. m."}`; };
  // Hora local de una fecha ISO ("2026-11-23T16:05:00Z" → "10:05 a. m." en México).
  const horaLocal = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : horaTxt(String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0")); };
  const cuandoTxt = (p) => UI.fecha(p.fecha) + (p.hora ? " · " + horaTxt(p.hora) : "");
  const ahoraHHMM = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
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
      <tr><td>Fecha de pago</td><td>${esc(cuandoTxt(p))}</td></tr>
      <tr><td>Método</td><td>${esc(p.metodo)}${p.referencia ? " · " + esc(p.referencia) : ""}</td></tr>
      <tr><td>Folio</td><td>${esc(p.id)}</td></tr>${p.registradoPorNombre ? `<tr><td>Registró</td><td>${esc(p.registradoPorNombre)}</td></tr>` : ""}
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
            ${mios.map((p) => `<tr><td>${esc(cuandoTxt(p))}</td><td>${esc(p.concepto)} · ${esc(UI.nombreMes(p.periodo))}<br><small class="nota">${esc(p.metodo || "")}</small></td><td class="num">${UI.dinero(p.monto)}</td>
            <td class="num"><button class="btn chico" data-recibo="${esc(p.id)}">Recibo</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="vacio">Aún no hay pagos registrados.</p>`}
        </div>`; }).join("") : `<p class="vacio">Tu cuenta no tiene atletas ligados. Pídelo a Administración.</p>`);
    app.onclick = (ev) => { const b = ev.target.closest("[data-recibo]"); if (b) recibo(pagos.find((p) => p.id === b.dataset.recibo)); };
    return;
  }

  // ---------- Vista de Administración ----------
  app.innerHTML = `
    <div class="pestanas" role="tablist">
      <button role="tab" data-p="mes" aria-selected="true">Mensualidades</button>
      <button role="tab" data-p="hist" aria-selected="false">Pagos registrados</button>
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
      <label>Atleta o gimnasta <input type="search" id="p-buscar" placeholder="Escribe su nombre para buscar" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore="true" data-lpignore="true"></label>
      <label><span class="nota">Elige</span> <select id="p-atleta" required size="1">${atletas.map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)}${a.activo === false ? " (baja)" : ""}</option>`).join("")}</select></label>
      <div class="fila"><label>Concepto <select id="p-concepto">${P.conceptos.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
        <label>Mes que cubre <input type="month" id="p-periodo" required></label></div>
      <div class="fila"><label>Monto <input type="number" id="p-monto" min="0" step="0.01" inputmode="decimal" required></label>
        <label>Forma de pago <select id="p-metodo">${P.metodos.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
        <label>Referencia / folio <input id="p-ref" maxlength="80"></label></div>
      <div class="fila"><label>Fecha de pago <input type="date" id="p-fecha" required></label><label>Hora <input type="time" id="p-hora" required></label></div>
      <label>Nota <input id="p-nota" maxlength="200"></label>
      <div class="acciones"><button class="btn" value="cancelar" formnovalidate>Cancelar</button><button class="btn principal" value="ok" id="p-ok">Guardar</button></div>
    </form></dialog>`;

  let pagosMes = [], vista = "mes", ultimo = {}, waOk = {};
  app.querySelector(".pestanas").onclick = (e) => {
    const b = e.target.closest("button[data-p]"); if (!b) return;
    vista = b.dataset.p;
    app.querySelectorAll(".pestanas button").forEach((x) => x.setAttribute("aria-selected", x === b));
    $("v-mes").hidden = vista !== "mes"; $("v-hist").hidden = vista !== "hist"; pintar();
  };
  ["f-mes", "f-grupo", "f-estado"].forEach((id) => ($(id).onchange = id === "f-mes" ? cargar : pintar));

  async function cargar() {
    const mes = $("f-mes").value;
    const [pg, recs] = await Promise.all([DB.listar("pagos", [["periodo", "==", mes]]), DB.listar("notificaciones", [["periodo", "==", mes]]).catch(() => [])]);
    pagosMes = pg; ultimo = {}; waOk = {};
    recs.filter((n) => n.atletaId && ["recordatorio", "vencido"].includes(n.tipo)).forEach((n) => {
      if ((n.creado || "") > (ultimo[n.atletaId] || "")) ultimo[n.atletaId] = n.creado;
      Object.values(n.whatsapp || {}).forEach((f) => { if (f > (waOk[n.atletaId] || "")) waOk[n.atletaId] = f; });
    });
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
    // Días de recordatorio (3 antes, el día límite y uno después): la app recuerda mandarlos por WhatsApp.
    const dia = new Date().getDate(), lim = Number(P.diaLimite) || 0, hoyISO = UI.hoy();
    const tocaHoy = mes === UI.mesActual() && lim && [lim - 3, lim, lim + 1].includes(dia);
    const faltanHoy = tocaHoy ? filas.filter((f) => f.e.saldo > 0 && WA.destinos(f.a, usuarios).length && !(waOk[f.a.id] || "").startsWith(hoyISO)).length : 0;
    $("v-mes").innerHTML = (faltanHoy ? `<div class="aviso-banda no-imprimir" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:color-mix(in srgb, var(--naranja) 18%, transparent);border-radius:12px;padding:10px 12px;margin-bottom:10px">
        <span>Hoy toca recordar el pago a <b>${faltanHoy}</b> familia(s) por WhatsApp.</span><button class="btn chico principal" type="button" data-recordar-hoy>Mandar recordatorios</button></div>` : "") + `<div class="fila" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h2 style="margin:0">Mensualidades · ${esc(UI.nombreMes(mes))}</h2>
      <span class="no-imprimir" style="display:flex;gap:6px;flex-wrap:wrap">${vis.some((f) => f.e.saldo > 0) ? `<button class="btn chico" id="b-recordar-todos">Recordar a todos los que deben</button>` : ""}<button class="btn chico" id="b-csv">Descargar CSV</button><button class="btn chico" onclick="print()">Imprimir</button></span></div>
      ${vis.length ? `<div class="tabla-wrap"><table><thead><tr><th>Atleta</th><th class="col-grupo">Grupo</th><th class="num col-grupo">Cuota</th><th class="num col-grupo">Pagado</th><th class="num">Saldo</th><th>Estado</th></tr></thead><tbody>
      ${vis.map(({ a, e }) => `<tr><td>${esc(a.nombre)}${e.saldo > 0 ? `<div class="no-imprimir" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn chico" data-cobrar="${esc(a.id)}">Cobrar</button><button class="btn chico" data-recordar="${esc(a.id)}">Recordatorio</button></div>${ultimo[a.id] ? `<small class="nota no-imprimir">Recordado ${esc(UI.fecha(ultimo[a.id]))} ${esc(horaLocal(ultimo[a.id]))}${waOk[a.id] ? " · WhatsApp ✓" : ""}</small>` : ""}` : ""}</td><td class="col-grupo">${esc(UI.grupo(a.grupo))}</td><td class="num col-grupo">${UI.dinero(e.cuota)}</td><td class="num col-grupo">${UI.dinero(e.pagado)}</td>
        <td class="num">${UI.dinero(e.saldo)}${e.recargo ? `<br><small class="nota">+ ${UI.dinero(e.recargo)} recargo</small>` : ""}</td><td><span class="etiqueta ${e.c}">${e.t}</span></td></tr>`).join("")}</tbody></table></div>`
      : `<p class="vacio">${atletas.length ? "Nadie con ese filtro." : "Aún no hay atletas. Agrégalos en Equipo."}</p>`}`;

    const hist = pagosMes.filter((p) => !grupo || (porId[p.atletaId] || {}).grupo === grupo).sort((x, y) => ((y.fecha || "") + (y.hora || "")).localeCompare((x.fecha || "") + (x.hora || "")));
    $("v-hist").innerHTML = `<h2>Pagos que corresponden a ${esc(UI.nombreMes(mes))}</h2>
      ${hist.length ? `<div class="tabla-wrap"><table><thead><tr><th>Fecha y hora</th><th>Atleta</th><th>Concepto</th><th>Forma de pago</th><th class="num">Monto</th><th class="no-imprimir"></th></tr></thead><tbody>
      ${hist.map((p) => `<tr><td>${esc(cuandoTxt(p))}${p.registradoPorNombre ? `<br><small class="nota">Registró: ${esc(p.registradoPorNombre)}</small>` : ""}</td><td>${esc((porId[p.atletaId] || {}).nombre || "(borrado)")}</td><td>${esc(p.concepto)}</td>
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

  // La lista del registro: solo los que coinciden con lo escrito (en iPhone no se pueden ocultar opciones, por eso se rearma).
  const sinAc = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  function opcionesAtleta(q, elegido) {
    q = sinAc(q.trim());
    const lista = atletas.filter((a) => !q || sinAc(a.nombre).includes(q));
    $("p-atleta").innerHTML = lista.length ? lista.map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)} · ${esc(UI.grupo(a.grupo))}${a.activo === false ? " (baja)" : ""}</option>`).join("")
      : `<option value="">Nadie con ese nombre</option>`;
    if (elegido && lista.some((a) => a.id === elegido)) $("p-atleta").value = elegido;
  }
  function abrir(atletaId) {
    const mes = $("f-mes").value;
    $("fp").reset();
    if (atletaId) $("p-atleta").value = atletaId;
    $("p-periodo").value = mes; $("p-fecha").value = UI.hoy(); $("p-hora").value = ahoraHHMM();
    $("p-buscar").value = ""; opcionesAtleta("", atletaId);
    const ponerMonto = () => {
      const a = porId[$("p-atleta").value];
      if (a && $("p-concepto").value === "Mensualidad") { const e = estadoMes(a, $("p-periodo").value, pagosMes); $("p-monto").value = e.saldo + e.recargo || ""; }
    };
    $("p-atleta").onchange = $("p-concepto").onchange = $("p-periodo").onchange = ponerMonto;
    ponerMonto();
    $("dlg").showModal();
  }
  $("b-nuevo").onclick = () => { abrir(); $("p-buscar").focus(); };
  $("p-buscar").oninput = () => { opcionesAtleta($("p-buscar").value, $("p-atleta").value); $("p-atleta").onchange(); };

  // Recordatorio de pago: aviso en la app (lo manda la tarea automática) y mensaje de WhatsApp listo para cada familia.
  const textoRecordatorio = (a, mes, e) => `Hola, le saludamos de ${CLUB.nombre}.\nLa mensualidad de ${UI.nombreMes(mes)} de ${a.nombre} tiene un saldo de ${UI.dinero(e.saldo)}` +
    `${e.recargo ? ` más ${UI.dinero(e.recargo)} de recargo` : ""}. ${e.k === "vencido" ? `Venció el día ${P.diaLimite}.` : `Vence el día ${P.diaLimite}.`}` +
    (P.datosParaPagar ? `\n\nCómo pagar:\n${P.datosParaPagar}` : "") + `\n\nSu estado de cuenta está en la app: ${WA.appUrl()}`;
  async function recordar(ids) {
    const mes = $("f-mes").value, hechos = {};
    for (const id of ids) {
      const a = porId[id], e = estadoMes(a, mes, pagosMes);
      if (!(e.saldo > 0)) continue;
      await DB.guardar("notificaciones", null, { atletaId: id, tipo: e.k === "vencido" ? "vencido" : "recordatorio", periodo: mes,
        titulo: e.k === "vencido" ? "Tu mensualidad está vencida" : "Recordatorio de pago",
        texto: `La mensualidad de ${UI.nombreMes(mes)} de ${a.nombre} tiene un saldo de ${UI.dinero(e.saldo)}${e.recargo ? ` más ${UI.dinero(e.recargo)} de recargo` : ""}${e.k === "vencido" ? "" : `; vence el día ${P.diaLimite}`}.` +
          (P.datosParaPagar ? `\n\nCómo pagar:\n${P.datosParaPagar}` : ""),
        push: e.k === "vencido" ? "Tu mensualidad está vencida. Toca para ver tu saldo." : "Recordatorio de pago. Toca para ver tu saldo.",
        url: "modulos/pagos/" + (Sesion.seccionDeGrupo(a.grupo) ? "?s=" + Sesion.seccionDeGrupo(a.grupo) : ""),
        manual: true, por: u.uid, creado: new Date().toISOString(), estado: "pendiente" }).then((nid) => (hechos[id] = nid));
    }
    return hechos;
  }
  function whatsappRecordatorios(hechos) {
    const mes = $("f-mes").value;
    WA.mostrar({ titulo: "Recordatorios por WhatsApp", nota: "Ya les llegó el aviso a la app. Toca cada botón para mandarles también el mensaje por WhatsApp.",
      envios: Object.keys(hechos).map((id) => { const a = porId[id]; return { titulo: a.nombre, texto: textoRecordatorio(a, mes, estadoMes(a, mes, pagosMes)), destinos: WA.destinos(a, usuarios), nid: hechos[id] }; }),
      alEnviar: (e, t) => DB.guardar("notificaciones", e.nid, { whatsapp: { [WA.numero(t.tel)]: new Date().toISOString() } }) });
    $("dlg-wa").addEventListener("close", () => cargar(), { once: true });
  }
  app.addEventListener("click", async (ev) => {
    const c = ev.target.closest("[data-cobrar]"), r = ev.target.closest("[data-recibo]"), b = ev.target.closest("[data-borrar]");
    const rc = ev.target.closest("[data-recordar]"), rt = ev.target.closest("#b-recordar-todos, [data-recordar-hoy]");
    if (rc || rt) {
      const mes = $("f-mes").value, grupo = $("f-grupo").value;
      const ids = rc ? [rc.dataset.recordar] : atletas.filter((a) => a.activo !== false && (!grupo || a.grupo === grupo) && estadoMes(a, mes, pagosMes).saldo > 0).map((a) => a.id);
      const msg = rc ? `¿Enviar recordatorio de pago a la familia de ${porId[ids[0]].nombre}?` : `¿Enviar recordatorio de pago a ${ids.length} familia(s) con saldo en ${UI.nombreMes(mes)}?`;
      if (!ids.length || !confirm(msg + " Les llega a la app y se abre WhatsApp con el mensaje listo.")) return;
      try { const hechos = await recordar(ids); UI.aviso(`Aviso en la app para ${ids.length} familia(s).`); whatsappRecordatorios(hechos); }
      catch (x) { UI.aviso("No se pudo enviar: " + x.message, true); }
      return;
    }
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
      fecha: $("p-fecha").value, hora: $("p-hora").value, registradoPorNombre: u.nombre, metodo: $("p-metodo").value, referencia: $("p-ref").value.trim(), nota: $("p-nota").value.trim(),
      registradoPor: u.uid, creado: new Date().toISOString() };
    $("p-ok").disabled = true;
    try {
      const id = await DB.guardar("pagos", null, datos);
      // Aviso en la app de la familia (lo envía la tarea automática) y confirmación por WhatsApp desde aquí.
      let nid = null;
      try { nid = await Avisos.porPago({ ...datos, id }, porId[datos.atletaId]); } catch (x) { console.warn("No se creó el aviso del pago", x); }
      $("dlg").close(); UI.aviso(`Pago de ${UI.dinero(monto)} registrado.`);
      if (datos.periodo !== $("f-mes").value) $("f-mes").value = datos.periodo;
      await cargar();
      const a = porId[datos.atletaId];
      WA.mostrar({ titulo: "Confirmación del pago", nota: "Manda la confirmación por WhatsApp a la familia. En la app ya les aparece.",
        envios: [{ titulo: a.nombre, destinos: WA.destinos(a, usuarios),
          texto: `Hola, le saludamos de ${CLUB.nombre}.\nRegistramos el pago de ${UI.dinero(monto)} por ${datos.concepto} de ${UI.nombreMes(datos.periodo)} de ${a.nombre}.\n` +
            `Fecha: ${cuandoTxt(datos)} · Forma de pago: ${datos.metodo}${datos.referencia ? " · Referencia: " + datos.referencia : ""} · Folio: ${id}.\n¡Gracias!\n\nSu recibo está en la app: ${WA.appUrl()}` }],
        extra: `<div class="acciones" style="justify-content:flex-start"><button class="btn chico" type="button" data-wa-extra>Ver recibo</button></div>`,
        alExtra: () => recibo({ ...datos, id }),
        alEnviar: () => nid && DB.guardar("notificaciones", nid, { whatsapp: { enviado: new Date().toISOString() } }) });

    } catch (x) { UI.aviso("No se pudo guardar: " + x.message, true); }
    finally { $("p-ok").disabled = false; }
  });
  cargar();
})();
