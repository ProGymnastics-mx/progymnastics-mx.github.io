# Uso: python3 -I tools/catalogo_gaf.py <Jueceofemenil>/app/datos/elementos_fig_wag.json modulos/normativos/catalogo-gaf.json
# OJO: si ya hay avances guardados, NO regenerar sin cuidar los ids (k): agregar elementos al final de su aparato.
# Genera modulos/normativos/catalogo-gaf.json (Normativos GAF) a partir del Código FIG femenil 2025-2028
# (descripciones en español UPAG, tomadas de Jueceofemenil/app/datos/elementos_fig_wag.json) más fundamentos
# de la progresión de las compulsorias USAG (niveles 1-5) y de la progresión USAG de salto (niveles 6-7).
import json, re, sys
src, out = sys.argv[1], sys.argv[2]
fig = json.load(open(src))
E, G = fig["E"], fig["grupos"]

FUND = {
 "SALTO": [
  ("Carrera y entrada al trampolín", [
   "Carrera con brazos coordinados (aceleración progresiva)", "Entrada al trampolín (hurdle) con despegue de dos pies",
   "Rebote en trampolín a salto extendido sobre colchón", "Rebote en trampolín a posición agrupada",
   "Rebote en trampolín a posición carpada abierta", "Rebote al apoyo agrupado sobre colchón elevado",
   "Rebote al parado de manos y caída de espalda plana en colchones (flat back)"]),
  ("Progresión USAG de salto", [
   "Inversión adelante (paloma) sobre pila de colchones, cuerpo extendido", "Inversión adelante sobre la mesa a caer de pie",
   "Entrada de Tsukahara (¼ – ½ giro) a pila de colchones", "Entrada de rondada al trampolín (entrada Yurchenko) con colchón de seguridad",
   "Entrada Yurchenko a pila de colchones (caída de espalda)"])],
 "BARRAS": [
  ("Fundamentos", [
   "Suspensión en barra (10 seg.)", "Apoyo frontal en barra baja (pecho hueco)", "Balanceo en suspensión con toma firme",
   "Elevación de rodillas al pecho en suspensión", "Elevación de piernas carpadas a tocar la barra en suspensión",
   "Salto al apoyo frontal en barra baja", "Subida de cadera (pullover)", "Impulso atrás (cast) a la horizontal",
   "Impulso atrás 45° sobre la horizontal", "Paso de pierna al apoyo a horcajadas (pasar una pierna)",
   "Vuelta de molino (mill circle) en apoyo a horcajadas", "Deslizamiento (glide) con cuerpo extendido",
   "Balanceo con golpe (tap swing) en barra alta", "Salida de sub-balanceo desde barra baja", "Salto de barra baja a barra alta"])],
 "VIGA": [
  ("Fundamentos", [
   "Caminar adelante en relevé", "Caminar hacia atrás", "Chassé lateral", "Pasos de punta (kick steps) a 45°",
   "Relevé en dos pies (2 seg.)", "Passé (retiré) en relevé (2 seg.)", "Balanza (arabesque) a 45° (2 seg.)",
   "Escuadra sentada (V-sit) 2 seg.", "Posición de cuclillas y ½ giro en cuclillas", "½ giro (pivote) en relevé sobre dos pies",
   "Salto extendido", "Salto tijera (paso tijera)", "Rol adelante con apoyo de manos", "Parado de manos en viga baja",
   "Salida en salto extendido", "Salida en salto agrupado", "Salida de rondada"])],
 "PISO": [
  ("Posiciones básicas y flexibilidad", [
   "Postura de pie firme (relevé)", "Posición de pecho hueco (hollow)", "Posición arqueada", "Posición agrupada sentada",
   "Posición carpada sentada (L)", "Vela (parado de hombros)", "Split frontal derecho", "Split frontal izquierdo",
   "Split lateral (piernas abiertas)", "Puente desde acostada", "Bajar a puente desde de pie", "Parado de manos (2 seg.)",
   "Parado de manos con rodada adelante", "Balanza (arabesque) 2 seg."]),
  ("Acrobacia básica", [
   "Rodada adelante agrupada", "Rodada adelante con piernas abiertas", "Rodada atrás agrupada", "Rodada atrás con piernas abiertas",
   "Rodada atrás extendida al parado de manos momentáneo", "Rueda de carro", "Paso adelante (walkover adelante)",
   "Paso atrás (walkover atrás)", "Rondada con rebote", "Rondada flic-flac", "Rondada flic-flac mortal atrás agrupado"]),
  ("Danza básica", [
   "Chassé", "Salto extendido", "Salto extendido con ½ giro (180°)", "Salto agrupado", "Salto tijera", "Zancada a 90°",
   "½ giro (180°) en relevé sobre un pie"])]
}
SALTOS_CODIGO = ["1.00","1.01","1.02","1.10","1.20","1.40","2.10","2.20","2.30","3.10","3.11","3.12","3.20","3.30",
                 "4.10","4.11","4.12","4.20","4.30","4.31","4.32","4.33","4.35","5.10","5.20"]
NOMBRE = {"SALTO": "Salto", "BARRAS": "Barras", "VIGA": "Viga", "PISO": "Piso"}

def limpia(d):
    t = (d or "").split("\n")[0].strip()
    t = re.sub(r"\s*\((?:[A-ZÁÉÍÓÚ][\w\-]+)\)\s*$", "", t)  # quita "(Kim)" al final; el nombre propio va aparte
    t = re.sub(r"\s+", " ", t).strip(" –-")
    return t[:1].upper() + t[1:]

aparatos = []
for ap in ["SALTO", "BARRAS", "VIGA", "PISO"]:
    clas = [{"nombre": n, "elementos": [{"n": x, "ref": "Fundamento"} for x in l]} for n, l in FUND[ap]]
    if ap == "SALTO":
        els = []
        for num in SALTOS_CODIGO:
            e = E["SALTO|" + num]
            ref = f"FIG {num} · {e['v']:.1f}" + (f" · {e['nom']}" if e.get("nom") else "")
            els.append({"n": limpia(e["d"]), "ref": ref})
        clas.append({"nombre": "Saltos del Código FIG", "elementos": els})
    else:
        for g, gn in sorted(G[ap].items(), key=lambda x: int(x[0])):
            els = sorted([e for e in E.values() if e["ap"] == ap and e["g"] == int(g) and e.get("l") in ("A", "B", "C") and e.get("d")],
                         key=lambda e: ("ABC".index(e["l"]), e["n"]))
            if not els: continue
            nombre = re.sub(r"^\d\.000\s*[―—–-]\s*", "", gn["es"]).strip().capitalize()
            clas.append({"nombre": nombre, "elementos": [{"n": limpia(e["d"]), "ref": f"FIG {e['n']} · {e['l']}" + (f" · {e['nom']}" if e.get("nom") else "")} for e in els]})
    i = 0
    for c in clas:
        for el in c["elementos"]:
            i += 1; el["k"] = f"GAF-{ap}-{i:03d}"
            el.update({"k": el.pop("k"), "n": el.pop("n"), "ref": el.pop("ref")})
    aparatos.append({"id": ap, "nombre": NOMBRE[ap], "clasificaciones": clas})

cat = {"seccion": "GAF",
       "fuente": "Normativos GAF de ProGymnastics (versión inicial, 17-nov-2026, para revisar con los entrenadores): fundamentos de la progresión de las compulsorias USAG (niveles 1-5) y de salto USAG (niveles 6-7), y los elementos A, B y C del Código de Puntuación FIG femenil 2025-2028 con su descripción oficial en español (traducción UPAG); en salto, los saltos principales del Código con su valor.",
       "nota": "Cada elemento tiene un id estable (k). Para agregar elementos, ponlos al final de su aparato con el siguiente número; no cambies ni reutilices ids, porque los avances de cada atleta se guardan con ellos.",
       "aparatos": aparatos}
json.dump(cat, open(out, "w"), ensure_ascii=False, indent=1)
for a in aparatos:
    print(a["nombre"], sum(len(c["elementos"]) for c in a["clasificaciones"]), [(c["nombre"], len(c["elementos"])) for c in a["clasificaciones"]])
