// Teste pentru etape.js. Rulare: node --test teste/   (date inventate)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etapaClient, etapaMaxima, pasClient, inLucru, fisaVeche, listeAzi, leadPeSaptamani, drumulClientilor,
  ceCerClientii, vitezaRaspuns, rezultate, valoareClient, indexEtapa } from '../etape.js';

const ACUM = new Date('2026-11-14T12:00:00+02:00');
const h = n => new Date(ACUM.getTime() - n * 36e5).toISOString();
const z = n => new Date(ACUM.getTime() - n * 864e5).toISOString();

test('etapa la fișele vechi se deduce din câmpurile de dinainte', () => {
  assert.equal(etapaClient({ contactat: false }), 'nou');
  assert.equal(etapaClient({ contactat: true }), 'contactat');
  assert.equal(etapaClient({ contactat: true, notInterested: true }), 'pierdut');
  const deals = [{ clientNume: 'Ion Test', etapa: 'client', valoare: 1000 }];
  assert.equal(etapaClient({ nume: 'ion test', contactat: true }, deals), 'castigat');
  assert.equal(valoareClient({ nume: 'Ion Test' }, deals), 1000);
  assert.equal(etapaClient({ etapa: 'studiu', contactat: false }), 'studiu');
});

test('etapa maximă: un pierdut după ofertă a ajuns la ofertă', () => {
  assert.equal(etapaMaxima({ etapa: 'pierdut', etapaPierdere: 'oferta' }), indexEtapa('oferta'));
  assert.equal(etapaMaxima({ etapa: 'pierdut', etapaMax: 3 }), 3);
  assert.equal(etapaMaxima({ etapa: 'castigat' }), indexEtapa('castigat'));
  assert.equal(etapaMaxima({ etapa: 'asteapta', etapaMax: 4 }), 4);
});

test('pasul următor: câmpurile noi au întâietate față de reapelarea veche', () => {
  assert.deepEqual(pasClient({ nextCallAt: '2026-11-15T10:00:00Z', nextCallReason: 'Nu a răspuns' }), { ce: 'Sună din nou (nu a răspuns)', la: '2026-11-15T10:00:00Z' });
  assert.deepEqual(pasClient({ nextCallAt: '2026-11-15T10:00:00Z', pasLa: '', pasUrmator: '' }), { ce: '', la: '' });
  assert.deepEqual(pasClient({}), { ce: '', la: '' });
});

test('în lucru: doar de pe 10 noiembrie sau reactivați', () => {
  assert.ok(inLucru({ addedAt: '2026-11-10T08:00:00Z' }));
  assert.ok(!inLucru({ addedAt: '2026-09-01T08:00:00Z' }));
  assert.ok(inLucru({ addedAt: '2026-09-01T08:00:00Z', reactivat: true }));
});

test('clientul care revine e găsit după telefon sau email', () => {
  const vechi = { id: 'v', nume: 'Ion', telefon: '+40 711 111 111', addedAt: '2026-08-31T08:00:00Z' };
  const nou = { id: 'n', nume: 'Ion', telefon: '+40 711 111 111', dinMail: true, addedAt: h(5) };
  assert.equal(fisaVeche(nou, [vechi, nou]).id, 'v');
  assert.equal(fisaVeche({ ...nou, revenitRespins: true }, [vechi, nou]), null);
  assert.equal(fisaVeche({ ...nou, dinMail: false }, [vechi, nou]), null);
  assert.equal(fisaVeche({ ...nou, telefon: '+40 799 999 999' }, [vechi, nou]), null);
});

test('listele de pe „Azi”', () => {
  const clients = [
    { id: 'a', nume: 'Nou recent', addedAt: h(1), dinMail: true, telefon: '+40 700 000 001' },
    { id: 'b', nume: 'Nou vechi', addedAt: h(30), dinMail: true, telefon: '+40 700 000 002' },
    { id: 'c', nume: 'Cu pas azi', addedAt: z(2), etapa: 'contactat', pasUrmator: 'Sună', pasLa: new Date(ACUM.getTime() + 2 * 36e5).toISOString() },
    { id: 'd', nume: 'Întârziat', addedAt: z(3), etapa: 'asteapta', pasUrmator: 'Verifică pozele', pasLa: h(20) },
    { id: 'e', nume: 'Fără pas', addedAt: z(3), etapa: 'oferta', valoare: 9000, etapaLa: z(2) },
    { id: 'f', nume: 'Pas mâine', addedAt: z(3), etapa: 'contactat', pasUrmator: 'Sună', pasLa: new Date(ACUM.getTime() + 30 * 36e5).toISOString() },
    { id: 'g', nume: 'Câștigat', addedAt: z(3), etapa: 'castigat' },
    { id: 'h', nume: 'Arhivă', addedAt: '2026-08-20T08:00:00Z', contactat: false, nextCallAt: '2026-08-25T08:00:00Z' },
    { id: 'i', nume: 'A revenit', addedAt: h(2), dinMail: true, telefon: '+40 711 111 111' },
    { id: 'j', nume: 'Vechiul', addedAt: '2026-08-31T08:00:00Z', telefon: '+40 711 111 111', contactat: true },
    { id: 'k', nume: 'Studiu', addedAt: z(1), etapa: 'studiu', pasUrmator: 'Studiu', pasLa: new Date(ACUM.getTime() + 24 * 36e5).toISOString() }
  ];
  const L = listeAzi(clients, [], ACUM);
  assert.deepEqual(L.nesunati.map(x => x.c.id), ['a', 'b']);
  assert.deepEqual(L.revenit.map(x => [x.c.id, x.vechi.id]), [['i', 'j']]);
  assert.deepEqual(L.pasi.map(x => [x.c.id, x.intarziat]), [['d', true], ['c', false]]);
  assert.deepEqual(L.faraPas.map(x => x.c.id), ['e']);
  assert.equal(L.cifre.nesunati, 3);
  assert.equal(L.cifre.intarziati, 1);
  assert.equal(L.cifre.oferte, 1);
  assert.equal(L.cifre.valoareOferte, 9000);
  assert.equal(L.cifre.studii, 1);
  assert.equal(L.cifre.celMaiVechi, clients[1].addedAt);
});

test('rapoartele', () => {
  const interval = { start: new Date('2026-11-10T00:00:00+02:00'), end: null };
  const clients = [
    { addedAt: '2026-11-11T10:00:00Z', sursa: 'Site (formular)', etapa: 'castigat', valoare: 10000, tipSpatiu: 'Birou', problema: 'Ecou puternic', primulContactLa: '2026-11-11T10:30:00Z' },
    { addedAt: '2026-11-12T10:00:00Z', sursa: 'Site (formular)', etapa: 'pierdut', etapaPierdere: 'oferta', motivPierdere: 'Preț', valoare: 5000, tipSpatiu: 'Birou', problema: 'Ecou puternic', primulContactLa: '2026-11-12T20:00:00Z' },
    { addedAt: '2026-11-13T10:00:00Z', sursa: 'Recomandare', etapa: 'asteapta', tipSpatiu: 'Studio sau home studio', problema: 'Bas necontrolat', primulContactLa: '2026-11-15T10:00:00Z' },
    { addedAt: '2026-11-13T11:00:00Z', etapa: 'nou' },
    { addedAt: '2026-08-13T11:00:00Z', etapa: 'nou' }
  ];
  const d = drumulClientilor(clients, [], interval);
  assert.deepEqual(d.map(x => x.n), [4, 3, 3, 2, 2, 1]);
  const m = ceCerClientii(clients, interval);
  assert.equal(m.matrice['Birou']['Ecou puternic'], 2);
  assert.equal(m.matrice['Nespecificat']['Nespecificat'], 1);
  const v = vitezaRaspuns(clients, interval);
  assert.equal(v.masurati, 3);
  assert.equal(v.mediana, 10);
  assert.equal(v.subOOra, 1);
  assert.equal(v.subOZi, 2);
  assert.equal(v.nesunati, 1);
  const r = rezultate(clients, [], interval);
  assert.deepEqual(r.motive, { 'Preț': 1 });
  assert.equal(r.castigati, 1);
  assert.equal(r.valCastigat, 10000);
  assert.equal(r.cuOferta, 2);
  assert.equal(r.valOferte, 15000);
  assert.equal(r.rataCastig, 0.5);
  const s = leadPeSaptamani(clients, new Date('2026-11-14T12:00:00+02:00'), 2);
  assert.equal(s.saptamani.length, 2);
  assert.deepEqual(s.saptamani[1].surse, { 'Site (formular)': 2, 'Recomandare': 1, 'Fără sursă': 1 });
});
