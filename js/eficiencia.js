/* Eficiencia por competencia — mismas reglas que la App GAV de AKC (Manu, 14-nov-2026), sin nombres de atletas.
 * Por aparato presentado: % = NF ÷ (la NP más alta entre la de la rutina y la del juez) × 100, nunca más de 100.
 * Eficiencia = promedio de los aparatos que presentó (los que no presentó no cuentan). AA = suma de NF.
 * GAV: obligatorios = niveles 3 a 6; libres = 7, 8, 9, 10 y FIG (6 aparatos).
 * GAF: obligatorios = niveles 1 a 5 (compulsorias USAG); libres = 6 a 10, Junior FIG y FIG (salto, barras, viga y piso).
 * PG_EFIC.seccion("GAF") cambia los aparatos y el corte; por omisión, GAV.
 * Resultado (r): {np: {AP: NP del juez}, nf: {AP: nota final}, ref: {AP: NP de la rutina}, lugar, part, nivel, tipo}.
 */
(function () {
  "use strict";
  const SECCIONES = {
    GAV: { aps: [["PISO", "Piso"], ["ARZON", "Arzón"], ["ANILLOS", "Anillos"], ["SALTO", "Salto"], ["PARALELAS", "Paralelas"], ["FIJA", "Barra fija"]], maxObl: 6,
           titulos: { L: "LIBRES · NIVELES 7, 8, 9, 10 Y FIG", O: "OBLIGATORIOS · NIVELES 3 A 6" } },
    GAF: { aps: [["SALTO", "Salto"], ["BARRAS", "Barras"], ["VIGA", "Viga"], ["PISO", "Piso"]], maxObl: 5,
           titulos: { L: "LIBRES · NIVELES 6 A 10, JUNIOR FIG Y FIG", O: "OBLIGATORIOS · NIVELES 1 A 5" } }
  };
  let SEC = SECCIONES.GAV;
  const APS = [...SEC.aps]; // se reemplaza en sitio con seccion()
  function seccion(id) { SEC = SECCIONES[id] || SECCIONES.GAV; APS.splice(0, APS.length, ...SEC.aps); return api; }

  function calcular(r) {
    const ap = {}; let suma = 0, n = 0, aa = 0;
    APS.forEach(([k]) => {
      const np = r && r.np ? r.np[k] : null, nf = r && r.nf ? r.nf[k] : null, ref = r && r.ref ? r.ref[k] : null;
      if (np == null || nf == null || np === "" || nf === "") { ap[k] = null; return; }
      const conRef = ref != null && ref > 0;
      const base = conRef ? Math.max(ref, np) : np;
      const p = base > 0 ? Math.min(100, (nf / base) * 100) : 0;
      ap[k] = { np, nf, ref: conRef ? ref : null, base, ded: np - nf, p, sinRef: !conRef };
      suma += p; n++; aa += nf;
    });
    return { ap, n, aa, ef: n ? suma / n : null };
  }

  function grupo(nivel, tipo) {
    const t = String(nivel == null ? "" : nivel).toUpperCase();
    if (/FIG|JR|JUV|MAY|ELITE|ÉLITE/.test(t)) return "L";
    const m = t.match(/\d+/);
    if (m) return Number(m[0]) <= SEC.maxObl ? "O" : "L";
    return tipo === "O" ? "O" : "L";
  }
  const nivelTexto = (nivel) => { const t = String(nivel == null ? "" : nivel).trim(); return /^\d+$/.test(t) ? "Nivel " + t : t.replace(/^N(?=\d)/i, "Nivel "); };

  // Ranking de una copa: {L: [...], O: [...]}; solo quienes compitieron (mayor eficiencia; empate: mayor AA).
  function ranking(resultados) {
    const out = { L: [], O: [] };
    resultados.forEach((r) => { const calc = calcular(r); if (calc.n) out[grupo(r.nivel, r.tipo)].push({ r, calc }); });
    ["L", "O"].forEach((g) => { out[g].sort((a, b) => b.calc.ef - a.calc.ef || b.calc.aa - a.calc.aa); out[g].forEach((f, i) => (f.lugar = i + 1)); });
    return out;
  }

  // Semáforo (los mismos cortes del Excel del Nacional de Manu): V = cumple, A = cercano, R = área de oportunidad.
  const semPct = (g, p) => (g === "O" ? (p >= 90 ? "V" : p >= 80 ? "A" : "R") : p >= 85 ? "V" : p >= 75 ? "A" : "R");
  const semNP = (g, np) => (g === "O" ? (np >= 9.9 - 1e-9 ? "V" : np >= 9.6 - 1e-9 ? "A" : "R") : "");
  const semDed = (g, d) => (g === "O" ? (d <= 1 + 1e-9 ? "V" : d < 1.8 - 1e-9 ? "A" : "R") : d < 1.5 ? "V" : d < 2 ? "A" : "R");
  const semEf = (e) => (e >= 85 ? "V" : e >= 75 ? "A" : "R");
  const f1 = (v) => (v == null ? "—" : Number(v).toFixed(1)), f3 = (v) => (v == null ? "—" : Number(v).toFixed(3));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  let css = false;
  function ponerCss() {
    if (css) return; css = true;
    const st = document.createElement("style");
    st.textContent = `
.efc{display:grid;gap:16px}
.efc .tw{overflow-x:auto;border-radius:12px;background:var(--panel);-webkit-overflow-scrolling:touch}
.efc table{border-collapse:collapse;width:100%;min-width:920px;font-size:12px;font-variant-numeric:tabular-nums}
.efc th,.efc td{border:.5px solid var(--line);padding:5px;text-align:center;vertical-align:middle}
.efc th{font-size:11px;font-weight:600;color:var(--muted)}
.efc th.grp{text-align:left;font-size:13px;color:var(--fg);letter-spacing:.04em;background:var(--relleno)}
.efc td.nm{text-align:left;font-weight:600;font-size:14px;min-width:150px;position:sticky;left:0;background:var(--panel);z-index:1}
.efc td.nm small{display:block;font-weight:400;font-size:11px;color:var(--muted)}
.efc td.lg{font-weight:700;font-size:15px;width:40px}
.efc .c{display:grid;grid-template-columns:auto auto auto auto;gap:1px 4px;justify-content:center;white-space:nowrap}
.efc .c span{font-size:9px;color:var(--muted);text-align:right}.efc .c b{text-align:left;font-weight:600}
.efc .p{margin-top:3px;border-radius:5px;font-weight:700;padding:2px 0}
.efc .s-V{background:#34c759;color:#fff}.efc .s-A{background:#ffd60a;color:#111}.efc .s-R{background:#ff3b30;color:#fff}
.efc .t-V{color:var(--ok)}.efc .t-A{color:var(--warn)}.efc .t-R{color:var(--bad)}
.efc .m1{background:#d4a017;color:#111}.efc .m2{background:#c8c8c8;color:#111}.efc .m3{background:#b5651d;color:#fff}
.efc .np0{font-size:11px;color:var(--muted)}
.efc tr.prom td{font-weight:700}.efc tr.prom td.pt{text-align:right}
.efc .ley{font-size:12px;line-height:1.5;color:var(--muted)}
.efc tr.sel td{background:color-mix(in srgb,var(--amarillo) 18%,var(--panel))}
@media print{.efc table{min-width:0;font-size:8px}.efc .tw{overflow:visible}.efc td.nm{position:static;font-size:11px}.efc *{-webkit-print-color-adjust:exact;print-color-adjust:exact}.efc tr{break-inside:avoid}.efc .ley{display:none}}`;
    document.head.appendChild(st);
  }

  // Concentrado con colores de una copa. nombre(r) da el nombre a mostrar; opts.sel = atletaId resaltado.
  function concentrado(resultados, nombre, opts) {
    ponerCss(); opts = opts || {};
    const rk = ranking(resultados);
    const tabla = (g, titulo) => {
      const filas = rk[g]; if (!filas.length) return "";
      let h = `<div class="tw"><table><thead><tr><th class="grp" colspan="${APS.length + 6}">${titulo}</th></tr><tr><th>Lugar</th><th>Nombre</th><th>Nivel</th>${APS.map(([, l]) => `<th>${l}</th>`).join("")}<th>AA</th><th>Eficiencia</th><th>Lugar oficial</th></tr></thead><tbody>`;
      filas.forEach((f) => {
        const med = f.lugar <= 3 ? " m" + f.lugar : "";
        h += `<tr class="${opts.sel === f.r.atletaId ? "sel" : ""}"><td class="lg${med}">${f.lugar}</td><td class="nm">${esc(nombre(f.r))}<small>${esc(f.r.cat ? "Cat. " + f.r.cat : "")}</small></td><td>${esc(nivelTexto(f.r.nivel).replace(/^Nivel /, "")) || "—"}</td>`;
        APS.forEach(([k]) => {
          const x = f.calc.ap[k];
          if (!x) { h += `<td class="np0">No presentó</td>`; return; }
          h += `<td><div class="c"><span>NP</span><b class="t-${semNP(g, x.np)}">${f1(x.np)}</b><span>NF</span><b>${f3(x.nf)}</b><span>Rut.</span><b>${f1(x.ref)}${x.sinRef ? "*" : ""}</b><span>Ded.</span><b class="t-${semDed(g, x.ded)}">${f3(x.ded)}</b></div><div class="p s-${semPct(g, x.p)}">${x.p.toFixed(1)}%</div></td>`;
        });
        h += `<td><b>${f.calc.aa.toFixed(3)}</b></td><td><div class="p s-${semEf(f.calc.ef)}">${f.calc.ef.toFixed(1)}%</div></td><td>${f.r.lugar ? `<b>${esc(f.r.lugar)}°</b>${f.r.part ? " de " + esc(f.r.part) : ""}` : "—"}</td></tr>`;
      });
      const prom = {}; APS.forEach(([k]) => { const v = filas.filter((f) => f.calc.ap[k]).map((f) => f.calc.ap[k].p); if (v.length) prom[k] = v.reduce((a, b) => a + b, 0) / v.length; });
      const orden = Object.keys(prom).sort((a, b) => prom[b] - prom[a]);
      const efP = filas.reduce((a, f) => a + f.calc.ef, 0) / filas.length;
      h += `<tr class="prom"><td colspan="3" class="pt">Promedio del aparato</td>${APS.map(([k]) => prom[k] == null ? `<td class="np0">—</td>` : `<td><div class="p s-${semPct(g, prom[k])}">${prom[k].toFixed(1)}%</div><div class="np0">${orden.indexOf(k) + 1}.º</div></td>`).join("")}<td></td><td><div class="p s-${semEf(efP)}">${efP.toFixed(1)}%</div></td><td></td></tr>`;
      return h + "</tbody></table></div>";
    };
    return `<div class="efc">${tabla("L", SEC.titulos.L)}${tabla("O", SEC.titulos.O)}
<p class="ley"><b>% del aparato</b> = NF ÷ la NP más alta entre la de la rutina y la del juez (máx. 100%). Libres: verde ≥ 85%, amarillo 75–84.9%, rojo &lt; 75%. Obligatorios: verde ≥ 90%, amarillo 80–89.9%, rojo &lt; 80%.
<b>NP del juez</b> en obligatorios: verde 9.9–10, amarillo 9.6–9.8, rojo ≤ 9.5. <b>Ded.</b> = NP del juez − NF: obligatorios verde ≤ 1.0, amarillo &gt; 1.0, rojo ≥ 1.8; libres verde &lt; 1.5, amarillo 1.5–1.99, rojo ≥ 2.
<b>Eficiencia</b> = promedio de los aparatos que presentó: verde ≥ 85%, amarillo 75–84.9%, rojo &lt; 75%. * = sin NP de rutina (se usa la del juez).</p></div>`;
  }

  const api = { APS, seccion, calcular, grupo, nivelTexto, ranking, concentrado, semPct, semEf, f1, f3 };
  window.PG_EFIC = api;
})();
