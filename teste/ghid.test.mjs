// Teste pentru ghid.js: formulările interzise din canon, liniuțele lungi, textele complete pentru orice client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { toateTextele, scenariu, alegeTreapta, NICIODATA, PASI, INTREBARI } from '../ghid.js';
import { TIP_SPATIU, SUPRAFATA, PROBLEMA } from '../lead.js';

// Tiparele „interzise” din ~/beze-agent/canon/formulari.yaml (dacă fișierul e pe Mac), plus ce nu e verificat.
function tipareInterzise() {
  const extra = [/zero fibre/i, /—/];
  let yaml = '';
  try { yaml = readFileSync(homedir() + '/beze-agent/canon/formulari.yaml', 'utf8'); } catch { return extra; }
  const bloc = yaml.split(/\nde_verificat:/)[0];
  const t = [...bloc.matchAll(/tipar: '((?:[^']|'')*)'/g)].map(m => new RegExp(m[1].replace(/''/g, "'"), 'i'));
  assert.ok(t.length >= 5, 'am citit tiparele din canon');
  return [...t, ...extra];
}

test('nicio formulare interzisă și nicio liniuță lungă în ghid', () => {
  const tipare = tipareInterzise();
  for (const text of toateTextele()) for (const re of tipare) assert.ok(!re.test(text), 'interzis (' + re + '): ' + text.slice(0, 90));
});

test('„ce nu spui niciodată” chiar conține formulările interzise', () => {
  const stanga = NICIODATA.map(r => r[0]).join(' ');
  assert.match(stanga, /garantat/i);
  assert.match(stanga, /absoarbe tot basul/i);
});

test('scenariul e complet pentru orice combinație din formular', () => {
  for (const tipSpatiu of [...TIP_SPATIU, '']) for (const suprafata of [...SUPRAFATA, '']) for (const problema of [...PROBLEMA, '']) {
    const s = scenariu({ nume: 'Ion Test', tipSpatiu, suprafata, problema }, 'Marius');
    const tot = JSON.stringify(s);
    assert.ok(!/\{\w+\}/.test(tot), 'acoladă rămasă: ' + tipSpatiu + ' / ' + problema);
    assert.ok(!tot.includes('undefined'), 'undefined');
    assert.ok(s.explicatie.length > 20);
    assert.ok(s.treapta.spui && s.treapta.titlu);
    const confirmare = s.pasi.find(p => p.cheie === 'confirmare').spui[0];
    assert.ok(!/\s[.,]/.test(confirmare), 'spațiu înainte de punct: ' + confirmare);
  }
});

test('deschiderea are numele clientului și al celui care sună', () => {
  const s = scenariu({ nume: 'Ion Test', tipSpatiu: 'Studio sau home studio', suprafata: '10–20 mp', problema: 'Bas necontrolat' }, 'Marius');
  assert.equal(s.pasi[1].spui[0], 'Bună ziua, vorbesc cu Ion Test? Sunt Marius de la BEZE Acoustics. Ați completat pe site formularul pentru consultanța acustică. Aveți două minute să vorbim acum?');
  assert.equal(s.pasi[2].spui[0], 'Văd că ați scris că vreți să tratați un studio de 10–20 m² și că vă deranjează basul. Am înțeles bine?');
});

test('treapta propusă', () => {
  assert.equal(alegeTreapta({ problema: 'Izolare (zgomot de la sau către vecini)' }).treapta, 'beia');
  assert.equal(alegeTreapta({ tipSpatiu: 'Home cinema' }).treapta, 'beia');
  assert.equal(alegeTreapta({ tipSpatiu: 'Studio sau home studio', suprafata: '10–20 mp', problema: 'Bas necontrolat' }).treapta, 'studiu');
  assert.equal(alegeTreapta({ tipSpatiu: 'Restaurant sau spațiu comercial', suprafata: 'Peste 40 mp', problema: 'Ecou puternic' }).treapta, 'studiu');
  assert.equal(alegeTreapta({ tipSpatiu: 'Cameră pentru podcast', suprafata: 'Sub 10 mp', problema: 'Ecou puternic' }).treapta, 'poze');
  assert.equal(alegeTreapta({ tipSpatiu: 'Cameră pentru podcast', suprafata: 'Sub 10 mp', problema: 'Ecou puternic' }).rezerva, 'kit');
  assert.equal(alegeTreapta({}).treapta, 'poze');
});

test('întrebările au câmpuri distincte, pașii sunt 7', () => {
  assert.equal(new Set(INTREBARI.map(i => i.camp)).size, INTREBARI.length);
  assert.equal(PASI.length, 7);
});
