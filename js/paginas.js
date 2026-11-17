/* Páginas de menú (secciones GAV y GAF, Herramientas administrativas) como listas agrupadas de iOS (estilo Ajustes):
   cuadro de color con ícono, nombre, explicación corta y flecha. Lo que aún no existe va en su propio grupo
   «Próximamente», en gris y sin enlace. */
window.PaginaMenu = async function ({ raiz, titulo, subtitulo, permiso, seccion, tarjetas }) {
  const u = await Sesion.requerir(raiz, permiso);
  const atletas = Sesion.esStaff(u) ? [] : await Sesion.atletasVisibles(u).catch(() => []);
  if (seccion && !Sesion.seccionesDe(u, atletas).includes(seccion)) { location.href = raiz + "index.html"; return; }
  UI.encabezado(titulo, raiz, u, raiz + "index.html");
  const todas = tarjetas(u).filter(Boolean);
  const fila = (t) => `<li>${t.pronto
    ? `<div class="fila-lista apagado" aria-disabled="true">`
    : `<a href="${UI.esc(t.href)}">`}
      <span class="icono" style="background:var(--${t.color})">${UI.icono(t.icono)}</span>
      <span class="txt"><b>${UI.esc(t.t)}</b><small>${UI.esc(t.s)}</small></span>
      ${t.pronto ? '<span class="pronto">Pronto</span></div>' : UI.chevron + "</a>"}</li>`;
  const grupo = (titulo, lista) => lista.length ? `<div class="grupo-lista"><h3>${UI.esc(titulo)}</h3><ul class="lista">${lista.map(fila).join("")}</ul></div>` : "";
  document.getElementById("app").innerHTML =
    grupo(subtitulo, todas.filter((t) => !t.pronto)) + grupo("Próximamente", todas.filter((t) => t.pronto));
};

// Módulos de una sección (GAV o GAF). Lo marcado pronto: true sale en gris con «Próximamente».
window.tarjetasSeccion = function (sec) {
  const q = "?s=" + sec;
  return (u) => {
    const staff = Sesion.esStaff(u);
    return [
      staff && { href: "../modulos/asistencia/" + q, icono: "check", color: "verde", t: "Tomar asistencia", s: "Pasar lista por grupo" },
      { href: "../modulos/asistencia/" + q + "&vista=reporte", icono: "barras", color: "cian", t: "Reporte de asistencia", s: "Porcentaje de cada atleta" },
      !staff && { href: "../modulos/pagos/" + q, icono: "tarjeta", color: "azul", t: "Mis pagos", s: "Estado de cuenta y recibos" },
      { href: "../modulos/avisos/" + q, icono: "megafono", color: "naranja", t: "Avisos", s: "Noticias del club" },
      { href: "../modulos/calendario/" + q, icono: "calendario", color: "rojo", t: "Calendario", s: "Competencias y eventos" },
      { href: "../modulos/normativos/" + q, icono: "lista", color: "indigo", t: "Normativos", s: "Nivel por aparato" },
      staff && { href: sec === "GAF" ? "../modulos/rutinas-gaf/editor.html" : "../modulos/rutinas/editor.html", icono: "lapiz", color: "cafe", t: "Editor de rutinas", s: "Rutinas y nota de partida" },
      staff && { href: "../modulos/competencias/" + q, icono: "trofeo", color: "morado", t: "Competencias", s: "Resultados y eficiencia" },
      { href: "../modulos/reportes/" + q, icono: "grafica", color: "turquesa", t: staff ? "Reportes para papás" : "Mi reporte", s: staff ? "Avance de cada atleta" : "Tu avance" }
    ];
  };
};
