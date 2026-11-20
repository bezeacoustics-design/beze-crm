// lead.js: ce vine din formularele de pe bezeacoustics.ro și textele de răspuns.
// Fără Firebase și fără pagină, ca să poată fi testat singur (teste/lead.test.mjs).

// Variantele din formularul de pe /pages/landing-page (citit pe 13 Nov 2026),
// scrise cu diacritice. „Sală de repetiții”, „Home cinema” și „Izolare” nu sunt în formular:
// sunt pentru clienții adăugați de mână (telefon, recomandare).
export const TIP_SPATIU = [
  'Studio sau home studio',
  'Cameră pentru podcast',
  'Cameră pentru gaming sau streaming',
  'Birou',
  'Restaurant sau spațiu comercial',
  'Sală de repetiții',
  'Home cinema',
  'Alt tip de spațiu'
];
export const SUPRAFATA = ['Sub 10 mp', '10–20 mp', '21–40 mp', 'Peste 40 mp', 'Nu știu exact'];
export const PROBLEMA = [
  'Ecou puternic',
  'Voce neclară',
  'Bas necontrolat',
  'Mixurile sună diferit în alte locuri',
  'Nu știu ce tratament îmi trebuie',
  'Izolare (zgomot de la sau către vecini)'
];
export const SURSE = ['Site (formular)', 'Facebook Ads', 'Instagram Ads', 'Google Ads', 'Recomandare', 'Telefon sau WhatsApp direct', 'Altele'];

// Prefixele de țară (planul ITU-T E.164) pentru țările de la care e probabil să vină un client.
export const TARI = [
  ['RO', 'România', '40'], ['MD', 'Moldova', '373'], ['HU', 'Ungaria', '36'], ['BG', 'Bulgaria', '359'],
  ['RS', 'Serbia', '381'], ['UA', 'Ucraina', '380'], ['DE', 'Germania', '49'], ['AT', 'Austria', '43'],
  ['IT', 'Italia', '39'], ['ES', 'Spania', '34'], ['FR', 'Franța', '33'], ['GB', 'Marea Britanie', '44'],
  ['IE', 'Irlanda', '353'], ['NL', 'Olanda', '31'], ['BE', 'Belgia', '32'], ['CH', 'Elveția', '41'],
  ['PL', 'Polonia', '48'], ['CZ', 'Cehia', '420'], ['GR', 'Grecia', '30'], ['PT', 'Portugalia', '351'],
  ['SE', 'Suedia', '46'], ['DK', 'Danemarca', '45'], ['NO', 'Norvegia', '47'], ['US', 'SUA', '1'], ['CA', 'Canada', '1']
];
const PREFIX = Object.fromEntries(TARI.map(([cod, , p]) => [cod, p]));

// Text fără diacritice, cu litere mici, cu cratimele unificate: pentru comparații.
export function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[‐-―]/g, '-').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Varianta din listă care se potrivește cu textul primit (de exemplu „Nu stiu exact” → „Nu știu exact”).
export function canonic(valoare, lista) {
  const n = norm(valoare);
  if (!n) return '';
  return lista.find(x => norm(x) === n) || String(valoare).trim();
}

// Aceeași lungime ca textul inițial, ca pozițiile să rămână valabile.
function pliaza(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const f = c.normalize('NFD')[0].toLowerCase()[0];
    out += /[‐-―]/.test(f) ? '-' : f;
  }
  return out;
}

const ETICHETE = [
  ['tara', /cod tara\s*:/g],
  ['tipSpatiu', /ce tip de spatiu[^:\n]{0,40}:/g],
  ['suprafata', /care sunt dimensiunile[^:\n]{0,60}:/g],
  ['problema', /ce problema observi[^:\n]{0,40}:/g],
  ['nume', /(?:^|\n)[ \t]*(?:name|nume)[ \t]*:/g],
  ['email', /(?:^|\n)[ \t]*e-?mail[ \t]*:/g],
  ['telefon', /(?:^|\n)[ \t]*(?:phone|telefon)[ \t]*:/g],
  ['subiect', /(?:^|\n)[ \t]*subiect[ \t]*:/g],
  ['mesaj', /(?:^|\n)[ \t]*(?:mesaj|message|body)[ \t]*:/g]
];

// Citește textul unui mail „Mesaj nou de la client” (copiat din webmail).
// Întoarce câmpurile găsite; ce lipsește rămâne gol.
export function citesteMail(text) {
  const t = String(text || '').replace(/\r\n?/g, '\n');
  const p = pliaza(t);
  const gasite = [];
  for (const [camp, re] of ETICHETE) {
    re.lastIndex = 0;
    const m = re.exec(p);
    if (m) gasite.push({ camp, start: m.index, end: m.index + m[0].length });
  }
  gasite.sort((a, b) => a.start - b.start);
  const brut = {};
  gasite.forEach((g, i) => {
    const urm = i + 1 < gasite.length ? gasite[i + 1].start : t.length;
    brut[g.camp] = t.slice(g.end, urm).replace(/\n{3,}/g, '\n\n').trim();
  });
  const formular = brut.tipSpatiu || brut.suprafata || brut.problema ? 'pagina de consultanță'
    : brut.subiect ? 'pagina Contact' : (brut.nume || brut.email) ? 'formularul scurt' : '';
  return {
    nume: (brut.nume || '').split('\n')[0].trim(),
    email: (brut.email || '').split(/\s/)[0].trim(),
    telefonBrut: (brut.telefon || '').split('\n')[0].trim(),
    tara: (brut.tara || '').split('\n')[0].trim().toUpperCase().slice(0, 2),
    tipSpatiu: canonic((brut.tipSpatiu || '').split('\n')[0], TIP_SPATIU),
    suprafata: canonic((brut.suprafata || '').split('\n')[0], SUPRAFATA),
    problema: canonic((brut.problema || '').split('\n')[0], PROBLEMA),
    subiect: (brut.subiect || '').split('\n')[0].trim(),
    mesaj: brut.mesaj || '',
    formular
  };
}

function cifre(s) { return String(s || '').replace(/\D/g, ''); }

// Telefonul în forma „+40 724 500 507”. ok = false dacă numărul nu are lungimea unui număr real.
export function normalizeazaTelefon(brut, tara) {
  const t = String(brut || '').trim();
  let d = cifre(t);
  if (!d) return { telefon: '', cifre: '', ok: false };
  const cod = (tara || 'RO').toUpperCase();
  let intl;
  if (t.startsWith('+')) intl = d;
  else if (d.startsWith('00')) intl = d.slice(2);
  else if (cod === 'RO') {
    if (d.startsWith('40') && d.length === 11) intl = d;
    else if (d.startsWith('0') && d.length === 10) intl = '40' + d.slice(1);
    else if (d.length === 9) intl = '40' + d;
    else intl = '40' + d.replace(/^0/, '');
  } else {
    const p = PREFIX[cod] || '';
    if (p && d.startsWith(p) && d.length > p.length + 6) intl = d;
    else intl = p + d.replace(/^0/, '');
  }
  if (intl.startsWith('40')) {
    const r = intl.slice(2);
    const ok = r.length === 9;
    return { telefon: '+40 ' + [r.slice(0, 3), r.slice(3, 6), r.slice(6)].filter(Boolean).join(' '), cifre: intl, ok };
  }
  const p = Object.values(PREFIX).sort((a, b) => b.length - a.length).find(x => intl.startsWith(x)) || '';
  const rest = intl.slice(p.length);
  return { telefon: '+' + (p ? p + ' ' + rest : intl), cifre: intl, ok: intl.length >= 8 && intl.length <= 15 };
}

export function cifreTelefon(telefon) { return cifre(telefon); }

// Cât timp a trecut de la o dată, spus scurt: „acum 3 ore”, „ieri”, „acum 5 zile”.
export function vechime(iso, acum = new Date()) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const min = Math.floor((acum - d) / 60000);
  if (min < 1) return 'acum';
  if (min < 60) return 'acum ' + min + ' min';
  const ore = Math.floor(min / 60);
  if (ore < 24) return ore === 1 ? 'acum o oră' : 'acum ' + ore + ' ore';
  const zile = Math.floor(ore / 24);
  if (zile === 1) return 'ieri';
  if (zile < 14) return 'acum ' + zile + ' zile';
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ---------- Textele de răspuns ----------
   Pornesc de la ~/beze-social/reclame/raspuns-lead.md. Frazele despre problemă, altele decât ecoul,
   și varianta pentru sala de repetiții sunt scrise nou, de citit de Beia. */

const SPATIU_LUNG = {
  'Studio sau home studio': 'un studio / home studio',
  'Cameră pentru podcast': 'o cameră pentru podcast',
  'Cameră pentru gaming sau streaming': 'o cameră de gaming sau streaming',
  'Birou': 'un birou',
  'Restaurant sau spațiu comercial': 'un restaurant sau un spațiu comercial',
  'Sală de repetiții': 'o sală de repetiții',
  'Home cinema': 'un home cinema'
};
const SPATIU_SCURT = {
  'Studio sau home studio': 'studio',
  'Cameră pentru podcast': 'camera de podcast',
  'Cameră pentru gaming sau streaming': 'camera de gaming',
  'Birou': 'birou',
  'Restaurant sau spațiu comercial': 'spațiul tău',
  'Sală de repetiții': 'sala de repetiții',
  'Home cinema': 'home cinema'
};
const SUPRAFATA_FRAZA = {
  'Sub 10 mp': 'de sub 10 m²', '10–20 mp': 'de 10–20 m²', '21–40 mp': 'de 21–40 m²', 'Peste 40 mp': 'de peste 40 m²'
};
const PROBLEMA_FRAZA = {
  'Ecou puternic': ' și că problema principală este ecoul. Asta e o veste bună, pentru că ecoul se rezolvă bine cu tratament acustic, dacă panourile sunt alese și puse unde trebuie.',
  'Voce neclară': ' și că vocea se aude neclar. Ecoul și reflexiile din cameră strică claritatea vocii, iar pe ele le controlează tratamentul acustic, dacă panourile sunt alese și puse unde trebuie.',
  'Bas necontrolat': ' și că basul e greu de controlat. La bas contează dimensiunile camerei și locul boxelor, nu doar panourile, de aceea vrem să vedem întâi camera.',
  'Mixurile sună diferit în alte locuri': ' și că mixurile sună diferit în alte locuri. Camera în care asculți colorează sunetul, iar tratamentul acustic te ajută să auzi mai corect ce e de fapt în mix.',
  'Nu știu ce tratament îmi trebuie': ' și că nu știi încă ce tratament îți trebuie. E normal: de aceea ne uităm întâi la cameră și abia apoi îți spunem ce are sens pentru ea.',
  'Izolare (zgomot de la sau către vecini)': ' și că te deranjează zgomotul de la vecini sau către ei. Panourile acustice controlează sunetul din cameră, dar nu opresc sunetul să treacă prin pereți: asta e izolare fonică, o lucrare diferită, pe care o discutăm separat.'
};
const PROBLEMA_SCURT = {
  'Ecou puternic': 'ecoul', 'Voce neclară': 'vocea care se aude neclar', 'Bas necontrolat': 'basul',
  'Mixurile sună diferit în alte locuri': 'mixurile care sună diferit în alte locuri',
  'Nu știu ce tratament îmi trebuie': 'tratamentul acustic', 'Izolare (zgomot de la sau către vecini)': 'zgomotul de la vecini'
};

function varianta(tip) {
  if (tip === 'Restaurant sau spațiu comercial' || tip === 'Birou') return 'comercial';
  if (tip === 'Home cinema') return 'cinema';
  if (tip === 'Sală de repetiții') return 'repetitii';
  return 'studio';
}
const DETALII = {
  studio: { poze: 'unde sunt ușa și ferestrele și cum sunt așezate biroul și monitoarele', folosire: '**Pentru ce folosești camera cel mai des:** mix, voce, instrumente, podcast.', pozeScurt: 'biroul și monitoarele', ceFaci: 'ce faci cel mai des acolo' },
  comercial: { poze: 'unde sunt ușa și ferestrele, zona în care stau oamenii și tavanul', folosire: '**Câți oameni sunt de obicei înăuntru.**', pozeScurt: 'zona în care stau oamenii și tavanul', ceFaci: 'câți oameni sunt de obicei înăuntru' },
  cinema: { poze: 'unde sunt ușa și ferestrele, ecranul, boxele și locurile', folosire: '**Câte locuri are sala și dacă e nevoie și de izolare față de restul casei.**', pozeScurt: 'ecranul, boxele și locurile', ceFaci: 'câte locuri are sala' },
  repetitii: { poze: 'unde sunt ușa și ferestrele și unde stau tobele, amplificatoarele și oamenii', folosire: '**Cine cântă acolo:** câți oameni și ce instrumente.', pozeScurt: 'tobele, amplificatoarele și locul fiecăruia', ceFaci: 'câți oameni cântă și ce instrumente' }
};

function fara(s) { return s.replace(/\*\*/g, ''); }

export function mesajEmail(c) {
  const v = DETALII[varianta(c.tipSpatiu)];
  const camera = varianta(c.tipSpatiu) === 'comercial' ? 'spațiul tău' : 'camera ta';
  const spatiu = SPATIU_LUNG[c.tipSpatiu] || 'un spațiu';
  const supr = SUPRAFATA_FRAZA[c.suprafata] ? ' ' + SUPRAFATA_FRAZA[c.suprafata] : '';
  const prob = PROBLEMA_FRAZA[c.problema] || '.';
  const subiect = 'Următorul pas pentru ' + camera + ' | BEZE Acoustics';
  const corp = [
    'Salutare, ' + (c.nume || '') + '!',
    '',
    'Mulțumim pentru mesaj. Am văzut că vrei să tratezi ' + spatiu + supr + prob,
    '',
    'Ca să-ți facem o recomandare pe măsura ' + (camera === 'camera ta' ? 'camerei tale' : 'spațiului tău') + ', avem nevoie de câteva detalii:',
    '',
    '- Dimensiunile camerei: lungime, lățime și înălțime (aproximativ e suficient).',
    '- Câteva poze, din cât mai multe unghiuri: să vedem ' + v.poze + '.',
    '- ' + fara(v.folosire),
    '- Un buget orientativ, dacă ai deja unul în minte. Ne ajută să-ți propunem direct varianta potrivită, de la un set de panouri pe care le montezi singur până la un proiect complet.',
    '',
    'Cu aceste informații îți trimitem o recomandare concretă: ce panouri, câte și unde le pui.',
    '',
    'Dacă vrei să mergem mai departe, poți alege studiul acustic la fața locului. Venim la tine, facem măsurători acustice și luăm cotele camerei. Pe baza lor primești o analiză acustică a spațiului tău și un plan cu panourile amplasate în camera ta.',
    '',
    'Studiul costă 500 de lei. În București și Ilfov deplasarea e inclusă. Pentru alte orașe, costul deplasării îl stabilim împreună, în funcție de distanță. Dacă te interesează, spune-ne din ce oraș ești.',
    '',
    'Ne poți răspunde direct la acest mail sau ne poți suna/scrie la 0720 505 867.',
    '',
    '-- ',
    'Cu drag,',
    'Echipa BEZE Acoustics',
    '',
    'T: +40720505867',
    'E: contact@bezeacoustics.ro',
    'W: https://bezeacoustics.ro/'
  ].join('\n');
  return { subiect, corp };
}

export function mesajWhatsApp(c, expeditor) {
  const v = DETALII[varianta(c.tipSpatiu)];
  const desprece = PROBLEMA_SCURT[c.problema];
  const unde = SPATIU_SCURT[c.tipSpatiu];
  let primit = 'Am primit mesajul tău';
  if (desprece) primit += ' despre ' + desprece + (unde ? ' din ' + unde : '');
  else if (unde) primit += ' despre ' + unde;
  return [
    'Salut, ' + (c.nume || '') + '! Sunt ' + (expeditor || 'echipa') + ' de la BEZE Acoustics. ' + primit + '. Ca să-ți dăm o recomandare concretă, trimite-ne te rog:',
    '• dimensiunile camerei (L × l × înălțime)',
    '• câteva poze din mai multe unghiuri, să vedem ușa, ferestrele, ' + v.pozeScurt,
    '• ' + v.ceFaci,
    '',
    'Cu ele îți spunem ce panouri, câte și unde. Dacă vrei, putem veni și noi să măsurăm camera: primești o analiză acustică și un plan cu panourile în spațiul tău. Studiul costă 500 de lei, cu deplasarea inclusă în București și Ilfov. Din ce oraș ești? Mersi!'
  ].join('\n');
}

// După apel: cerem cotele și pozele, ca să pregătim raportul. Pe „dumneavoastră”, ca la telefon (ghidul de apel).
export function mesajWhatsAppDupaApel(c, expeditor) {
  const tip = varianta(c.tipSpatiu);
  const v = DETALII[tip];
  const com = tip === 'comercial';
  const salut = c.nume ? 'Bună ziua, ' + c.nume + '!' : 'Bună ziua!';
  const cine = expeditor ? 'Sunt ' + expeditor + ' de la BEZE Acoustics.' : 'Vă scriem de la BEZE Acoustics.';
  return [
    salut + ' ' + cine + ' Așa cum am vorbit la telefon, ca să vă pregătim raportul acustic pentru ' + (com ? 'spațiul' : 'camera') + ' dumneavoastră, avem nevoie de:',
    '• cotele ' + (com ? 'spațiului' : 'camerei') + ': lungime, lățime, înălțime (dacă aveți un plan sau un releveu, e și mai bine)',
    '• ' + v.poze + ' (o schiță de mână ajunge)',
    '• câteva poze, din fiecare colț, cu ' + (com ? 'tot spațiul' : 'toată camera') + ' în cadru',
    '',
    'Când le primim, vă trimitem raportul: ce se întâmplă acum în ' + (com ? 'spațiu' : 'cameră') + ' și ce panouri vă recomandăm, câte și unde. Mulțumesc!'
  ].join('\n');
}
