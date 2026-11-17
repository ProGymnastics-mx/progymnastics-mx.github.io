/* Equipo (solo OWNER y ADMIN): atletas y accesos.
   atletas/<id> = {nombre, grupo, nivel, nacimiento, cuota, activo, notas}
   Accesos: invitaciones/<correo> = {nombre, rol, atletas[]}; al crear su cuenta con ese correo, la persona
   recibe usuarios/<uid> con ese perfil. ADMIN no puede dar ni quitar el perfil OWNER. */
(async function () {
  const RAIZ = "../../";
  const u = await Sesion.requerir(RAIZ, "equipo");
  UI.encabezado("Equipo", RAIZ, u);
  const app = document.getElementById("app");
  const esc = UI.esc, $ = (id) => document.getElementById(id);
  const ROLES = Object.keys(Sesion.ROLES).filter((r) => u.rol === "OWNER" || r !== "OWNER");
  let atletas = [], usuarios = [], invitaciones = [];

  app.innerHTML = `
    <div class="pestanas" role="tablist">
      <button role="tab" data-p="atletas" aria-selected="true">Atletas</button>
      <button role="tab" data-p="accesos" aria-selected="false">Accesos</button>
    </div>
    <section id="p-atletas">
      <div class="panel"><div class="fila">
        <label>Buscar <input type="search" id="a-buscar" placeholder="Nombre"></label>
        <label>Grupo <select id="a-grupo"><option value="">Todos</option>${CLUB.grupos.map((g) => `<option value="${esc(g.id)}">${esc(g.nombre)}</option>`).join("")}</select></label>
        <label>Estado <select id="a-activo"><option value="1">Activos</option><option value="0">Bajas</option><option value="">Todos</option></select></label>
        <button class="btn principal" type="button" id="a-nuevo">+ Atleta</button>
      </div></div>
      <div class="panel"><div class="tabla-wrap" id="a-lista"></div></div>
    </section>
    <section id="p-accesos" hidden>
      <div class="panel"><div class="fila" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Cuentas</h2>
        <button class="btn principal" type="button" id="i-nuevo">+ Invitar</button></div>
        <p class="nota">Para dar acceso, invita el correo de la persona con su perfil. Ella entra a la app, escribe ese correo y una contraseña, y toca «Crear mi cuenta».
          ${DB.DEMO ? "<b>En modo demostración las invitaciones no se pueden usar; los perfiles demo ya existen.</b>" : ""}</p>
        <div class="tabla-wrap" id="u-lista"></div></div>
      <div class="panel"><h2>Invitaciones pendientes</h2><div class="tabla-wrap" id="i-lista"></div></div>
    </section>

    <dialog id="dlg-a"><form method="dialog" id="fa">
      <h2 id="fa-titulo">Atleta</h2>
      <label>Nombre completo <input id="a-nombre" required maxlength="80"></label>
      <div class="fila"><label>Grupo <select id="a-g">${CLUB.grupos.map((g) => `<option value="${esc(g.id)}">${esc(g.nombre)}</option>`).join("")}</select></label>
        <label>Nivel <input id="a-nivel" maxlength="30"></label></div>
      <div class="fila"><label>Fecha de nacimiento <input type="date" id="a-nac"></label>
        <label>Inscrito desde (mes) <input type="month" id="a-desde" required></label></div>
      <div class="fila"><label>Mensualidad <input type="number" id="a-cuota" min="0" step="0.01" inputmode="decimal" placeholder="${CLUB.pagos.mensualidadBase || ""}"></label></div>
      <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="a-act" style="width:auto"> Activo (si se quita, queda como baja y conserva su historial)</label>
      <label>Notas <input id="a-notas" maxlength="200"></label>
      <div class="acciones"><button class="btn peligro" value="borrar" id="a-borrar" formnovalidate>Borrar</button><span style="flex:1"></span>
        <button class="btn" value="cancelar" formnovalidate>Cancelar</button><button class="btn principal" value="ok">Guardar</button></div>
    </form></dialog>

    <dialog id="dlg-i"><form method="dialog" id="fi">
      <h2 id="fi-titulo">Invitar</h2>
      <label>Correo <input type="email" id="i-email" required></label>
      <label>Nombre <input id="i-nombre" required maxlength="80"></label>
      <label>Perfil <select id="i-rol">${ROLES.map((r) => `<option value="${r}">${esc(Sesion.ROLES[r])}</option>`).join("")}</select></label>
      <fieldset id="i-atl" style="border:1px solid var(--line);border-radius:8px;max-height:220px;overflow:auto">
        <legend class="nota">Atletas ligados (tutor: sus hijos; atleta: él mismo)</legend><div id="i-atl-lista"></div></fieldset>
      <div class="acciones"><button class="btn" value="cancelar" formnovalidate>Cancelar</button><button class="btn principal" value="ok">Guardar</button></div>
    </form></dialog>`;

  app.querySelector(".pestanas").onclick = (e) => {
    const b = e.target.closest("button[data-p]"); if (!b) return;
    app.querySelectorAll(".pestanas button").forEach((x) => x.setAttribute("aria-selected", x === b));
    $("p-atletas").hidden = b.dataset.p !== "atletas"; $("p-accesos").hidden = b.dataset.p !== "accesos";
  };

  async function cargar() {
    [atletas, usuarios, invitaciones] = await Promise.all([DB.listar("atletas"), DB.listar("usuarios"), DB.listar("invitaciones")]);
    atletas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    pintarAtletas(); pintarAccesos();
  }
  const nombreAtleta = (id) => (atletas.find((a) => a.id === id) || {}).nombre || "(borrado)";

  // ---------- Atletas ----------
  function pintarAtletas() {
    const q = $("a-buscar").value.trim().toLowerCase(), g = $("a-grupo").value, act = $("a-activo").value;
    const vis = atletas.filter((a) => (!q || a.nombre.toLowerCase().includes(q)) && (!g || a.grupo === g) &&
      (act === "" || (act === "1") === (a.activo !== false)));
    $("a-lista").innerHTML = vis.length ? `<table><thead><tr><th>Nombre</th><th>Grupo</th><th>Nivel</th><th class="num">Mensualidad</th><th>Tutores</th><th></th></tr></thead><tbody>
      ${vis.map((a) => { const tut = usuarios.filter((x) => (x.atletas || []).includes(a.id) && x.rol === "TUTOR").map((x) => x.nombre);
        return `<tr><td>${esc(a.nombre)}${a.activo === false ? ' <span class="etiqueta gris">Baja</span>' : ""}</td><td>${esc(UI.grupo(a.grupo))}</td><td>${esc(a.nivel || "")}</td>
        <td class="num">${a.cuota != null && a.cuota !== "" ? UI.dinero(a.cuota) : '<span class="nota">general</span>'}</td><td>${esc(tut.join(", ")) || '<span class="nota">—</span>'}</td>
        <td class="num"><button class="btn chico" data-editar="${esc(a.id)}">Editar</button></td></tr>`; }).join("")}</tbody></table>
      <p class="nota">${vis.length} atleta(s)</p>` : `<p class="vacio">No hay atletas con ese filtro.</p>`;
  }
  ["a-buscar", "a-grupo", "a-activo"].forEach((id) => ($(id).oninput = pintarAtletas));
  let editando = null;
  function abrirAtleta(a) {
    editando = a ? a.id : null;
    $("fa").reset();
    $("fa-titulo").textContent = a ? "Editar atleta" : "Nuevo atleta";
    $("a-nombre").value = a ? a.nombre : ""; $("a-g").value = a ? a.grupo : CLUB.grupos[0].id; $("a-nivel").value = a ? a.nivel || "" : "";
    $("a-nac").value = a ? a.nacimiento || "" : ""; $("a-desde").value = a ? a.desde || (a.creado || "").slice(0, 7) : UI.mesActual(); $("a-cuota").value = a && a.cuota != null ? a.cuota : "";
    $("a-act").checked = a ? a.activo !== false : true; $("a-notas").value = a ? a.notas || "" : "";
    $("a-borrar").hidden = !a;
    $("dlg-a").showModal();
  }
  $("a-nuevo").onclick = () => abrirAtleta(null);
  $("a-lista").onclick = (e) => { const b = e.target.closest("[data-editar]"); if (b) abrirAtleta(atletas.find((a) => a.id === b.dataset.editar)); };
  $("fa").addEventListener("submit", async (ev) => {
    const v = ev.submitter && ev.submitter.value;
    if (v === "cancelar") return;
    ev.preventDefault();
    try {
      if (v === "borrar") {
        const pagos = await DB.listar("pagos", [["atletaId", "==", editando]]);
        if (pagos.length) return alert("Este atleta tiene pagos registrados: mejor quítale «Activo» para darlo de baja y conservar su historial.");
        if (!confirm("¿Borrar este atleta? Si solo dejó el club, mejor quítale «Activo».")) return;
        await DB.borrar("atletas", editando);
      } else {
        const cuota = $("a-cuota").value === "" ? null : Number($("a-cuota").value);
        await DB.guardar("atletas", editando, { nombre: $("a-nombre").value.trim(), grupo: $("a-g").value, nivel: $("a-nivel").value.trim(),
          nacimiento: $("a-nac").value, desde: $("a-desde").value, cuota, activo: $("a-act").checked, notas: $("a-notas").value.trim(),
          ...(editando ? {} : { creado: new Date().toISOString() }) });
      }
      $("dlg-a").close(); UI.aviso("Guardado."); cargar();
    } catch (x) { UI.aviso("No se pudo guardar: " + x.message, true); }
  });

  // ---------- Accesos ----------
  function pintarAccesos() {
    const orden = Object.keys(Sesion.ROLES);
    usuarios.sort((a, b) => orden.indexOf(a.rol) - orden.indexOf(b.rol) || a.nombre.localeCompare(b.nombre, "es"));
    const fila = (x, tipo) => `<tr><td>${esc(x.nombre)}<br><small class="nota">${esc(x.email || x.id)}</small></td><td>${esc(Sesion.ROLES[x.rol] || x.rol)}</td>
      <td>${esc((x.atletas || []).map(nombreAtleta).join(", ")) || '<span class="nota">—</span>'}</td>
      <td class="num">${x.rol === "OWNER" && u.rol !== "OWNER" ? "" : `<button class="btn chico" data-${tipo}="${esc(x.id)}">Editar</button>`}</td></tr>`;
    $("u-lista").innerHTML = usuarios.length ? `<table><thead><tr><th>Nombre</th><th>Perfil</th><th>Atletas</th><th></th></tr></thead><tbody>${usuarios.map((x) => fila(x, "usuario")).join("")}</tbody></table>` : `<p class="vacio">Sin cuentas.</p>`;
    $("i-lista").innerHTML = invitaciones.length ? `<table><thead><tr><th>Nombre</th><th>Perfil</th><th>Atletas</th><th></th></tr></thead><tbody>${invitaciones.map((x) => fila(x, "invitacion")).join("")}</tbody></table>` : `<p class="vacio">No hay invitaciones pendientes.</p>`;
  }
  let editAcceso = null; // {tipo:'usuario'|'invitacion', id}
  function abrirAcceso(tipo, x) {
    editAcceso = x ? { tipo, id: x.id } : null;
    $("fi").reset();
    $("fi-titulo").textContent = !x ? "Invitar" : tipo === "usuario" ? "Editar cuenta" : "Editar invitación";
    $("i-email").value = x ? x.email || x.id : ""; $("i-email").disabled = !!x;
    $("i-nombre").value = x ? x.nombre : ""; $("i-rol").value = x ? x.rol : "TUTOR";
    const sel = new Set(x ? x.atletas || [] : []);
    $("i-atl-lista").innerHTML = atletas.filter((a) => a.activo !== false || sel.has(a.id)).map((a) => `<label style="flex-direction:row;align-items:center;gap:8px;font-weight:500">
      <input type="checkbox" value="${esc(a.id)}" style="width:auto" ${sel.has(a.id) ? "checked" : ""}> ${esc(a.nombre)} <span class="nota">${esc(UI.grupo(a.grupo))}</span></label>`).join("") || '<p class="nota">Primero agrega atletas.</p>';
    const ver = () => { $("i-atl").hidden = !["TUTOR", "ATLETA"].includes($("i-rol").value); };
    $("i-rol").onchange = ver; ver();
    // Quitar una cuenta (no borra su usuario de Firebase, pero deja de poder entrar)
    let quitar = $("fi").querySelector("[value=quitar]");
    if (!quitar) { quitar = document.createElement("button"); quitar.className = "btn peligro"; quitar.value = "quitar"; quitar.formNoValidate = true; quitar.textContent = "Quitar acceso"; $("fi").querySelector(".acciones").prepend(quitar); }
    quitar.hidden = !x || (x.id === u.uid);
    $("dlg-i").showModal();
  }
  $("i-nuevo").onclick = () => abrirAcceso("invitacion", null);
  $("p-accesos").onclick = (e) => {
    const b = e.target.closest("[data-usuario],[data-invitacion]"); if (!b) return;
    if (b.dataset.usuario) abrirAcceso("usuario", usuarios.find((x) => x.id === b.dataset.usuario));
    else abrirAcceso("invitacion", invitaciones.find((x) => x.id === b.dataset.invitacion));
  };
  $("fi").addEventListener("submit", async (ev) => {
    const v = ev.submitter && ev.submitter.value;
    if (v === "cancelar") return;
    ev.preventDefault();
    try {
      if (v === "quitar") {
        if (!confirm("¿Quitar el acceso? La persona ya no podrá entrar a la app.")) return;
        await DB.borrar(editAcceso.tipo === "usuario" ? "usuarios" : "invitaciones", editAcceso.id);
      } else {
        const rol = $("i-rol").value;
        const ligados = ["TUTOR", "ATLETA"].includes(rol) ? [...$("i-atl-lista").querySelectorAll("input:checked")].map((i) => i.value) : [];
        if (rol === "ATLETA" && ligados.length !== 1) return UI.aviso("Una cuenta de atleta se liga a un solo atleta.", true);
        if (rol === "TUTOR" && !ligados.length) return UI.aviso("Elige al menos un atleta para el tutor.", true);
        const datos = { nombre: $("i-nombre").value.trim(), rol, atletas: ligados };
        if (editAcceso && editAcceso.tipo === "usuario") {
          if (editAcceso.id === u.uid && rol !== u.rol) return UI.aviso("No puedes cambiar tu propio perfil.", true);
          await DB.guardar("usuarios", editAcceso.id, datos);
        } else {
          const email = $("i-email").value.trim().toLowerCase();
          if (!editAcceso && usuarios.some((x) => (x.email || "").toLowerCase() === email)) return UI.aviso("Ese correo ya tiene cuenta: edítala en la lista.", true);
          await DB.guardar("invitaciones", editAcceso ? editAcceso.id : email, { ...datos, email, invitadoPor: u.uid, creado: new Date().toISOString() });
        }
      }
      $("dlg-i").close(); UI.aviso("Guardado."); cargar();
    } catch (x) { UI.aviso("No se pudo guardar: " + x.message, true); }
  });

  cargar();
})();
