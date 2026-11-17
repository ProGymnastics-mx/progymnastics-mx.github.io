/* Páginas de menú (secciones GAV y GAF, Herramientas administrativas): encabezado, título y tarjetas según el perfil.
   Las tarjetas con pronto: true se ven en gris con "Próximamente" (módulos que aún no se construyen). */
window.PaginaMenu = async function ({ raiz, titulo, subtitulo, permiso, seccion, tarjetas }) {
  const u = await Sesion.requerir(raiz, permiso);
  const atletas = Sesion.esStaff(u) ? [] : await Sesion.atletasVisibles(u).catch(() => []);
  if (seccion && !Sesion.seccionesDe(u, atletas).includes(seccion)) { location.href = raiz + "index.html"; return; }
  UI.encabezado(titulo, raiz, u, raiz + "index.html");
  const main = document.getElementById("app");
  const lista = tarjetas(u).filter(Boolean);
  main.innerHTML = `
    <div class="titulo-seccion"><h2>${UI.esc(subtitulo)}</h2></div>
    <nav class="menu" aria-label="${UI.esc(titulo)}">${lista.map((t) => `
      <a class="tarjeta${t.pronto ? " pronto" : ""}" ${t.pronto ? 'aria-disabled="true"' : `href="${UI.esc(t.href)}"`}>
        <span class="ico" aria-hidden="true">${t.ico}</span><strong>${UI.esc(t.t)}</strong><small>${UI.esc(t.s)}</small>
        ${t.pronto ? '<span class="chip">Próximamente</span>' : ""}</a>`).join("")}
    </nav>`;
};

// Tarjetas de una sección (GAV o GAF). Lo marcado pronto llega en las siguientes etapas.
window.tarjetasSeccion = function (sec) {
  const q = "?s=" + sec;
  return (u) => {
    const staff = Sesion.esStaff(u);
    return [
      staff ? { href: "../modulos/asistencia/" + q, ico: "✅", t: "Tomar asistencia", s: "Lista por grupo y tablero de tus grupos" }
            : { href: "../modulos/asistencia/" + q, ico: "✅", t: "Asistencia", s: "Clases asistidas y faltas" },
      !staff && { href: "../modulos/pagos/" + q, ico: "💳", t: "Mis pagos", s: "Mensualidades y recibos" },
      { href: "../modulos/avisos/" + q, ico: "📣", t: "Avisos", s: "Lo más reciente de " + sec },
      { href: "../modulos/calendario/" + q, ico: "📅", t: "Calendario", s: "Competencias, eventos y días sin clase" },
      { ico: "📋", t: "Normativos", s: sec === "GAF" ? "Salto, barras, viga y piso: nivel de cada atleta" : "Nivel de cada atleta por aparato", pronto: true },
      staff && { ico: "✏️", t: "Editor de rutinas", s: "Rutinas y notas de partida", pronto: true },
      staff && { ico: "🏆", t: "Competencias", s: "Resultados y notas de partida de cada copa", pronto: true },
      { ico: "📊", t: staff ? "Reportes para papás" : "Mi reporte", s: "Avance, competencias y estadísticas", pronto: true }
    ];
  };
};
