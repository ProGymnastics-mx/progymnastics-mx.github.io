/* Notificaciones para papás y atletas (Manu, 17-nov-2026: «celular y correo»).
   - notificaciones/<id> = {atletaId, tipo: "pago"|"cargo"|"recordatorio"|"vencido", titulo, texto (detalle: correo y app),
     push (texto corto para la pantalla bloqueada: sin nombres ni montos), url, creado, estado: "pendiente"|"enviada", ...}
     Las crea administración al registrar un pago y la tarea automática (tools/notificaciones) con los recordatorios;
     esa misma tarea las manda por correo y al celular y las marca como enviadas.
   - suscripciones/<uid> = {subs: {<clave>: suscripción Web Push}}: un registro por celular de cada usuario.
   - config_publica/push = {publica}: llave pública VAPID (la crea la tarea; la privada nunca sale del servidor).
   En iPhone solo hay notificaciones con la app agregada a la pantalla de inicio (iOS 16.4 o más). */
(function () {
  const CLAVE_VISTO = (u) => "pg_avisos_visto_" + u.uid;
  const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalada = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const soportado = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const b64aBytes = (b64) => { const p = "=".repeat((4 - (b64.length % 4)) % 4); const s = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...s].map((c) => c.charCodeAt(0))); };
  const clave = (txt) => { let h = 0; for (const c of txt) h = (h * 31 + c.charCodeAt(0)) | 0; return "s" + (h >>> 0).toString(36); };

  async function registro(raiz) { return navigator.serviceWorker.register(raiz + "sw.js", { scope: raiz }); }

  // "demo" | "instalar" (iPhone sin agregar a inicio) | "no-soportado" | "bloqueado" | "activo" | "inactivo"
  async function estado(raiz) {
    if (DB.DEMO) return "demo";
    if (esIOS() && !instalada()) return "instalar";
    if (!soportado()) return "no-soportado";
    if (Notification.permission === "denied") return "bloqueado";
    try { const r = await navigator.serviceWorker.getRegistration(raiz); const s = r && (await r.pushManager.getSubscription()); return s ? "activo" : "inactivo"; }
    catch (e) { return "inactivo"; }
  }

  async function activar(u, raiz) {
    const conf = await DB.obtener("config_publica", "push").catch(() => null);
    if (!conf || !conf.publica) throw new Error("Las notificaciones aún no están listas en el servidor del club. Avísale a Administración.");
    if ((await Notification.requestPermission()) !== "granted") throw new Error("No diste permiso para las notificaciones.");
    const reg = await registro(raiz);
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aBytes(conf.publica) });
    const json = sub.toJSON();
    await DB.guardar("suscripciones", u.uid, { subs: { [clave(json.endpoint)]: { ...json, agente: navigator.userAgent.slice(0, 120), desde: new Date().toISOString() } }, actualizado: new Date().toISOString() });
    return "activo";
  }

  // Avisos de los atletas del usuario (tutor/atleta). El staff ve los últimos del club.
  async function mios(u) {
    let lista;
    if (Sesion.esStaff(u)) lista = await DB.listar("notificaciones").catch(() => []);
    else lista = (await Promise.all((u.atletas || []).map((id) => DB.listar("notificaciones", [["atletaId", "==", id]]).catch(() => [])))).flat();
    return lista.sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
  }
  function visto(u) { try { return localStorage.getItem(CLAVE_VISTO(u)) || ""; } catch (e) { return ""; } }
  function marcarVistos(u) { try { localStorage.setItem(CLAVE_VISTO(u), new Date().toISOString()); } catch (e) {} }
  async function nuevos(u) { const v = visto(u); return (await mios(u)).filter((n) => (n.creado || "") > v).length; }

  // Aviso por un pago que registra administración (el correo lleva el detalle; la pantalla bloqueada, un texto sin montos).
  async function porPago(p, atleta) {
    const tarjeta = /tarjeta/i.test(p.metodo || "");
    const mes = p.periodo ? UI.nombreMes(p.periodo) : "";
    return DB.guardar("notificaciones", null, {
      atletaId: p.atletaId, tipo: tarjeta ? "cargo" : "pago",
      titulo: tarjeta ? "Cargo a tu tarjeta" : "Pago registrado",
      texto: `${tarjeta ? "Se registró el cargo a tu tarjeta" : "Registramos tu pago"} de ${UI.dinero(p.monto)} por ${p.concepto}${mes ? " de " + mes : ""} de ${atleta ? atleta.nombre : "tu atleta"}. Fecha: ${UI.fecha(p.fecha)}${p.hora ? " a las " + p.hora : ""}${p.referencia ? " · Referencia: " + p.referencia : ""}. ¡Gracias!`,
      push: tarjeta ? "Se registró el cargo a tu tarjeta. Toca para ver tu recibo." : "Registramos tu pago. Toca para ver tu recibo.",
      url: "modulos/pagos/" + (atleta && Sesion.seccionDeGrupo(atleta.grupo) ? "?s=" + Sesion.seccionDeGrupo(atleta.grupo) : ""),
      pagoId: p.id || "", periodo: p.periodo || "", creado: new Date().toISOString(), estado: "pendiente"
    });
  }

  window.Avisos = { estado, activar, mios, nuevos, marcarVistos, porPago, esIOS, instalada };
})();
