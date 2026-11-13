// etape.js: etapele clientului, listele de pe „Azi” și rapoartele.
// Fără Firebase și fără pagină, ca să poată fi testat singur (teste/etape.test.mjs).
import { norm, cifreTelefon } from './lead.js';

export const ETAPE = [
  { key: 'nou', label: 'Nou', culoare: '#3576c9', fundal: '#e5eefa' },
  { key: 'contactat', label: 'Contactat', culoare: '#0d6e8a', fundal: '#e0f2f6' },
  { key: 'asteapta', label: 'Așteaptă poze și cote', culoare: '#9c5c17', fundal: '#fbf0e2' },
  { key: 'studiu', label: 'Studiu programat', culoare: '#7a4fc9', fundal: '#efe8fb' },
  { key: 'oferta', label: 'Ofertă trimisă', culoare: '#c94f8f', fundal: '#fbe6f1' },
  { key: 'castigat', label: 'Câștigat', culoare: '#3f8f3f', fundal: '#e7f4e3' },
  { key: 'pierdut', label: 'Pierdut', culoare: '#c0453f', fundal: '#fbe8e6' }
];
export const ACTIVE = ['nou', 'contactat', 'asteapta', 'studiu', 'oferta'];
export const MOTIVE = ['Preț', 'A ales pe altcineva', 'Nu mai răspunde', 'Nu e momentul', 'Altceva'];
export const TIPURI_ISTORIC = [
  { key: 'apel', label: 'Apel', icon: 'ti-phone' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'ti-brand-whatsapp' },
  { key: 'mail', label: 'Mail', icon: 'ti-mail' },
  { key: 'vizita', label: 'Vizită', icon: 'ti-map-pin' },
  { key: 'nota', label: 'Notă', icon: 'ti-note' }
];
// Hotărârea lui Beia, 13 Nov 2026: în lucru sunt doar clienții veniți pe mail din 10 noiembrie încoace;
// cei de dinainte rămân în arhivă (lista „Clienți”), fără să apară pe „Azi” sau pe tabla cu etape.
export const DATA_START = '2026-11-10T00:00:00+02:00';

export function etapa(key) { return ETAPE.find(e => e.key === key) || ETAPE[0]; }
export function indexEtapa(key) { const i = ETAPE.findIndex(e => e.key === key); return i < 0 ? 0 : i; }

function ofertaVeche(c, deals) {
  const n = norm(c.nume);
  return n ? (deals || []).find(d => norm(d.clientNume) === n) : null;
}

// Etapa clientului; la fișele vechi, fără etapă, o deduce din câmpurile de dinainte.
export function etapaClient(c, deals) {
  if (c.etapa) return c.etapa;
  const d = ofertaVeche(c, deals);
  if (d) {
    if (d.etapa === 'client') return 'castigat';
    if (d.etapa === 'pierdut') return 'pierdut';
    if (d.etapa === 'oferta_trimisa' || d.etapa === 'negociere') return 'oferta';
  }
  if (c.notInterested) return 'pierdut';
  return c.contactat ? 'contactat' : 'nou';
}

// Cea mai departe etapă la care a ajuns clientul (pentru „drumul clienților”).
export function etapaMaxima(c, deals) {
  const e = etapaClient(c, deals);
  if (typeof c.etapaMax === 'number') return Math.max(c.etapaMax, e === 'pierdut' ? 0 : indexEtapa(e));
  if (e === 'castigat') return indexEtapa('castigat');
  if (e === 'pierdut') return c.etapaPierdere ? indexEtapa(c.etapaPierdere) : (c.contactat ? 1 : 0);
  return indexEtapa(e);
}

export function valoareClient(c, deals) {
  if (c.valoare !== undefined && c.valoare !== null && c.valoare !== '') return Number(c.valoare) || 0;
  const d = ofertaVeche(c, deals);
  return d ? Number(d.valoare) || 0 : 0;
}

// Pasul următor: { ce, la }. La fișele vechi vine din reapelare.
export function pasClient(c) {
  if (c.pasLa !== undefined || c.pasUrmator !== undefined) return { ce: c.pasUrmator || '', la: c.pasLa || '' };
  if (c.nextCallAt) return { ce: c.nextCallReason ? 'Sună din nou (' + c.nextCallReason.toLowerCase() + ')' : 'Sună din nou', la: c.nextCallAt };
  return { ce: '', la: '' };
}

export function inLucru(c, start = DATA_START) {
  if (c.reactivat) return true;
  const d = new Date(c.addedAt);
  return !isNaN(d.getTime()) && d >= new Date(start);
}

function chei(c) {
  const t = cifreTelefon(c.telefon);
  return { t: t.length >= 8 ? t : '', e: String(c.email || '').trim().toLowerCase() };
}

// Pentru un client adus din mail: fișa mai veche a aceluiași om (același telefon sau email), dacă există.
export function fisaVeche(c, toti) {
  if (!c.dinMail || c.revenitRespins) return null;
  const k = chei(c);
  if (!k.t && !k.e) return null;
  const cand = toti.filter(x => x.id !== c.id && String(x.addedAt || '') < String(c.addedAt || '') &&
    ((k.t && chei(x).t === k.t) || (k.e && chei(x).e === k.e)));
  cand.sort((a, b) => String(a.addedAt || '').localeCompare(String(b.addedAt || '')));
  return cand[0] || null;
}

function sfarsitZi(acum) { const d = new Date(acum); d.setHours(23, 59, 59, 999); return d; }
function inceputSaptamana(acum) {
  const d = new Date(acum); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// Tot ce apare pe „Azi”.
export function listeAzi(clients, deals, acum = new Date()) {
  const lucru = clients.filter(c => inLucru(c));
  const revenit = [], nesunati = [], pasi = [], faraPas = [];
  const sfarsit = sfarsitZi(acum);
  for (const c of lucru) {
    const e = etapaClient(c, deals);
    const p = pasClient(c);
    const vechi = fisaVeche(c, clients);
    if (vechi) { revenit.push({ c, vechi }); continue; }
    if (!ACTIVE.includes(e)) continue;
    if (p.la) {
      const la = new Date(p.la);
      if (!isNaN(la.getTime()) && la <= sfarsit) pasi.push({ c, e, p, intarziat: la < acum });
      continue;
    }
    if (e === 'nou') nesunati.push({ c, e });
    else faraPas.push({ c, e });
  }
  nesunati.sort((a, b) => String(b.c.addedAt || '').localeCompare(String(a.c.addedAt || '')));
  pasi.sort((a, b) => String(a.p.la).localeCompare(String(b.p.la)));
  faraPas.sort((a, b) => String(a.c.etapaLa || a.c.addedAt || '').localeCompare(String(b.c.etapaLa || b.c.addedAt || '')));
  revenit.sort((a, b) => String(b.c.addedAt || '').localeCompare(String(a.c.addedAt || '')));
  const oferte = lucru.filter(c => etapaClient(c, deals) === 'oferta');
  const lunSapt = inceputSaptamana(acum), urmSapt = new Date(lunSapt.getTime() + 7 * 864e5);
  const studii = lucru.filter(c => {
    if (etapaClient(c, deals) !== 'studiu') return false;
    const la = new Date(pasClient(c).la);
    return !isNaN(la.getTime()) && la >= lunSapt && la < urmSapt;
  });
  const celMaiVechi = nesunati.length ? nesunati[nesunati.length - 1].c.addedAt : '';
  return {
    revenit, nesunati, pasi, faraPas,
    cifre: {
      nesunati: nesunati.length + revenit.length,
      celMaiVechi,
      pasi: pasi.length,
      intarziati: pasi.filter(x => x.intarziat).length,
      oferte: oferte.length,
      valoareOferte: oferte.reduce((s, c) => s + valoareClient(c, deals), 0),
      studii: studii.length
    }
  };
}

/* ---------- Rapoarte ---------- */

export function inInterval(iso, interval) {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return (!interval.start || d >= interval.start) && (!interval.end || d < interval.end);
}

// Lead-uri pe săptămâni (luni-duminică), pe surse; ultimele n săptămâni, inclusiv cea curentă.
export function leadPeSaptamani(clients, acum = new Date(), n = 12) {
  const start0 = inceputSaptamana(acum);
  const sapt = [];
  for (let i = n - 1; i >= 0; i--) {
    const s = new Date(start0.getTime() - i * 7 * 864e5);
    sapt.push({ start: s, end: new Date(s.getTime() + 7 * 864e5), surse: {} });
  }
  const surse = new Set();
  for (const c of clients) {
    const d = new Date(c.addedAt);
    if (isNaN(d.getTime())) continue;
    const w = sapt.find(x => d >= x.start && d < x.end);
    if (!w) continue;
    const s = c.sursa || 'Fără sursă';
    surse.add(s);
    w.surse[s] = (w.surse[s] || 0) + 1;
  }
  return { saptamani: sapt, surse: [...surse].sort() };
}

// Câți clienți (veniți în interval) au ajuns la fiecare etapă.
export function drumulClientilor(clients, deals, interval) {
  const lista = clients.filter(c => inInterval(c.addedAt, interval));
  const pasi = ['nou', 'contactat', 'asteapta', 'studiu', 'oferta', 'castigat'];
  return pasi.map(k => ({
    key: k, label: k === 'nou' ? 'Lead-uri' : etapa(k).label,
    n: k === 'nou' ? lista.length : lista.filter(c => etapaMaxima(c, deals) >= indexEtapa(k)).length
  }));
}

// Tipul spațiului × problema, pentru clienții veniți în interval.
export function ceCerClientii(clients, interval) {
  const m = {}, randuri = new Set(), coloane = new Set();
  for (const c of clients.filter(x => inInterval(x.addedAt, interval))) {
    const r = c.tipSpatiu || 'Nespecificat', k = c.problema || 'Nespecificat';
    randuri.add(r); coloane.add(k);
    m[r] = m[r] || {};
    m[r][k] = (m[r][k] || 0) + 1;
  }
  return { matrice: m, randuri: [...randuri], coloane: [...coloane] };
}

function mediana(v) {
  if (!v.length) return null;
  const s = v.slice().sort((a, b) => a - b), i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}

// Timpul de la formular la primul contact, în ore.
export function vitezaRaspuns(clients, interval) {
  const lista = clients.filter(c => inInterval(c.addedAt, interval));
  const ore = [];
  let fara = 0;
  for (const c of lista) {
    if (!c.primulContactLa) {
      const nou = c.etapa ? c.etapa === 'nou' : !c.contactat && !c.notInterested;
      if (nou) fara++;
      continue;
    }
    const h = (new Date(c.primulContactLa) - new Date(c.addedAt)) / 36e5;
    if (!isNaN(h) && h >= 0) ore.push(h);
  }
  return {
    masurati: ore.length,
    mediana: mediana(ore),
    subOOra: ore.filter(h => h <= 1).length,
    subOZi: ore.filter(h => h <= 24).length,
    nesunati: fara
  };
}

export function rezultate(clients, deals, interval) {
  const lista = clients.filter(c => inInterval(c.addedAt, interval));
  const motive = {};
  let castigati = 0, valCastigat = 0, cuOferta = 0, valOferte = 0, pierdutiDupaOferta = 0;
  for (const c of lista) {
    const e = etapaClient(c, deals), max = etapaMaxima(c, deals), v = valoareClient(c, deals);
    if (e === 'pierdut') {
      const m = c.motivPierdere || 'Fără motiv scris';
      motive[m] = (motive[m] || 0) + 1;
      if (max >= indexEtapa('oferta')) pierdutiDupaOferta++;
    }
    if (max >= indexEtapa('oferta')) { cuOferta++; valOferte += v; }
    if (e === 'castigat') { castigati++; valCastigat += v; }
  }
  const inchise = castigati + pierdutiDupaOferta;
  return {
    motive, castigati, valCastigat, cuOferta, valOferte,
    rataCastig: inchise ? castigati / inchise : null
  };
}
