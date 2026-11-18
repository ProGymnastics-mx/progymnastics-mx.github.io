/* Equipo (solo SUPER, OWNER y ADMIN): atletas y accesos.
   atletas/<id> = {nombre, grupo, nivel, nacimiento, cuota, activo, notas, ficha: {curp, idFmg, sangre, servicio, afiliacion,
     alergias, padecimientos, calle, colonia, cp, municipio, estado, tutores: [{nombre, parentesco, tel, correo}], emergencia}}
   Accesos: invitaciones/<correo> = {nombre, rol, atletas[]}; al crear su cuenta con ese correo, la persona
   recibe usuarios/<uid> con ese perfil. ADMIN no puede dar ni quitar el perfil OWNER.
   El perfil SUPER (Desarrollador) no se da, edita ni quita desde aquí: solo desde la consola de Firebase.
   Vistas (?vista=): atletas = Registro de atletas, bajas = Bajas (atletas/<id>.baja = {fecha, motivo}),
   accesos = Administración de acceso. Un COACH lleva secciones ([] = GAV y GAF) y grupos ([] = todos los de sus secciones). */
(async function () {
  const RAIZ = "../../";
  const u = await Sesion.requerir(RAIZ, "equipo");
  const VISTA = ["atletas", "bajas", "accesos"].includes(Sesion.param("vista")) ? Sesion.param("vista") : "";
  UI.encabezado({ atletas: "Registro de atletas", bajas: "Bajas", accesos: "Administración de acceso" }[VISTA] || "Equipo", RAIZ, u);
  const app = document.getElementById("app");
  const esc = UI.esc, $ = (id) => document.getElementById(id);
  const ROLES = Object.keys(Sesion.ROLES).filter((r) => r !== "SUPER" && (Sesion.esOwner(u) || r !== "OWNER"));
  let atletas = [], usuarios = [], invitaciones = [];

  app.innerHTML = `
    <div class="pestanas" role="tablist" ${VISTA ? "hidden" : ""}>
      <button role="tab" data-p="atletas" aria-selected="true">Atletas</button>
      <button role="tab" data-p="accesos" aria-selected="false">Accesos</button>
    </div>
    <section id="p-atletas" ${VISTA === "accesos" ? "hidden" : ""}>
      ${VISTA === "bajas" ? `<div class="panel"><h2>Dar de baja</h2><div class="fila">
        <label>Atleta <select id="b-atleta"></select></label>
        <label>Fecha <input type="date" id="b-fecha" value="${UI.hoy()}"></label>
        <label>Motivo <input id="b-motivo" maxlength="120" placeholder="Opcional"></label>
        <button class="btn peligro" type="button" id="b-ok">Dar de baja</button></div>
        <p class="nota">Conserva su historial de pagos y asistencia. Se puede reactivar desde la lista.</p></div>` : ""}
      <div class="panel"><div class="fila">
        <label>Buscar <input type="search" id="a-buscar" placeholder="Nombre"></label>
        <label>Grupo <select id="a-grupo"><option value="">Todos</option>${UI.opcionesGrupos()}</select></label>
        <label ${VISTA ? "hidden" : ""}>Estado <select id="a-activo"><option value="1">Activos</option><option value="0">Bajas</option><option value="">Todos</option></select></label>
        <button class="btn principal" type="button" id="a-nuevo" ${VISTA === "bajas" ? "hidden" : ""}>+ Atleta</button>
      </div><div class="fila" style="margin-top:8px"><button class="btn chico" type="button" id="a-excel">Descargar lista completa (Excel)</button></div></div>
      <div class="panel"><div class="tabla-wrap" id="a-lista"></div></div>
    </section>
    <section id="p-accesos" ${VISTA === "accesos" ? "" : "hidden"}>
      <div class="panel"><div class="fila" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Cuentas</h2>
        <button class="btn principal" type="button" id="i-nuevo">+ Invitar</button></div>
        <p class="nota">Para dar acceso, invita el correo de la persona con su perfil. Ella entra a la app, escribe ese correo y una contraseña, y toca «Crear mi cuenta».
          ${DB.DEMO ? "<b>En modo demostración las invitaciones no se pueden usar; los perfiles demo ya existen.</b>" : ""}</p>
        <div class="tabla-wrap" id="u-lista"></div></div>
      <div class="panel"><h2>Invitaciones pendientes</h2><div class="tabla-wrap" id="i-lista"></div></div>
    </section>

    <dialog id="dlg-a"><form method="dialog" id="fa" autocomplete="off">
      <h2 id="fa-titulo">Atleta</h2>
      <h3 class="sub">Datos del atleta</h3>
      <label>Nombre completo <input id="a-nombre" required maxlength="80" data-1p-ignore="true" data-lpignore="true"></label>
      <div class="fila"><label>Fecha de nacimiento <input type="date" id="a-nac"></label><label>Edad <input id="a-edad" readonly tabindex="-1" placeholder="—"></label></div>
      <div class="fila"><label>CURP <input id="f-curp" maxlength="18" style="text-transform:uppercase" placeholder="Opcional"></label><label>ID FMG <input id="f-idFmg" maxlength="20" inputmode="numeric" placeholder="Opcional"></label></div>
      <div class="fila"><label>Grupo <select id="a-g">${UI.opcionesGrupos()}</select></label><label>Nivel <input id="a-nivel" maxlength="30"></label></div>
      <div class="fila"><label>En este nivel desde <input type="date" id="a-nivel-desde"></label>
        <label style="flex-direction:row;align-items:center;gap:8px;align-self:flex-end;padding-bottom:10px"><input type="checkbox" id="a-repite" style="width:auto"> Repite nivel</label></div>
      <p class="nota" id="a-nivel-hist" hidden></p>
      <div class="fila"><label>Inscrito desde (mes) <input type="month" id="a-desde" required></label>
        <label>Mensualidad <input type="number" id="a-cuota" min="0" step="0.01" inputmode="decimal" placeholder="${CLUB.pagos.mensualidadBase || ""}"></label></div>
      <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="a-act" style="width:auto"> Activo (si se quita, queda como baja y conserva su historial)</label>

      <h3 class="sub">Salud</h3>
      <div class="fila"><label>Tipo de sangre <select id="f-sangre"><option value="">No sé</option>${["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map((x) => `<option>${x}</option>`).join("")}</select></label>
        <label>Servicio médico <select id="f-servicio"><option value="">Ninguno</option>${["IMSS", "ISSSTE", "Seguro de gastos médicos", "Pemex", "Sedena / Semar", "Otra dependencia"].map((x) => `<option>${x}</option>`).join("")}</select></label></div>
      <label>Número de afiliación o póliza <input id="f-afiliacion" maxlength="40"></label>
      <label>Alergias <input id="f-alergias" maxlength="200" placeholder="Ninguna"></label>
      <label>Padecimientos o medicamentos <input id="f-padecimientos" maxlength="200" placeholder="Ninguno"></label>

      <h3 class="sub">Domicilio</h3>
      <label>Calle y número <input id="f-calle" maxlength="120"></label>
      <div class="fila"><label>Colonia <input id="f-colonia" maxlength="80"></label><label>C.P. <input id="f-cp" maxlength="5" inputmode="numeric"></label></div>
      <div class="fila"><label>Municipio o alcaldía <input id="f-municipio" maxlength="80"></label><label>Estado <input id="f-estado" maxlength="40"></label></div>

      ${[1, 2].map((n) => `
      <h3 class="sub">${n === 1 ? "Mamá, papá o tutor <span class='t-adulto'>(o el propio atleta si es adulto)</span>" : "Segundo tutor (opcional)"}</h3>
      <div class="fila"><label>Nombre <input id="t${n}-nombre" maxlength="80" data-1p-ignore="true" data-lpignore="true"></label>
        <label>Parentesco <select id="t${n}-parentesco"><option value=""></option>${["Mamá", "Papá", "Abuela", "Abuelo", "Tía", "Tío", "Tutor legal", "Otro"].map((x) => `<option>${x}</option>`).join("")}</select></label></div>
      <div class="fila"><label>Teléfono <input id="t${n}-tel" type="tel" maxlength="20" inputmode="tel"></label><label>Correo <input id="t${n}-correo" type="email" maxlength="80" data-1p-ignore="true" data-lpignore="true"></label></div>
      <button class="btn chico" type="button" data-invitar="${n}" hidden>Dar acceso a la app con este correo</button>`).join("")}

      <h3 class="sub">Contacto de emergencia</h3>
      <div class="fila"><label>Nombre <input id="e-nombre" maxlength="80" placeholder="Si es distinto a los tutores"></label><label>Teléfono <input id="e-tel" type="tel" maxlength="20" inputmode="tel"></label></div>

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
      <fieldset id="i-coach" style="border:1px solid var(--line);border-radius:8px">
        <legend class="nota">Secciones y grupos del coach (sin marcar = todos)</legend>
        <div class="fila" id="i-secs">${CLUB.secciones.map((x) => `<label style="flex-direction:row;align-items:center;gap:8px;flex:0 0 auto"><input type="checkbox" value="${esc(x.id)}" style="width:auto"> ${esc(x.id)}</label>`).join("")}</div>
        <div id="i-grupos" style="margin-top:8px">${CLUB.grupos.map((g) => `<label style="flex-direction:row;align-items:center;gap:8px;font-weight:500"><input type="checkbox" value="${esc(g.id)}" data-sec="${esc(g.seccion)}" style="width:auto"> ${esc(g.nombre)}</label>`).join("")}</div></fieldset>
      <div class="acciones"><button class="btn" value="cancelar" formnovalidate>Cancelar</button><button class="btn principal" value="ok">Guardar</button></div>
    </form></dialog>`;

  if (VISTA === "bajas") $("a-activo").value = "0";
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
    $("a-lista").innerHTML = vis.length ? `<table><thead><tr><th>Nombre</th><th class="num">Edad</th><th class="col-grupo">Grupo</th><th>Nivel</th><th class="num">Mensualidad</th><th>Tutores</th><th></th></tr></thead><tbody>
      ${vis.map((a) => { const tut = usuarios.filter((x) => (x.atletas || []).includes(a.id) && x.rol === "TUTOR").map((x) => x.nombre);
        const t1 = ((a.ficha || {}).tutores || [])[0];
        return `<tr><td>${esc(a.nombre)}${a.activo === false ? ' <span class="etiqueta gris">Baja</span>' : ""}${t1 && t1.tel ? `<br><small class="nota">${esc(t1.parentesco || "Tutor")}: <a href="tel:${esc(t1.tel)}">${esc(t1.tel)}</a></small>` : ""}</td>
        <td class="num">${edad(a.nacimiento) === "" ? "—" : edad(a.nacimiento)}${edad(a.nacimiento) >= 18 ? '<br><span class="etiqueta gris">Adulto</span>' : ""}</td><td class="col-grupo">${esc(UI.grupo(a.grupo))}</td><td>${esc(a.nivel || "")}${a.repite ? '<br><span class="etiqueta gris">Repite</span>' : ""}</td>
        <td class="num">${a.cuota != null && a.cuota !== "" ? UI.dinero(a.cuota) : '<span class="nota">general</span>'}</td><td>${esc(tut.join(", ")) || (t1 && t1.nombre ? `<span class="nota">${esc(t1.nombre)} (sin cuenta)</span>` : '<span class="nota">—</span>')}</td>
        <td class="num" style="white-space:nowrap">${VISTA === "bajas" && a.activo === false ? `<span class="nota">${esc(UI.fecha((a.baja || {}).fecha))}${(a.baja || {}).motivo ? " · " + esc(a.baja.motivo) : ""}</span> <button class="btn chico" data-reactivar="${esc(a.id)}">Reactivar</button> ` : ""}<button class="btn chico" data-editar="${esc(a.id)}">Editar</button></td></tr>`; }).join("")}</tbody></table>
      <p class="nota">${vis.length} atleta(s)</p>` : `<p class="vacio">${VISTA === "bajas" ? "No hay bajas." : "No hay atletas con ese filtro."}</p>`;
    if ($("b-atleta")) $("b-atleta").innerHTML = atletas.filter((a) => a.activo !== false).map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)} · ${esc(UI.grupo(a.grupo))}</option>`).join("") || "<option value=''>No hay atletas activos</option>";
  }
  if ($("b-ok")) $("b-ok").onclick = async () => {
    const id = $("b-atleta").value; if (!id) return;
    const a = atletas.find((x) => x.id === id);
    if (!confirm(`¿Dar de baja a ${a.nombre}?`)) return;
    try { await DB.guardar("atletas", id, { activo: false, baja: { fecha: $("b-fecha").value || UI.hoy(), motivo: $("b-motivo").value.trim() } }); $("b-motivo").value = ""; UI.aviso("Baja registrada."); cargar(); }
    catch (x) { UI.aviso("No se pudo: " + x.message, true); }
  };
  ["a-buscar", "a-grupo", "a-activo"].forEach((id) => ($(id).oninput = pintarAtletas));
  let editando = null;
  // Edad cumplida a hoy (años) a partir de la fecha de nacimiento.
  function edad(nac) {
    if (!nac) return "";
    const [y, m, d] = nac.split("-").map(Number), h = new Date();
    let e = h.getFullYear() - y; if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) e--;
    return e >= 0 && e < 120 ? e : "";
  }
  const CAMPOS_FICHA = ["curp", "idFmg", "sangre", "servicio", "afiliacion", "alergias", "padecimientos", "calle", "colonia", "cp", "municipio", "estado"];
  function abrirAtleta(a) {
    editando = a ? a.id : null;
    $("fa").reset();
    $("fa-titulo").textContent = a ? "Editar atleta" : "Nuevo atleta";
    $("a-nombre").value = a ? a.nombre : ""; $("a-g").value = a ? a.grupo : CLUB.grupos[0].id; $("a-nivel").value = a ? a.nivel || "" : "";
    $("a-nac").value = a ? a.nacimiento || "" : ""; $("a-desde").value = a ? a.desde || (a.creado || "").slice(0, 7) : UI.mesActual(); $("a-cuota").value = a && a.cuota != null ? a.cuota : "";
    $("a-act").checked = a ? a.activo !== false : true; $("a-notas").value = a ? a.notas || "" : "";
    const f = (a && a.ficha) || {};
    CAMPOS_FICHA.forEach((k) => ($("f-" + k).value = f[k] || ""));
    [1, 2].forEach((n) => { const t = (f.tutores || [])[n - 1] || {}; ["nombre", "parentesco", "tel", "correo"].forEach((k) => ($(`t${n}-${k}`).value = t[k] || "")); });
    $("a-nivel-desde").value = (a && a.nivelDesde) || ""; $("a-repite").checked = !!(a && a.repite);
    const hist = (a && a.historialNivel) || [];
    $("a-nivel-hist").hidden = !hist.length;
    $("a-nivel-hist").textContent = hist.length ? "Niveles anteriores: " + hist.map((h) => `${h.nivel}${h.desde ? " (desde " + UI.fecha(h.desde) + ")" : ""}${h.repitio ? " · repitió" : ""}`).join(" → ") : "";
    $("a-nivel").oninput = () => { if (a && $("a-nivel").value.trim() !== (a.nivel || "")) { $("a-nivel-desde").value = UI.hoy(); $("a-repite").checked = false; } };
    $("e-nombre").value = (f.emergencia || {}).nombre || ""; $("e-tel").value = (f.emergencia || {}).tel || "";
    const verEdad = () => { const e = edad($("a-nac").value); $("a-edad").value = e === "" ? "" : e + " años"; };
    $("a-nac").oninput = verEdad; verEdad();
    // «Dar acceso» solo con el atleta ya guardado y un correo que aún no tenga cuenta ni invitación.
    $("fa").querySelectorAll("[data-invitar]").forEach((b) => {
      const n = b.dataset.invitar, ver = () => { const c = $(`t${n}-correo`).value.trim().toLowerCase();
        b.hidden = !a || !/^\S+@\S+\.\S+$/.test(c) || usuarios.some((x) => (x.email || "").toLowerCase() === c) || invitaciones.some((x) => x.id === c); };
      $(`t${n}-correo`).oninput = ver; ver();
      b.onclick = () => { $("dlg-a").close(); abrirAcceso("invitacion", null);
        $("i-email").value = $(`t${n}-correo`).value.trim().toLowerCase(); $("i-nombre").value = $(`t${n}-nombre`).value.trim() || "Tutor de " + a.nombre;
        $("i-rol").value = "TUTOR"; $("i-rol").onchange(); const c = $("i-atl-lista").querySelector(`input[value="${a.id}"]`); if (c) c.checked = true; };
    });
    $("a-borrar").hidden = !a;
    $("dlg-a").showModal();
  }
  $("a-nuevo").onclick = () => abrirAtleta(null);
  // Lista completa (con el filtro de arriba) para abrir en Excel. Datos de menores: solo administración la descarga.
  $("a-excel").onclick = () => {
    const q = $("a-buscar").value.trim().toLowerCase(), g = $("a-grupo").value, act = $("a-activo").value;
    const vis = atletas.filter((a) => (!q || a.nombre.toLowerCase().includes(q)) && (!g || a.grupo === g) && (act === "" || (act === "1") === (a.activo !== false)));
    const c = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const cols = ["Nombre completo", "Fecha de nacimiento", "Edad", "Menor/Adulto", "CURP", "ID FMG", "Grupo", "Nivel", "En el nivel desde", "Repite nivel", "Niveles anteriores",
      "Inscrito desde", "Mensualidad", "Estado", "Tipo de sangre", "Servicio médico", "Afiliación", "Alergias", "Padecimientos", "Calle y número", "Colonia", "C.P.", "Municipio", "Estado (domicilio)",
      "Tutor 1", "Parentesco 1", "Teléfono 1", "Correo 1", "Tutor 2", "Parentesco 2", "Teléfono 2", "Correo 2", "Emergencia", "Teléfono emergencia", "Cuentas en la app", "Notas"];
    const filas = vis.map((a) => { const f = a.ficha || {}, t = f.tutores || [], e = edad(a.nacimiento);
      const cuentas = usuarios.filter((x) => (x.atletas || []).includes(a.id)).map((x) => `${x.nombre} (${x.email || x.id})`).join("; ");
      return [a.nombre, a.nacimiento, e, e === "" ? "" : e >= 18 ? "Adulto" : "Menor", f.curp, f.idFmg, UI.grupo(a.grupo), a.nivel, a.nivelDesde, a.repite ? "Sí" : "No",
        (a.historialNivel || []).map((h) => h.nivel + (h.repitio ? " (repitió)" : "")).join(" → "), a.desde, a.cuota ?? "general", a.activo === false ? "Baja" : "Activo",
        f.sangre, f.servicio, f.afiliacion, f.alergias, f.padecimientos, f.calle, f.colonia, f.cp, f.municipio, f.estado,
        ...[0, 1].flatMap((i) => [(t[i] || {}).nombre, (t[i] || {}).parentesco, (t[i] || {}).tel, (t[i] || {}).correo]),
        (f.emergencia || {}).nombre, (f.emergencia || {}).tel, cuentas, a.notas].map(c).join(","); });
    const txt = "\uFEFF" + cols.map(c).join(",") + "\n" + filas.join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
    link.download = `atletas_${UI.hoy()}.csv`; link.click();
  };
  $("a-lista").onclick = async (e) => {
    const b = e.target.closest("[data-editar]"); if (b) abrirAtleta(atletas.find((a) => a.id === b.dataset.editar));
    const r = e.target.closest("[data-reactivar]");
    if (r && confirm("¿Reactivar a este atleta?")) {
      try { await DB.guardar("atletas", r.dataset.reactivar, { activo: true, baja: null }); UI.aviso("Atleta reactivado."); cargar(); }
      catch (x) { UI.aviso("No se pudo: " + x.message, true); }
    }
  };
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
        const antes = atletas.find((a) => a.id === editando);
        const activo = $("a-act").checked;
        const baja = activo ? null : (antes && antes.activo === false && antes.baja) || { fecha: UI.hoy(), motivo: "" };
        // Al cambiar de nivel, el anterior pasa al historial (con desde cuándo estuvo y si lo repitió).
        const nivel = $("a-nivel").value.trim();
        const historialNivel = [...((antes && antes.historialNivel) || [])];
        if (antes && antes.nivel && antes.nivel !== nivel) historialNivel.push({ nivel: antes.nivel, desde: antes.nivelDesde || "", hasta: UI.hoy(), repitio: !!antes.repite });
        await DB.guardar("atletas", editando, { nombre: $("a-nombre").value.trim(), grupo: $("a-g").value, nivel,
          nivelDesde: $("a-nivel-desde").value || (nivel && (!antes || antes.nivel !== nivel) ? UI.hoy() : ""), repite: $("a-repite").checked, historialNivel,
          nacimiento: $("a-nac").value, desde: $("a-desde").value, cuota, activo, baja, notas: $("a-notas").value.trim(),
          ficha: { ...Object.fromEntries(CAMPOS_FICHA.map((k) => [k, k === "curp" ? $("f-" + k).value.trim().toUpperCase() : $("f-" + k).value.trim()])),
            tutores: [1, 2].map((n) => ({ nombre: $(`t${n}-nombre`).value.trim(), parentesco: $(`t${n}-parentesco`).value, tel: $(`t${n}-tel`).value.trim(), correo: $(`t${n}-correo`).value.trim().toLowerCase() }))
              .filter((t) => t.nombre || t.tel || t.correo),
            emergencia: { nombre: $("e-nombre").value.trim(), tel: $("e-tel").value.trim() } },
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
      <td>${x.rol === "COACH" ? esc(((x.secciones || []).length ? x.secciones.join(", ") : "GAV y GAF") + ((x.grupos || []).length ? " · " + x.grupos.map(UI.grupo).join(", ") : ""))
        : esc((x.atletas || []).map(nombreAtleta).join(", ")) || '<span class="nota">—</span>'}</td>
      <td class="num">${x.rol === "SUPER" || (x.rol === "OWNER" && !Sesion.esOwner(u)) ? "" : `<button class="btn chico" data-${tipo}="${esc(x.id)}">Editar</button>`}</td></tr>`;
    $("u-lista").innerHTML = usuarios.length ? `<table><thead><tr><th>Nombre</th><th>Perfil</th><th>Atletas o secciones</th><th></th></tr></thead><tbody>${usuarios.map((x) => fila(x, "usuario")).join("")}</tbody></table>` : `<p class="vacio">Sin cuentas.</p>`;
    $("i-lista").innerHTML = invitaciones.length ? `<table><thead><tr><th>Nombre</th><th>Perfil</th><th>Atletas o secciones</th><th></th></tr></thead><tbody>${invitaciones.map((x) => fila(x, "invitacion")).join("")}</tbody></table>` : `<p class="vacio">No hay invitaciones pendientes.</p>`;
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
    $("i-secs").querySelectorAll("input").forEach((i) => (i.checked = !!x && (x.secciones || []).includes(i.value)));
    $("i-grupos").querySelectorAll("input").forEach((i) => (i.checked = !!x && (x.grupos || []).includes(i.value)));
    const verGrupos = () => {
      const secs = [...$("i-secs").querySelectorAll("input:checked")].map((i) => i.value);
      $("i-grupos").querySelectorAll("input").forEach((i) => { const ok = !secs.length || secs.includes(i.dataset.sec); i.parentElement.hidden = !ok; if (!ok) i.checked = false; });
    };
    $("i-secs").onchange = verGrupos; verGrupos();
    const ver = () => { $("i-atl").hidden = !["TUTOR", "ATLETA"].includes($("i-rol").value); $("i-coach").hidden = $("i-rol").value !== "COACH"; };
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
        const datos = { nombre: $("i-nombre").value.trim(), rol, atletas: ligados,
          secciones: rol === "COACH" ? [...$("i-secs").querySelectorAll("input:checked")].map((i) => i.value) : [],
          grupos: rol === "COACH" ? [...$("i-grupos").querySelectorAll("input:checked")].map((i) => i.value) : [] };
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
