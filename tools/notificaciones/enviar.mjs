/* ProGymnastics — tarea automática de notificaciones (la corre .github/workflows/notificaciones.yml cada 15 minutos).
   1. Llaves VAPID para Web Push: si no existen, las crea; la privada queda en pg_config/push (ningún usuario la puede leer)
      y la pública en pg_config_publica/push (la lee la app para suscribir el celular).
   2. Recordatorios de mensualidad (hora de Ciudad de México, de 9:00 a 21:00): 3 días antes del día límite, el día límite y
      un día después si venció. Uno por atleta, mes y tipo (el id del aviso evita repetidos).
   3. Envía los avisos pendientes (pg_notificaciones con estado "pendiente") por correo (Gmail del club) y al celular (Web Push)
      a las cuentas ligadas al atleta (pg_usuarios.atletas), y los marca como enviados.
   Solo toca colecciones pg_* (el proyecto de Firebase es compartido con AKC).
   Variables: FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de servicio), GMAIL_USER y GMAIL_APP_PASSWORD (contraseña de aplicación),
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
  let n = 0;
  for (const doc of atletas.docs) {
    const a = doc.data();
    if (a.activo === false) continue;
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
        atletaId: doc.id, tipo: tipo === "vencido" ? "vencido" : "recordatorio", titulo: t[0],
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
    <p style="font-size:12px;color:#6c6c70;text-align:center;margin-top:14px">ProGymnastics México · Recibes este correo porque tu cuenta está ligada a este atleta.</p>
  </div></body></html>`;
}

async function enviar(vapid) {
  const pend = await col("notificaciones").where("estado", "==", "pendiente").limit(200).get();
  if (pend.empty) return 0;
  webpush.setVapidDetails("mailto:" + (process.env.GMAIL_USER || "avisos@progymnastics.mx"), vapid.publica, vapid.privada);
  const correo = process.env.CORREO_PRUEBA ? nodemailer.createTransport({ jsonTransport: true })
    : process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
    : null;
  if (!correo) log("Sin GMAIL_USER / GMAIL_APP_PASSWORD: se envía solo al celular.");
  let enviados = 0;
  for (const doc of pend.docs) {
    const n = doc.data();
    const usuarios = (await col("usuarios").where("atletas", "array-contains", n.atletaId).get()).docs.filter((u) => ["TUTOR", "ATLETA"].includes(u.data().rol));
    let correos = 0, celulares = 0;
    for (const u of usuarios) {
      const x = u.data();
      // Correo real de la persona: `correo`; las cuentas con usuario entran con un correo interno (.invalid) que no recibe nada.
      const para = x.correo || (x.email && !x.email.endsWith(".invalid") ? x.email : "");
      if (correo && para) {
        try { await correo.sendMail({ from: `"ProGymnastics México" <${process.env.GMAIL_USER || "avisos@progymnastics.mx"}>`, to: para, subject: n.titulo, text: `${n.titulo}\n\n${n.texto}\n\n${APP_URL}${n.url || ""}`, html: correoHTML(n) }); correos++; }
        catch (e) { log("Correo no enviado a una cuenta:", e.message); }
      }
      const s = await col("suscripciones").doc(u.id).get();
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
    await doc.ref.update({ estado: usuarios.length ? "enviada" : "sin-destinatarios", enviada: new Date().toISOString(), correos, celulares });
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
