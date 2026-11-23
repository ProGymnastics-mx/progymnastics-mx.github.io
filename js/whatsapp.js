/* Avisos por WhatsApp desde el celular de quien los manda (Manu, 23-nov-2026: «como el botón de usuario y contraseña»).
   No usa WhatsApp Business: cada botón abre WhatsApp con el mensaje ya escrito al número de mamá, papá o tutor, y la persona
   toca Enviar. Gratis y sin trámites; no es automático (la app sigue mandando sola sus notificaciones al celular).
   WA.destinos(atleta, usuarios) → [{nombre, rel, tel}] (tutores de la ficha y cuentas ligadas, sin repetir números)
   WA.mostrar({titulo, nota, envios: [{titulo, texto, destinos, hecho}], copiar, extra, alEnviar(envio, destino), alExtra()})
   (extra = HTML con un botón data-wa-extra, que llama a alExtra). */
window.WA = (function () {
  const digitos = (t) => String(t || "").replace(/\D/g, "");
  // Número para wa.me: 10 dígitos de México → 52 + número; si ya trae lada de país, igual.
  function numero(t) { const d = digitos(t); if (d.length === 10) return "52" + d; return d.length >= 11 && d.length <= 15 ? d : ""; }
  const link = (tel, texto) => "https://wa.me/" + numero(tel) + "?text=" + encodeURIComponent(texto);
  const appUrl = () => location.origin + location.pathname.replace(/(modulos\/.*|admin\/.*|gav\/.*|gaf\/.*|index\.html)$/, "");

  function destinos(a, usuarios) {
    const lista = [], vistos = new Set();
    const agregar = (nombre, rel, tel) => { const n = numero(tel); if (!n || vistos.has(n)) return; vistos.add(n); lista.push({ nombre: nombre || rel, rel, tel }); };
    ((a.ficha || {}).tutores || []).forEach((t) => agregar(t.nombre, t.parentesco || "Tutor", t.tel));
    (usuarios || []).filter((x) => ["TUTOR", "ATLETA"].includes(x.rol) && (x.atletas || []).includes(a.id))
      .forEach((x) => agregar(x.nombre, x.rol === "ATLETA" ? "Atleta" : "Tutor", x.telefono));
    return lista;
  }

  function mostrar({ titulo, nota, envios, copiar, extra, alEnviar, alExtra }) {
    const esc = UI.esc;
    let d = document.getElementById("dlg-wa");
    if (!d) { d = document.createElement("dialog"); d.id = "dlg-wa"; document.body.appendChild(d); }
    const pendientes = () => envios.filter((e) => e.destinos.length && !e.hecho).length;
    const pintar = () => {
      d.innerHTML = `<form method="dialog"><h2>${esc(titulo)}</h2>
        <p class="nota">${esc(nota || "Toca cada botón: se abre WhatsApp con el mensaje listo y solo tocas Enviar.")}</p>
        ${envios.length > 1 ? `<p class="nota"><b>${pendientes()}</b> de ${envios.filter((e) => e.destinos.length).length} por enviar.</p>` : ""}
        ${copiar ? `<div class="acciones" style="justify-content:flex-start;margin:6px 0"><button class="btn chico" type="button" data-wa-copiar>Copiar mensaje</button><span class="nota">para pegarlo en el grupo o lista de difusión del club</span></div>` : ""}
        ${envios.map((e, i) => `<div class="panel" style="margin:8px 0">
          <p style="margin:0 0 6px"><strong>${esc(e.titulo)}</strong>${e.hecho ? ' <span class="etiqueta ok">Enviado</span>' : ""}</p>
          ${envios.length === 1 || !copiar ? `<p class="nota" style="white-space:pre-wrap;margin:0 0 8px">${esc(e.texto)}</p>` : ""}
          ${e.destinos.length ? `<div class="fila" style="gap:6px;flex-wrap:wrap">${e.destinos.map((t, j) => `<a class="btn chico${e.hecho ? "" : " principal"}" target="_blank" rel="noopener" data-wa="${i}|${j}" href="${esc(link(t.tel, e.texto))}">WhatsApp a ${esc(t.rel)}${t.nombre && t.nombre !== t.rel ? " · " + esc(t.nombre.split(" ")[0]) : ""}</a>`).join("")}</div>`
            : `<p class="nota" style="color:var(--bad)">No tiene teléfono registrado. Agrégalo en su ficha (Altas).</p>`}
        </div>`).join("")}
        ${extra || ""}
        <div class="acciones"><span style="flex:1"></span><button class="btn principal" value="ok">Listo</button></div></form>`;
    };
    pintar();
    d.onclick = async (ev) => {
      const a = ev.target.closest("[data-wa]");
      if (a) {
        const [i, j] = a.dataset.wa.split("|").map(Number), e = envios[i];
        e.hecho = true;
        try { if (alEnviar) await alEnviar(e, e.destinos[j]); } catch (x) { console.warn("No se anotó el envío", x); }
        setTimeout(pintar, 300); // deja que el enlace abra WhatsApp antes de redibujar
        return;
      }
      if (alExtra && ev.target.closest("[data-wa-extra]")) return alExtra();
      if (ev.target.closest("[data-wa-copiar]")) {
        try { await navigator.clipboard.writeText(copiar); UI.aviso("Mensaje copiado."); }
        catch (x) { UI.aviso("No se pudo copiar; mantén presionado el texto para copiarlo.", true); }
      }
    };
    d.showModal();
    return d;
  }
  return { numero, link, destinos, mostrar, appUrl };
})();
