/* Notificaciones: activar los avisos en este celular y ver los avisos recibidos (pagos, cargos y recordatorios).
   Administración ve los últimos avisos del club y si ya se enviaron. */
(async function () {
  const RAIZ = "../../";
  const u = await Sesion.requerir(RAIZ);
  UI.encabezado("Notificaciones", RAIZ, u, RAIZ + "index.html");
  const app = document.getElementById("app");
  const esc = UI.esc;
  const staff = Sesion.esStaff(u);
  const ICONO = { pago: ["tarjeta", "verde"], cargo: ["tarjeta", "azul"], recordatorio: ["calendario", "naranja"], vencido: ["calendario", "rojo"] };
  const TEXTO_ESTADO = {
    demo: "En modo demostración no se envían notificaciones al celular; aquí ves cómo quedan los avisos.",
    instalar: "En iPhone, primero agrega la app a tu pantalla de inicio: abre esta página en Safari, toca Compartir (el cuadro con flecha) y elige «Agregar a inicio». Después ábrela desde ese ícono y vuelve aquí.",
    "no-soportado": "Este navegador no recibe notificaciones. Abre la app en Chrome (Android) o agrégala a la pantalla de inicio en iPhone. Los avisos también te llegan por correo.",
    bloqueado: "Bloqueaste las notificaciones para esta app. Actívalas en Ajustes del celular → Notificaciones, y vuelve a intentarlo.",
    activo: "Este celular ya recibe las notificaciones. También te llegan por correo.",
    inactivo: "Actívalas para enterarte cuando se registre un pago o se acerque la fecha límite. También te llegan por correo."
  };

  async function pintar() {
    const est = await Avisos.estado(RAIZ);
    const lista = await Avisos.mios(u);
    const nombres = staff ? Object.fromEntries((await DB.listar("atletas").catch(() => [])).map((a) => [a.id, a.nombre])) : {};
    app.innerHTML = `
      <div class="panel">
        <div style="display:flex;gap:12px;align-items:flex-start">
          <span class="icono" style="flex:none;width:40px;height:40px;border-radius:10px;display:grid;place-items:center;color:#fff;background:var(--${est === "activo" ? "verde" : "rojo"})">${UI.icono("megafono")}</span>
          <div style="flex:1"><b>Notificaciones en este celular: ${est === "activo" ? "activas" : "apagadas"}</b><p class="nota" style="margin:4px 0 0">${esc(TEXTO_ESTADO[est])}</p></div>
        </div>
        ${est === "inactivo" ? `<div class="acciones" style="margin-top:12px"><button class="btn principal" type="button" id="b-activar">Activar notificaciones</button></div>` : ""}
      </div>
      <div class="grupo-lista" style="padding:0"><h3>${staff ? "Últimos avisos del club" : "Tus avisos"}</h3>
      ${lista.length ? `<ul class="lista">${lista.slice(0, 60).map((n) => { const [ic, col] = ICONO[n.tipo] || ["megafono", "gris"]; return `
        <li><a href="${esc(RAIZ + (n.url || ""))}"><span class="icono" style="background:var(--${col})">${UI.icono(ic)}</span>
          <span class="txt"><b>${esc(n.titulo)}</b><small>${esc(n.texto)}</small>
          <small>${esc(UI.fecha(n.creado))}${staff ? ` · ${esc(nombres[n.atletaId] || "")} · ${n.estado === "enviada" ? `enviado (${n.correos || 0} correo(s), ${n.celulares || 0} celular(es))` : "por enviar"}` : ""}</small></span>${UI.chevron}</a></li>`; }).join("")}</ul>`
        : `<div class="panel"><p class="nota" style="margin:0">Aún no hay avisos.</p></div>`}</div>`;
    const b = document.getElementById("b-activar");
    if (b) b.onclick = async () => {
      b.disabled = true;
      try { await Avisos.activar(u, RAIZ); UI.aviso("Listo: este celular recibirá las notificaciones."); pintar(); }
      catch (x) { UI.aviso(x.message, true); b.disabled = false; }
    };
    Avisos.marcarVistos(u);
  }
  pintar();
})();
