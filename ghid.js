// ghid.js: ghidul pentru apelul cu clientul. Un singur loc pentru text: pagina „Ghid”, fereastra
// „Ghid pentru apel” din fișa clientului și PDF-ul se fac din el. Teste: teste/ghid.test.mjs.
//
// Din ce iese:
// - metoda (viteza, ordinea întrebărilor, ascultarea, adaptarea): ~/beze-agent/cunostinte/business/discutia-cu-clientul.md
// - explicațiile despre acustică: ~/beze-agent/cunostinte/acustica/ (bas-in-camere-mici, absorbant-poros,
//   sala-de-repetitii, reverberatie) și izolare/; fără cifre de absorbție
// - prețuri și servicii: ~/beze-agent/canon/servicii.yaml și bezeacoustics.ro/products.json (13 Nov 2026)
// - ce nu se spune: ~/beze-agent/canon/formulari.yaml și cunostinte/business/afirmatii-despre-produs.md

export const VERSIUNE = '1.1, 13 noiembrie 2026';

export const PRINCIPII = [
  { titlu: 'Suni repede', text: 'Cererile de pe site se răcesc repede, iar cele mai multe firme răspund prea târziu. Clientul nou se sună primul.' },
  { titlu: 'Întâi întrebi, apoi propui', text: 'Afli cum e spațiul, ce îl deranjează și ce ar câștiga dacă s-ar rezolva. Abia apoi propui un pas.' },
  { titlu: 'Arăți că ai ascultat', text: 'Înainte să propui ceva, spui pe scurt ce ai înțeles. Omul se simte ascultat și te corectează dacă ai înțeles greșit.' },
  { titlu: 'Nu promiți un rezultat', text: 'Propui un pas concret (poze, studiu, set de panouri). Rezultatul acustic depinde și de cameră: îl verificăm cu măsurătoarea, nu îl promitem la telefon.' }
];

export const SURSE = [
  'Oldroyd, McElheran, Elkington, „The Short Life of Online Sales Leads”, Harvard Business Review, martie 2011 (pagina articolului).',
  'Rackham, „SPIN Selling”, 1988: ordinea întrebărilor (situația, problema, ce înseamnă pentru client, ce ar câștiga).',
  'Franke și Park, Journal of Marketing Research, 2006: vânzătorii care se adaptează fiecărui client vând mai bine (meta-analiză, rezumat).',
  'Ramsey și Sohi, Journal of the Academy of Marketing Science, 1997: clientul care se simte ascultat are mai multă încredere (rezumat).',
  'Regulile Beze: ~/beze-agent/cunostinte/business/discutia-cu-clientul.md și cunostinte/acustica/.'
];

// Ce trebuie să confirme Beia înainte ca ghidul să fie folosit de altcineva.
export const DE_CONFIRMAT = [
  'Studiul de 500 de lei se scade din lucrare, dacă omul lucrează cu noi (canon, 14 octombrie).',
  'Deplasarea pentru studiu e inclusă în București și Ilfov (din mesajul standard; canonul spune „poate fi gratuită, în funcție de distanță”).',
  'Ce set de panouri pentru ce cameră (după descrierile de pe site).',
  'Treptele: când propui recomandarea pe poze, când studiul și când setul din magazin.',
  'Frazele de explicație pentru fiecare problemă.'
];

/* ---------- Forme de spus, pe tipul spațiului și pe problemă ---------- */
const SPATIU = {
  'Studio sau home studio': 'un studio',
  'Cameră pentru podcast': 'o cameră pentru podcast',
  'Cameră pentru gaming sau streaming': 'o cameră de gaming sau streaming',
  'Birou': 'un birou',
  'Restaurant sau spațiu comercial': 'un restaurant sau un spațiu comercial',
  'Sală de repetiții': 'o sală de repetiții',
  'Home cinema': 'un home cinema',
  'Alt tip de spațiu': 'un spațiu'
};
const SUPRAFATA = { 'Sub 10 mp': ' de sub 10 m²', '10–20 mp': ' de 10–20 m²', '21–40 mp': ' de 21–40 m²', 'Peste 40 mp': ' de peste 40 m²' };
const PROBLEMA = {
  'Ecou puternic': 'și că vă deranjează ecoul',
  'Voce neclară': 'și că vocea se aude neclar',
  'Bas necontrolat': 'și că vă deranjează basul',
  'Mixurile sună diferit în alte locuri': 'și că mixurile sună diferit în alte locuri',
  'Nu știu ce tratament îmi trebuie': 'și că nu știți încă ce tratament vă trebuie',
  'Izolare (zgomot de la sau către vecini)': 'și că vă deranjează zgomotul de la vecini sau către ei'
};

/* ---------- Pașii apelului ---------- */
export const PASI = [
  {
    cheie: 'inainte', titlu: 'Înainte de apel (30 de secunde)',
    faci: [
      'Deschizi fișa clientului: ce spațiu are, cât de mare, ce îl deranjează și de când așteaptă.',
      'Citești explicația pentru problema lui (pasul 5) și treapta propusă (pasul 6).',
      'Dacă ai mai mulți clienți de sunat, îl suni întâi pe cel venit cel mai recent: e încă la telefon și își amintește de ce a scris.'
    ]
  },
  {
    cheie: 'deschidere', titlu: 'Deschiderea',
    spui: ['Bună ziua, vorbesc cu {nume}? Sunt {expeditor} de la BEZE Acoustics. Ați completat pe site formularul pentru consultanța acustică. Aveți două minute să vorbim acum?'],
    daca: [
      ['Nu are timp acum', '„Sigur. Când vă pot suna?” Notezi ora la „Gata”, ca pas următor.'],
      ['Nu-și amintește', '„Ați lăsat o cerere pe bezeacoustics.ro, despre {spatiu}. Vă sun să vă spun ce se poate face.”'],
      ['Nu răspunde', 'La „Gata”: „Nu a răspuns”, pas următor „Sună din nou” peste 2 ore. Îi trimiți și mesajul de WhatsApp din fișă.']
    ]
  },
  {
    cheie: 'confirmare', titlu: 'Confirmi ce a scris',
    spui: ['Văd că ați scris că vreți să tratați {spatiu}{suprafata} {problema}. Am înțeles bine?'],
    faci: ['Îl lași să povestească și nu-l întrerupi. Notezi cuvintele lui: le folosești mai târziu.']
  },
  {
    cheie: 'intrebari', titlu: 'Întrebările',
    faci: ['Le pui în ordinea de mai jos și sari peste ce ți-a spus deja. Nu e un interogatoriu: o întrebare, apoi asculți.']
  },
  {
    cheie: 'explicatie', titlu: 'Explici pe scurt',
    faci: ['Întâi repeți ce ai înțeles: „Deci, ca să văd dacă am înțeles: …”. Apoi spui explicația pentru problema lui, în cuvintele de mai jos. Nu dai cifre și nu intri în detalii tehnice.']
  },
  {
    cheie: 'pas', titlu: 'Propui pasul următor',
    faci: ['Propui o singură treaptă, cea de mai jos, și spui de ce. Dacă nu vrea, propui treapta de rezervă.']
  },
  {
    cheie: 'inchidere', titlu: 'Închizi cu un pas cu dată',
    spui: ['Atunci ne-am înțeles: {pasUrmator}. Vă trimit acum pe WhatsApp ce am vorbit, ca să-l aveți scris. Mulțumesc frumos!'],
    faci: [
      'Apeși „Gata” în CRM: ce s-a întâmplat (câteva cuvinte), etapa și pasul următor, cu ziua și ora.',
      'Trimiți din fișă mesajul „După apel” pe WhatsApp (sau „Mail de răspuns”, dacă nu are WhatsApp). Îl citești înainte să-l trimiți.'
    ]
  }
];

/* ---------- Întrebările (în ordinea metodei: situația, problema, ce înseamnă, ce ar câștiga, apoi logistica) ---------- */
export const INTREBARI = [
  { camp: 'folosire', grup: 'Situația', intreb: 'Pentru ce folosiți spațiul cel mai des?',
    ajutor: 'Studio: mix, voce, instrumente. Sală de repetiții: câți sunteți și ce instrumente. Restaurant sau birou: câți oameni sunt de obicei. Podcast: câte persoane vorbesc.' },
  { camp: 'dimensiuni', grup: 'Situația', intreb: 'Știți cam ce dimensiuni are? Lungimea, lățimea și cât e de înalt.', ajutor: 'Aproximativ e destul.' },
  { camp: 'constructie', grup: 'Situația', intreb: 'Din ce sunt făcuți pereții și tavanul? Și ce aveți pe jos?',
    ajutor: 'Pereți: cărămidă, BCA, beton, rigips. Tavan: beton, rigips, lemn. Pe jos: parchet, gresie, mochetă, covor. Ne trebuie pentru calcul și ca să știm cum se prind panourile.' },
  { camp: 'sistem', grup: 'Situația', intreb: 'Ce boxe sau ce sistem audio aveți acolo? Aveți și subwoofer?',
    ajutor: 'Studio: ce monitoare și unde sunt puse. Sală de repetiții sau home cinema: boxe, amplificatoare, subwoofer. Restaurant sau birou: boxele de ambient, dacă sunt. La bas contează și unde stau boxele.' },
  { camp: 'oras', grup: 'Situația', intreb: 'În ce oraș e spațiul?', ajutor: '' },
  { camp: 'deranjeaza', grup: 'Problema', intreb: 'Ce vă deranjează cel mai tare, concret? Când se aude?', ajutor: 'De exemplu: ecou când vorbiți, basul bubuie în colțuri, vocea înregistrată sună ca într-o cutie.' },
  { camp: 'incercat', grup: 'Problema', intreb: 'Ați încercat ceva până acum? Panouri, spumă, covoare, mobilier?', ajutor: 'Dacă are deja panouri: ce fel, cât de groase și unde sunt puse.' },
  { camp: 'implicatie', grup: 'Ce înseamnă pentru el', intreb: 'Cum vă încurcă asta?', ajutor: 'La mixuri, la înregistrări, la clienții din restaurant, la repetiții, la oboseală după o zi de lucru.' },
  { camp: 'castig', grup: 'Ce ar câștiga', intreb: 'Dacă s-ar rezolva, ce s-ar schimba pentru dumneavoastră?', ajutor: 'Răspunsul lui e motivul pentru care cumpără. Îl notezi cu cuvintele lui.' },
  { camp: 'termen', grup: 'Logistica', intreb: 'Până când ați vrea să fie gata?', ajutor: '' },
  { camp: 'buget', grup: 'Logistica', intreb: 'Aveți un buget în minte? Ne ajută să vă propunem direct varianta potrivită, de la un set de panouri pe care îl montați singur până la un proiect complet.', ajutor: 'Dacă nu vrea să spună, nu insiști.' },
  { camp: 'decide', grup: 'Logistica', intreb: 'Mai hotărăște cineva împreună cu dumneavoastră?', ajutor: 'Partenerul, asociatul, proprietarul spațiului.' }
];

/* ---------- Explicațiile, pe problemă ---------- */
export const EXPLICATII = {
  'Ecou puternic': 'Ecoul vine de la pereții, tavanul și podeaua tari, de care sunetul se tot întoarce. Panourile absorbante, puse pe suprafețele potrivite, opresc o parte din aceste întoarceri: camera sună mai liniștit și vorbirea se înțelege mai bine. Contează unde le puneți, nu doar câte.',
  'Voce neclară': 'Vocea se aude neclar când se amestecă sunetul direct cu reflexiile de pe pereți și tavan. Panourile puse unde trebuie reduc reflexiile, iar vocea se aude mai curat.',
  'Bas necontrolat': 'Basul e partea grea într-o cameră: depinde de dimensiunile camerei, de locul boxelor și de locul unde stați. Panourile subțiri nu-l rezolvă; e nevoie de absorbanți groși, puși unde trebuie. Ce se întâmplă exact la bas se vede la măsurătoare.',
  'Mixurile sună diferit în alte locuri': 'Camera în care ascultați schimbă sunetul: unele frecvențe se adună, altele aproape dispar, mai ales la bas. Atunci corectați mixul după cameră, nu după muzică. Măsurătoarea arată ce face camera, iar tratamentul se alege după ea.',
  'Nu știu ce tratament îmi trebuie': 'E normal, de asta suntem aici. Ne uităm întâi la cameră, din poze și din cote, și vă spunem ce are sens pentru ea și ce nu.',
  'Izolare (zgomot de la sau către vecini)': 'Aici e o diferență importantă: panourile acustice schimbă cum sună camera pe dinăuntru, dar nu opresc sunetul să treacă prin pereți spre vecini. Pentru asta e nevoie de izolare fonică, care e o lucrare diferită. Vă sună colegul meu care se ocupă de asta.',
  '': 'Spuneți-mi ce vă deranjează și vă explic de unde vine.'
};

/* ---------- Treptele ---------- */
export const TREPTE = {
  poze: {
    titlu: 'Recomandare pe poze, gratuită',
    spui: 'Trimiteți-ne pe WhatsApp câteva poze din mai multe unghiuri și cotele camerei. Vă trimitem o recomandare concretă: ce panouri, câte și unde le puneți.',
    dupa: 'Etapa „Așteaptă poze și cote”; pas următor: „Verifică dacă a trimis pozele și cotele”, peste 2 zile.',
    pasUrmator: 'ne trimiteți pozele și cotele, iar noi vă trimitem recomandarea'
  },
  studiu: {
    titlu: 'Studiul la fața locului, 500 de lei',
    spui: 'Putem veni să măsurăm camera. Facem măsurători acustice și luăm cotele, iar dumneavoastră primiți o analiză a camerei și un plan cu panourile amplasate. Studiul costă 500 de lei, iar dacă lucrăm împreună, suma se scade din lucrare. În București și Ilfov deplasarea e inclusă; pentru alt oraș, costul deplasării îl stabilim împreună.',
    dupa: 'Etapa „Studiu programat”; pas următor: ziua și ora vizitei. Dacă nu se poate stabili acum, „Sună pentru programarea studiului”, mâine.',
    pasUrmator: 'venim la studiul la fața locului în ziua stabilită'
  },
  kit: {
    titlu: 'Set de panouri din magazin',
    spui: 'Pentru o cameră ca a dumneavoastră avem și seturi gata făcute, pe care le montați singur, cu prinderile incluse: Basic, 2.599 de lei; Performance, 3.799 de lei; Pro, 5.499 de lei. Le găsiți pe bezeacoustics.ro și vă trimit acum linkul.',
    dupa: 'Etapa „Ofertă trimisă”, cu valoarea setului; pas următor: „Sună pentru răspuns”, peste 3 zile.',
    pasUrmator: 'vă trimit linkul către set și vă sun peste câteva zile'
  },
  beia: {
    titlu: 'Îl dai lui Beia',
    spui: 'Pentru asta vă sună colegul meu care se ocupă direct de astfel de lucrări. Când vă e bine să vă sune, azi sau mâine?',
    dupa: 'La „Gata”: „Pentru Beia: …” cu ce ai aflat; pas următor: „Beia sună”, la ora stabilită.',
    pasUrmator: 'vă sună colegul meu la ora stabilită'
  }
};
export const SETURI = [
  ['Basic', '2.599 lei', 'camere mici: birou acasă, podcast, gaming'],
  ['Performance', '3.799 lei', 'home studio, camere de 12-20 m²'],
  ['Pro', '5.499 lei', 'studiouri, camere de mix']
];

// Treapta propusă și pe cea de rezervă, după ce a completat clientul. Alegere de proces Beze (de confirmat de Beia).
export function alegeTreapta(c) {
  const tip = c.tipSpatiu || '', pr = c.problema || '', s = c.suprafata || '';
  if (pr.startsWith('Izolare')) return { treapta: 'beia', rezerva: null, motiv: 'Izolarea față de vecini e o lucrare separată; o discută Beia.' };
  if (tip === 'Home cinema') return { treapta: 'beia', rezerva: null, motiv: 'Home cinema-ul îl discută Beia, împreună cu partenerul pentru echipamente.' };
  if (pr === 'Bas necontrolat' || pr.startsWith('Mixurile')) return { treapta: 'studiu', rezerva: 'poze', motiv: 'La bas, ce se întâmplă depinde de cameră și se vede doar la măsurătoare.' };
  if (tip === 'Sală de repetiții' || tip === 'Restaurant sau spațiu comercial' || s === 'Peste 40 mp') return { treapta: 'studiu', rezerva: 'poze', motiv: 'Un spațiu mare sau o sală de repetiții are nevoie de cote exacte și de măsurători.' };
  if ((s === 'Sub 10 mp' || s === '10–20 mp') && ['Ecou puternic', 'Voce neclară', 'Nu știu ce tratament îmi trebuie', ''].includes(pr)) return { treapta: 'poze', rezerva: 'kit', motiv: 'Într-o cameră mică, cu ecou, o recomandare pe poze e un început bun; setul din magazin poate fi de ajuns.' };
  return { treapta: 'poze', rezerva: 'studiu', motiv: 'Întâi vedem camera din poze, apoi hotărâm dacă e nevoie de studiu.' };
}

/* ---------- Obiecțiile ---------- */
export const OBIECTII = [
  ['Cât costă?', 'Depinde de cameră. Seturile gata făcute pornesc de la 2.599 de lei. Pentru o recomandare exactă avem nevoie de poze și de cote, iar asta e gratuit.', 'Prețul unui proiect complet nu se spune la telefon: îl dă Beia, după ce vede camera.'],
  ['Găsesc spumă mai ieftină pe internet.', 'Spuma subțire prinde mai ales sunetele înalte: camera poate rămâne cu bas și cu un sunet înfundat. Panourile noastre au între 3 și 20 de centimetri de vată minerală, după model, și sunt făcute manual în atelierul nostru.', ''],
  ['Trimiteți-mi doar prețul pe mail.', 'Sigur. Ca să nu vă trimit un preț la întâmplare, am nevoie de cote și de câteva poze. Vi le cer acum pe WhatsApp și vă răspundem cu o recomandare și cu prețul ei.', ''],
  ['Mă mai gândesc.', 'Sigur. Ce v-ar ajuta să hotărâți? Pot să vă sun eu peste câteva zile, să vedem ce ați hotărât?', 'Programezi pasul la „Gata”, cu ziua pe care a acceptat-o.'],
  ['Garantați rezultatul?', 'Produsele au garanția legală. Rezultatul acustic depinde și de cameră, așa că nu vă promit o cifră la telefon: lucrăm cu o țintă clară și o verificăm cu măsurătoarea.', ''],
  ['Vreau să nu se mai audă la vecini.', 'Panourile acustice schimbă cum sună camera pe dinăuntru, dar nu opresc sunetul spre vecini. Asta e izolare fonică, o lucrare diferită: vă sună colegul meu.', 'Treapta „Îl dai lui Beia”.'],
  ['Pot să le montez singur?', 'Da, seturile vin cu prinderile incluse. Dacă vreți, le putem monta și noi, contra cost; vă spune colegul meu cât.', ''],
  ['Cât durează?', 'Panourile se fac în atelierul nostru în 1-2 săptămâni, apoi le livrăm prin curier, în toată țara.', ''],
  ['Am deja panouri, dar tot nu e bine.', 'Spuneți-mi ce panouri aveți și unde sunt puse. Uneori contează unde și cât de groase sunt, nu doar câte. O poză ne ajută mult.', ''],
  ['Sunt din alt oraș.', 'Livrăm în toată țara. Pentru studiul la fața locului, deplasarea o stabilim împreună, după distanță.', '']
];

/* ---------- Ce nu spui niciodată ---------- */
export const NICIODATA = [
  ['„Garantat”, „nu se mai aude nimic”, „100%”', 'o țintă, verificată cu măsurătoarea'],
  ['„Absoarbe tot basul”, „de la 40 Hz”', '„ajută la bas, cu absorbanți groși, puși unde trebuie”'],
  ['„Certificat” (despre panouri)', 'dacă întreabă de foc: „textilul e clasificat B1 după DIN 4102”'],
  ['„Cel mai bun”, „primii”, „singurii”', '„făcute manual în atelierul nostru”'],
  ['„Izolare” când e vorba de panouri', '„tratament acustic”'],
  ['„Zero fibre în aer”', 'nimic: nu e verificat încă'],
  ['Prețul unui proiect, la telefon', '„vi-l spune colegul meu, după ce vede camera”'],
  ['Cifre tehnice (NRC, clase, decibeli)', '„vă explicăm în recomandare”']
];

export const LA_BEIA = [
  'Prețul pentru un proiect sau o ofertă la comandă.',
  'Izolarea față de vecini.',
  'Home cinema.',
  'O întrebare tehnică la care ghidul nu are răspuns. Nu ghicești: „Vă răspunde colegul meu, azi sau mâine.”',
  'O reclamație sau o problemă cu o comandă.'
];

/* ---------- Pe tipul spațiului ---------- */
export const SPATII = {
  'Studio sau home studio': {
    vrea: 'Să audă corect ce mixează și ce înregistrează.',
    intrebi: 'Unde stau masa și monitoarele, ce monitoare are, dacă are subwoofer.',
    propui: 'Bas sau mixuri: studiul. Ecou într-o cameră mică: poze, apoi setul Performance (12-20 m²) sau Basic.',
    atentie: 'Basul nu se rezolvă cu panouri subțiri.'
  },
  'Cameră pentru podcast': {
    vrea: 'Vocea curată, fără ecou.',
    intrebi: 'Câte persoane vorbesc, ce microfoane folosesc.',
    propui: 'Poze, apoi setul Basic.',
    atentie: 'Nu promiți „sunet de studio”.'
  },
  'Cameră pentru gaming sau streaming': {
    vrea: 'Vocea de pe stream fără ecou, o cameră care sună plăcut.',
    intrebi: 'Unde e microfonul, ce mai e în cameră (mobilier, covor).',
    propui: 'Poze, apoi setul Basic.',
    atentie: ''
  },
  'Birou': {
    vrea: 'Oamenii să se audă bine, mai puțină oboseală.',
    intrebi: 'Câți oameni lucrează acolo, ce tavan are, cât e de înalt.',
    propui: 'Poze. Dacă e mare (peste 40 m²): studiul.',
    atentie: ''
  },
  'Restaurant sau spațiu comercial': {
    vrea: 'Clienții să se audă fără să strige; un loc plăcut.',
    intrebi: 'Câți oameni sunt de obicei, ce tavan are (înălțime, din ce e făcut), ce e pe pereți.',
    propui: 'Studiul la fața locului.',
    atentie: 'Contează și cum arată: panourile se fac în mai multe culori.'
  },
  'Sală de repetiții': {
    vrea: 'Trupa să se audă clar între ei, fără să le țiuie urechile.',
    intrebi: 'Câți sunt în trupă, ce instrumente (tobe?), cotele și înălțimea.',
    propui: 'Studiul la fața locului.',
    atentie: 'Într-o cameră mică, trupa sună tare oricum: volumul camerei contează primul. Dacă sala e mică, Beia spune de la început ce se poate și ce nu. Dacă întreabă de vecini: izolarea o discută Beia.'
  },
  'Home cinema': {
    vrea: 'Sunet de cinema acasă.',
    intrebi: 'Cotele camerei, câte locuri, ce echipament are sau vrea.',
    propui: 'Îl dai lui Beia.',
    atentie: 'Echipamentele le face un partener; tu doar afli datele.'
  },
  'Alt tip de spațiu': {
    vrea: 'Afli ce e spațiul și la ce îl folosește.',
    intrebi: 'Ce e, cât de mare, cine e de obicei înăuntru.',
    propui: 'Poze.',
    atentie: ''
  }
};

/* ---------- Ghidul potrivit pentru un client ---------- */
function umple(text, v) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));
}

export function scenariu(c, expeditor) {
  const t = alegeTreapta(c);
  const valori = {
    nume: c.nume || 'domnul / doamna',
    expeditor: expeditor || 'colegul de la BEZE Acoustics',
    spatiu: SPATIU[c.tipSpatiu] || 'spațiul dumneavoastră',
    suprafata: SUPRAFATA[c.suprafata] || '',
    problema: PROBLEMA[c.problema] || '',
    pasUrmator: TREPTE[t.treapta].pasUrmator
  };
  const pasi = PASI.map(p => ({
    ...p,
    spui: (p.spui || []).map(s => umple(s, valori).replace(/\s+\./g, '.')),
    daca: (p.daca || []).map(([cand, ce]) => [cand, umple(ce, valori)])
  }));
  return {
    pasi,
    explicatie: EXPLICATII[c.problema] !== undefined ? EXPLICATII[c.problema] : EXPLICATII[''],
    treapta: { key: t.treapta, ...TREPTE[t.treapta], motiv: t.motiv },
    rezerva: t.rezerva ? { key: t.rezerva, ...TREPTE[t.rezerva] } : null,
    spatiu: SPATII[c.tipSpatiu] || SPATII['Alt tip de spațiu'],
    obiectii: OBIECTII.map(([a, b, n]) => [a, umple(b, valori), n])
  };
}

// Toate textele ghidului, pentru teste (formulări interzise, liniuțe lungi, acolade rămase).
export function toateTextele() {
  const out = [];
  const add = x => { if (typeof x === 'string') out.push(x); else if (Array.isArray(x)) x.forEach(add); else if (x && typeof x === 'object') Object.values(x).forEach(add); };
  // Din „ce nu spui niciodată” intră doar coloana cu ce spui în loc.
  add([PRINCIPII, DE_CONFIRMAT, PASI, INTREBARI, EXPLICATII, TREPTE, SETURI, OBIECTII, NICIODATA.map(r => r[1]), LA_BEIA, SPATII]);
  return out;
}
