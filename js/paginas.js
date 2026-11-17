/* Páginas de menú (secciones GAV y GAF, Herramientas administrativas) como la pantalla de inicio del iPhone (Manu,
   17-nov-2026: «íconos más grandes, menos texto»): ícono grande de color y su nombre corto (c). Lo marcado pronto: true sale
   en gris y sin enlace. */
window.PaginaMenu = async function ({ raiz, titulo, subtitulo, permiso, seccion, tarjetas }) {
  const u = await Sesion.requerir(raiz, permiso);
  const atletas = Sesion.esStaff(u) ? [] : await Sesion.atletasVisibles(u).catch(() => []);
  if (seccion && !Sesion.seccionesDe(u, atletas).includes(seccion)) { location.href = raiz + "index.html"; return; }
  UI.encabezado(titulo, raiz, u, raiz + "index.html");
  const todas = tarjetas(u).filter(Boolean);
  // Íconos grandes con solo su nombre corto (c); la explicación (s) queda para lectores de pantalla.
  const app = (t) => t.pronto
    ? `<div class="app pronto" aria-disabled="true"><span class="ico" style="background:var(--${t.color})">${UI.icono(t.icono)}</span><span class="nom">${UI.esc(t.c || t.t)}</span></div>`
    : `<a class="app" href="${UI.esc(t.href)}" aria-label="${UI.esc(t.t + ": " + t.s)}"><span class="ico" style="background:var(--${t.color})">${UI.icono(t.icono)}</span><span class="nom">${UI.esc(t.c || t.t)}</span></a>`;
  document.getElementById("app").innerHTML = `<p class="apps-titulo">${UI.esc(subtitulo)}</p><nav class="apps" aria-label="${UI.esc(titulo)}">${todas.map(app).join("")}</nav>`;
};

// Módulos de una sección (GAV o GAF). Lo marcado pronto: true sale en gris con «Próximamente».
window.tarjetasSeccion = function (sec) {
  const q = "?s=" + sec;
  return (u) => {
    const staff = Sesion.esStaff(u);
    return [
      staff && { href: "../modulos/asistencia/" + q, icono: "check", color: "verde", c: "Tomar lista", t: "Tomar asistencia", s: "Pasar lista por grupo" },
      { href: "../modulos/asistencia/" + q + "&vista=reporte", icono: "barras", color: "cian", c: "Asistencia", t: "Reporte de asistencia", s: "Porcentaje de cada atleta" },
      !staff && { href: "../modulos/pagos/" + q, icono: "tarjeta", color: "azul", t: "Mis pagos", s: "Estado de cuenta y recibos" },
      { href: "../modulos/avisos/" + q, icono: "megafono", color: "naranja", t: "Avisos", s: "Noticias del club" },
      { href: "../modulos/calendario/" + q, icono: "calendario", color: "rojo", t: "Calendario", s: "Competencias y eventos" },
      { href: "../modulos/normativos/" + q, icono: "lista", color: "indigo", t: "Normativos", s: "Nivel por aparato" },
      staff && { href: sec === "GAF" ? "../modulos/rutinas-gaf/editor.html" : "../modulos/rutinas/editor.html", icono: "lapiz", color: "cafe", c: "Rutinas", t: "Editor de rutinas", s: "Rutinas y nota de partida" },
      staff && { href: "../modulos/competencias/" + q, icono: "trofeo", color: "morado", t: "Competencias", s: "Resultados y eficiencia" },
      { href: "../modulos/reportes/" + q, icono: "grafica", color: "turquesa", c: staff ? "Reportes" : "Mi reporte", t: staff ? "Reportes para papás" : "Mi reporte", s: staff ? "Avance de cada atleta" : "Tu avance" }
    ];
  };
};
