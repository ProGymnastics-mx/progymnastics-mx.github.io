/* ProGymnastics — tarea automática de notificaciones (la corre .github/workflows/notificaciones.yml cada 15 minutos).
   1. Llaves VAPID para Web Push: si no existen, las crea; la privada queda en pg_config/push (ningún usuario la puede leer)
      y la pública en pg_config_publica/push (la lee la app para suscribir el celular).
   2. Recordatorios de mensualidad (hora de Ciudad de México, de 9:00 a 21:00): 3 días antes del día límite, el día límite y
      un día después si venció. Uno por atleta, mes y tipo (el id del aviso evita repetidos).
   3. Envía los avisos pendientes (pg_notificaciones con estado "pendiente"): de un atleta (pagos, recordatorios) o de un grupo
      (destino = sección, grupo y/o programa, avisos). Van a la app (Web Push de las cuentas Tutor/Atleta ligadas), al correo y al
      WhatsApp de cada cuenta y de los tutores de la ficha del atleta, sin repetir; luego los marca como enviados.
   4. Aplica las contraseñas nuevas que pide Administración (pg_claves) y las borra.
   Solo toca colecciones pg_* (el proyecto de Firebase es compartido con AKC).
   Variables: FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de servicio), GMAIL_USER y GMAIL_APP_PASSWORD (contraseña de aplicación),
   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID y opcionales WHATSAPP_PLANTILLA / WHATSAPP_IDIOMA (WhatsApp Business de Meta),
   APP_URL (por omisión https://progymnastics-mx.github.io/). Pruebas: FIRESTORE_EMULATOR_HOST, CORREO_PRUEBA=1 (no envía correos) y HOY_PRUEBA="AAAA-MM-DD HH". */
import admin from "firebase-admin";
import webpush from "web-push";
import nodemailer from "nodemailer";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP_URL = (process.env.APP_URL || "https://progymnastics-mx.github.io/").replace(/\/?$/, "/");
const P = "pg_";
const log = (...x) => console.log(new Date().toISOString(), ...x);

// ---------- configuración del club (la misma js/config.js de la app) ----------
const ventana = {};
vm.runInNewContext(fs.readFileSync(path.join(AQUI, "../../js/config.js"), "utf8"), { window: ventana });
const CLUB = ventana.CLUB;

// ---------- Firebase ----------
// Lee el JSON de la cuenta de servicio aunque al copiarlo desde un celular o tableta los "\n" de private_key se hayan
// vuelto saltos de línea reales (JSON.parse los rechaza dentro de una cadena): solo dentro de cadenas los vuelve a escapar.
function leerLlave(texto) {
  const t = String(texto || "").trim().replace(/^\uFEFF/, "");
  try { return JSON.parse(t); } catch (e) {
    let out = "", enCadena = false, escape = false;
    for (const c of t) {
      if (enCadena) {
        if (escape) { out += c; escape = false; continue; }
        if (c === "\\") { out += c; escape = true; continue; }
        if (c === '"') { enCadena = false; out += c; continue; }
        if (c === "\n") { out += "\\n"; continue; }
        if (c === "\r") continue;
        if (c === "\t") { out += "\\t"; continue; }
        out += c;
      } else { if (c === '"') enCadena = true; out += c; }
    }
    try { return JSON.parse(out); }
    catch (e2) { throw new Error("El secreto FIREBASE_SERVICE_ACCOUNT no es un JSON válido (¿se copió completo, de { a }?): " + e2.message); }
  }
}

if (process.env.FIRESTORE_EMULATOR_HOST) admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-pg" });
else {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) { log("Falta el secreto FIREBASE_SERVICE_ACCOUNT: no se envía nada (ver README de tools/notificaciones)."); process.exit(0); }
  admin.initializeApp({ credential: admin.credential.cert(leerLlave(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}
const db = admin.firestore();
const col = (c) => db.collection(P + c);

// ---------- fechas en Ciudad de México ----------
function ahoraMX() {
  if (process.env.HOY_PRUEBA) { const [f, h] = process.env.HOY_PRUEBA.split(" "); return { fecha: f, mes: f.slice(0, 7), dia: Number(f.slice(8)), hora: Number(h || 12) }; } // solo pruebas
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const v = Object.fromEntries(f.map((p) => [p.type, p.value]));
  return { fecha: `${v.year}-${v.month}-${v.day}`, mes: `${v.year}-${v.month}`, dia: Number(v.day), hora: Number(v.hour) % 24 };
}
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (p) => { const [a, m] = p.split("-"); return `${MESES[+m - 1]} ${a}`; };
const dinero = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: CLUB.pagos.moneda || "MXN" });

// ---------- 1. llaves VAPID ----------
async function llaves() {
  const ref = col("config").doc("push");
  const s = await ref.get();
  if (s.exists && s.data().privada) return s.data();
  const k = webpush.generateVAPIDKeys();
  await ref.set({ publica: k.publicKey, privada: k.privateKey, creado: new Date().toISOString() });
  await col("config_publica").doc("push").set({ publica: k.publicKey });
  log("Se crearon las llaves de notificaciones (VAPID).");
  return { publica: k.publicKey, privada: k.privateKey };
}

// ---------- 2. recordatorios ----------
async function recordatorios(hoy) {
  if (hoy.hora < 9 || hoy.hora >= 21) return 0;
  const limite = Number(CLUB.pagos.diaLimite) || 0;
  if (!limite) return 0;
  const d = limite - hoy.dia; // días que faltan para el límite
  const tipo = d === 3 ? "faltan3" : d === 0 ? "hoy" : d === -1 ? "vencido" : null;
  if (!tipo) return 0;
  const [atletas, pagos] = await Promise.all([col("atletas").get(), col("pagos").where("periodo", "==", hoy.mes).get()]);
  const pagado = {};
  pagos.forEach((p) => { const x = p.data(); if (x.concepto === "Mensualidad") pagado[x.atletaId] = (pagado[x.atletaId] || 0) + Number(x.monto || 0); });
  // Si administración ya mandó hoy un recordatorio a mano (botón Recordatorio, con su WhatsApp), no se repite el automático.
  const fechaMX = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const yaHoy = new Set((await col("notificaciones").where("periodo", "==", hoy.mes).get()).docs.map((d) => d.data())
    .filter((x) => x.manual && x.creado && fechaMX(x.creado) === hoy.fecha).map((x) => x.atletaId));
  let n = 0;
  for (const doc of atletas.docs) {
    const a = doc.data();
    if (a.activo === false || yaHoy.has(doc.id)) continue;
    const cuota = a.cuota != null && a.cuota !== "" ? Number(a.cuota) : Number(CLUB.pagos.mensualidadBase) || 0;
    const alta = a.desde || (a.creado || "").slice(0, 7);
    if (cuota <= 0 || (alta && hoy.mes < alta)) continue;
    const saldo = cuota - (pagado[doc.id] || 0);
    if (saldo <= 0) continue;
    const recargo = tipo === "vencido" ? Number(CLUB.pagos.recargo) || 0 : 0;
    const mes = nombreMes(hoy.mes);
    const t = {
      faltan3: ["Tu mensualidad vence en 3 días", `La mensualidad de ${mes} de ${a.nombre} vence el día ${limite}. Saldo: ${dinero(saldo)}.`, `Tu mensualidad vence en 3 días (día ${limite}).`],
      hoy: ["Hoy vence tu mensualidad", `Hoy, día ${limite}, vence la mensualidad de ${mes} de ${a.nombre}. Saldo: ${dinero(saldo)}.`, "Hoy vence tu mensualidad. Toca para ver cómo pagar."],
      vencido: ["Tu mensualidad venció", `La mensualidad de ${mes} de ${a.nombre} venció el día ${limite}. Saldo: ${dinero(saldo)}${recargo ? ` más ${dinero(recargo)} de recargo` : ""}.`, "Tu mensualidad venció. Toca para ver tu saldo."]
    }[tipo];
    try {
      await col("notificaciones").doc(`rec_${doc.id}_${hoy.mes}_${tipo}`).create({
        atletaId: doc.id, tipo: tipo === "vencido" ? "vencido" : "recordatorio", periodo: hoy.mes, titulo: t[0],
        texto: t[1] + (CLUB.pagos.datosParaPagar ? `\n\nCómo pagar:\n${CLUB.pagos.datosParaPagar}` : ""), push: t[2],
        url: "modulos/pagos/", creado: new Date().toISOString(), estado: "pendiente", automatico: true
      });
      n++;
    } catch (e) { if (e.code !== 6 && !/ALREADY_EXISTS/.test(e.message)) throw e; } // ya existía: no se repite
  }
  return n;
}

// ---------- 3. envío ----------
function correoHTML(n) {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f2f2f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px">
    <div style="background:#fff;border-radius:16px;padding:20px;text-align:center"><img src="${APP_URL}img/logo-rutinas.png" alt="ProGymnastics México" width="220" style="max-width:70%;height:auto"></div>
    <div style="background:#fff;border-radius:16px;padding:20px;margin-top:12px">
      <h1 style="font-size:20px;margin:0 0 10px">${esc(n.titulo)}</h1>
      <p style="font-size:16px;line-height:1.45;margin:0;white-space:pre-line">${esc(n.texto)}</p>
      <p style="margin:20px 0 0"><a href="${APP_URL}${esc(n.url || "")}" style="display:inline-block;background:#ffcb0b;color:#111;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px">Abrir la app</a></p>
    </div>
    <p style="font-size:12px;color:#6c6c70;text-align:center;margin-top:14px">ProGymnastics México · Recibes este correo porque estás registrado como familia o atleta del club.</p>
  </div></body></html>`;
}

// Destinatarios de un aviso: los atletas (uno, con atletaId; o todos los activos de destino = {seccion, grupo, programa}) y,
// de cada uno, sus cuentas Tutor/Atleta (app, correo, teléfono) y los tutores de su ficha (correo y teléfono). Sin repetir:
// una mamá con dos hijos en el grupo recibe un solo mensaje.
const seccionDeGrupo = (g) => (CLUB.grupos.find((x) => x.id === g) || {}).seccion || "";
const programaDe = (a) => a.programa || (/EQUIPO/i.test(a.grupo || "") ? "Equipo" : "Desarrollo");
const telefonoMX = (t) => { const d = String(t || "").replace(/\D/g, ""); return d.length === 10 ? "52" + d : d.length >= 11 && d.length <= 15 ? d : ""; };
const correoReal = (c) => { c = String(c || "").trim().toLowerCase(); return /^\S+@\S+\.\S+$/.test(c) && !c.endsWith(".invalid") ? c : ""; };
async function destinatarios(n, cache) {
  if (!cache.atletas) {
    cache.atletas = (await col("atletas").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    cache.usuarios = (await col("usuarios").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  const d = n.destino || {};
  const atletas = n.atletaId ? cache.atletas.filter((a) => a.id === n.atletaId)
    : cache.atletas.filter((a) => a.activo !== false && (!d.grupo || a.grupo === d.grupo) && (!d.seccion || seccionDeGrupo(a.grupo) === d.seccion) && (!d.programa || programaDe(a) === d.programa));
  const ids = new Set(atletas.map((a) => a.id));
  const cuentas = cache.usuarios.filter((u) => ["TUTOR", "ATLETA"].includes(u.rol) && (u.atletas || []).some((x) => ids.has(x)));
  const correos = new Set(), telefonos = new Set();
  for (const u of cuentas) { const c = correoReal(u.correo || u.email); if (c) correos.add(c); const t = telefonoMX(u.telefono); if (t) telefonos.add(t); }
  for (const a of atletas) for (const t of ((a.ficha || {}).tutores || [])) { const c = correoReal(t.correo); if (c) correos.add(c); const tel = telefonoMX(t.tel); if (tel) telefonos.add(tel); }
  return { atletas: atletas.length, uids: cuentas.map((u) => u.id), correos: [...correos], telefonos: [...telefonos] };
}

// WhatsApp (API de WhatsApp Business Cloud de Meta). Solo con los secretos WHATSAPP_TOKEN y WHATSAPP_PHONE_ID; los mensajes que
// inicia el club van con una plantilla aprobada por Meta (WHATSAPP_PLANTILLA, por omisión "aviso_progymnastics", idioma es_MX)
// cuyo cuerpo lleva {{1}} = título y {{2}} = texto. Meta no admite saltos de línea en los parámetros: se cambian por « · ».
const WA = process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID ? { token: process.env.WHATSAPP_TOKEN, id: process.env.WHATSAPP_PHONE_ID,
  plantilla: process.env.WHATSAPP_PLANTILLA || "aviso_progymnastics", idioma: process.env.WHATSAPP_IDIOMA || "es_MX" } : null;
const paramWA = (t, max) => String(t || "").replace(/\s*\n+\s*/g, " · ").replace(/\s{2,}/g, " ").trim().slice(0, max);
async function whatsapp(tel, n) {
  if (process.env.CORREO_PRUEBA) { log("[prueba] WhatsApp a ...", tel.slice(-4)); return; }
  const r = await fetch(`https://graph.facebook.com/v21.0/${WA.id}/messages`, {
    method: "POST", headers: { Authorization: "Bearer " + WA.token, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: tel, type: "template", template: { name: WA.plantilla, language: { code: WA.idioma },
      components: [{ type: "body", parameters: [{ type: "text", text: paramWA(n.titulo, 120) }, { type: "text", text: paramWA(n.texto, 900) }] }] } })
  });
  if (!r.ok) throw new Error("WhatsApp " + r.status + ": " + (await r.text()).slice(0, 200));
}

async function enviar(vapid) {
  const pend = await col("notificaciones").where("estado", "==", "pendiente").limit(200).get();
  if (pend.empty) return 0;
  webpush.setVapidDetails("mailto:" + (process.env.GMAIL_USER || "avisos@progymnastics.mx"), vapid.publica, vapid.privada);
  const correo = process.env.CORREO_PRUEBA ? nodemailer.createTransport({ jsonTransport: true })
    : process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
    : null;
  if (!correo) log("Sin GMAIL_USER / GMAIL_APP_PASSWORD: no se mandan correos.");
  if (!WA) log("Sin WHATSAPP_TOKEN / WHATSAPP_PHONE_ID: no se mandan WhatsApp.");
  let enviados = 0;
  const cache = {};
  for (const doc of pend.docs) {
    const n = doc.data();
    const dest = await destinatarios(n, cache);
    let correos = 0, celulares = 0, whatsapps = 0;
    if (correo) for (const para of dest.correos) {
      try { await correo.sendMail({ from: `"ProGymnastics México" <${process.env.GMAIL_USER || "avisos@progymnastics.mx"}>`, to: para, subject: n.titulo, text: `${n.titulo}\n\n${n.texto}\n\n${APP_URL}${n.url || ""}`, html: correoHTML(n) }); correos++; }
      catch (e) { log("Correo no enviado:", e.message); }
    }
    if (WA) for (const tel of dest.telefonos) {
      try { await whatsapp(tel, n); whatsapps++; } catch (e) { log("WhatsApp no enviado:", e.message); }
    }
    for (const uid of dest.uids) {
      const s = await col("suscripciones").doc(uid).get();
      const subs = (s.exists && s.data().subs) || {};
      for (const [k, sub] of Object.entries(subs)) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify({ titulo: n.titulo, texto: n.push || n.titulo, url: n.url || "", tag: doc.id }), { TTL: 86400 });
          celulares++;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) await s.ref.update({ ["subs." + k]: admin.firestore.FieldValue.delete() }); // el celular ya no existe
          else log("Push no enviado:", e.statusCode || e.message);
        }
      }
    }
    const alguien = dest.uids.length + dest.correos.length + dest.telefonos.length;
    await doc.ref.update({ estado: alguien ? "enviada" : "sin-destinatarios", enviada: new Date().toISOString(), atletas: dest.atletas, correos, celulares, whatsapps });
    enviados++;
  }
  return enviados;
}

// ---------- 4. contraseñas nuevas que pidió Administración (pg_claves/<uid>) ----------
async function claves() {
  const pend = await col("claves").limit(50).get();
  let n = 0;
  for (const doc of pend.docs) {
    const c = doc.data().clave;
    try {
      const u = await col("usuarios").doc(doc.id).get();
      if (u.exists && u.data().rol !== "SUPER" && typeof c === "string" && c.length >= 6) {
        if (!process.env.FIRESTORE_EMULATOR_HOST) await admin.auth().updateUser(doc.id, { password: c });
        n++;
      }
    } catch (e) { log("Contraseña no aplicada:", e.code || e.message); }
    await doc.ref.delete(); // nunca se queda guardada
  }
  return n;
}

const hoy = ahoraMX();
const k = await claves();
if (k) log(`${k} contraseña(s) nueva(s) aplicada(s).`);
const vapid = await llaves();
const r = await recordatorios(hoy);
const e = await enviar(vapid);
log(`Listo (${hoy.fecha} ${hoy.hora}:00 CDMX): ${r} recordatorio(s) nuevo(s), ${e} aviso(s) enviado(s).`);
process.exit(0);
