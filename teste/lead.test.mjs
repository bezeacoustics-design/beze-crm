// Teste pentru lead.js. Rulare: node --test teste/
// Datele sunt inventate (repo-ul e public): niciun client real aici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citesteMail, normalizeazaTelefon, canonic, SUPRAFATA, TIP_SPATIU, PROBLEMA, vechime, mesajEmail, mesajWhatsApp, mesajWhatsAppDupaApel, linkRoundcube, ROUNDCUBE } from '../lead.js';

const MAIL_CONSULTANTA = `Mesaj nou de la client pe 13 noiembrie 2026, 09:14
Expeditor Beze Acoustics (Shopify)
Ați primit un mesaj nou din formularul de contact al magazinului dumneavoastră online.

Cod țară:
RO
Name:
Ion Test
Email:
ion.test@example.com
Phone:
0712 345 678
Ce Tip De Spatiu Vrei Sa Tratezi?*:
Restaurant sau spatiu comercial
Care Sunt Dimensiunile Aproximative Ale Camerei?*:
Peste 40 mp
Ce Problema Observi Cel Mai Mult?*:
Ecou puternic
`;

test('mailul de pe pagina de consultanță', () => {
  const r = citesteMail(MAIL_CONSULTANTA);
  assert.equal(r.nume, 'Ion Test');
  assert.equal(r.email, 'ion.test@example.com');
  assert.equal(r.telefonBrut, '0712 345 678');
  assert.equal(r.tara, 'RO');
  assert.equal(r.tipSpatiu, 'Restaurant sau spațiu comercial');
  assert.equal(r.suprafata, 'Peste 40 mp');
  assert.equal(r.problema, 'Ecou puternic');
  assert.equal(r.formular, 'pagina de consultanță');
});

test('mailul de pe pagina Contact, cu mesaj pe mai multe rânduri', () => {
  const r = citesteMail(`Nume:
Maria Test
Email:
maria@example.com
Telefon:
+40 799 000 111
Subiect:
Consultanta
Mesaj:
Bună ziua,
am o cameră de 3 x 4 m și se aude ecou.
Mulțumesc!`);
  assert.equal(r.nume, 'Maria Test');
  assert.equal(r.subiect, 'Consultanta');
  assert.equal(r.mesaj, 'Bună ziua,\nam o cameră de 3 x 4 m și se aude ecou.\nMulțumesc!');
  assert.equal(r.formular, 'pagina Contact');
});

test('etichete și valori pe același rând', () => {
  const r = citesteMail('Name: Ana Test\nEmail: ana@example.com\nPhone: 0711111111\nCe tip de spatiu vrei sa tratezi?: Studio sau home studio\nCare sunt dimensiunile aproximative ale camerei?: Nu stiu exact\nCe problema observi cel mai mult?: Nu stiu ce tratament imi trebuie');
  assert.equal(r.nume, 'Ana Test');
  assert.equal(r.tipSpatiu, 'Studio sau home studio');
  assert.equal(r.suprafata, 'Nu știu exact');
  assert.equal(r.problema, 'Nu știu ce tratament îmi trebuie');
});

test('un mesaj care conține cuvântul „email” nu strică citirea', () => {
  const r = citesteMail('Nume:\nDan Test\nEmail:\ndan@example.com\nMesaj:\nVă las emailul meu: dan@example.com, sunați-mă.');
  assert.equal(r.email, 'dan@example.com');
  assert.equal(r.mesaj, 'Vă las emailul meu: dan@example.com, sunați-mă.');
});

test('textul fără etichete nu inventează nimic', () => {
  const r = citesteMail('salut, vreau panouri');
  assert.equal(r.nume, '');
  assert.equal(r.email, '');
  assert.equal(r.formular, '');
});

test('variantele din formular se potrivesc cu diacritice și cratime diferite', () => {
  assert.equal(canonic('10-20 mp', SUPRAFATA), '10–20 mp');
  assert.equal(canonic('Camera pentru podcast', TIP_SPATIU), 'Cameră pentru podcast');
  assert.equal(canonic('Mixurile suna diferit in alte locuri', PROBLEMA), 'Mixurile sună diferit în alte locuri');
  assert.equal(canonic('ceva nou', PROBLEMA), 'ceva nou');
  assert.equal(canonic('', PROBLEMA), '');
});

test('telefonul românesc, în toate formele', () => {
  for (const t of ['0712 345 678', '0712345678', '712345678', '+40712345678', '+40 712 345 678', '0040712345678', '40712345678']) {
    const r = normalizeazaTelefon(t, 'RO');
    assert.equal(r.telefon, '+40 712 345 678', t);
    assert.equal(r.cifre, '40712345678', t);
    assert.ok(r.ok, t);
  }
  assert.equal(normalizeazaTelefon('0712 345', 'RO').ok, false);
  assert.equal(normalizeazaTelefon('', 'RO').ok, false);
});

test('telefon din altă țară', () => {
  assert.equal(normalizeazaTelefon('01761234567', 'DE').telefon, '+49 1761234567');
  assert.equal(normalizeazaTelefon('+373 69 123 456', 'RO').telefon, '+373 69123456');
  assert.ok(normalizeazaTelefon('+373 69 123 456', 'RO').ok);
});

test('vechimea lead-ului', () => {
  const acum = new Date('2026-11-13T12:00:00Z');
  assert.equal(vechime('2026-11-13T11:59:30Z', acum), 'acum');
  assert.equal(vechime('2026-11-13T11:15:00Z', acum), 'acum 45 min');
  assert.equal(vechime('2026-11-13T09:00:00Z', acum), 'acum 3 ore');
  assert.equal(vechime('2026-11-12T08:00:00Z', acum), 'ieri');
  assert.equal(vechime('2026-11-08T08:00:00Z', acum), 'acum 5 zile');
  assert.equal(vechime('', acum), '');
});

test('mesajele de răspuns sunt complete, fără paranteze rămase', () => {
  for (const tipSpatiu of [...TIP_SPATIU, '']) {
    for (const problema of [...PROBLEMA, '']) {
      const c = { nume: 'Ion Test', tipSpatiu, suprafata: '21–40 mp', problema };
      const e = mesajEmail(c);
      const w = mesajWhatsApp(c, 'Marius');
      for (const t of [e.subiect, e.corp, w]) {
        assert.ok(!t.includes('['), 'paranteză rămasă: ' + t.slice(0, 80));
        assert.ok(!t.includes('**'), 'stelute rămase');
        assert.ok(!t.includes('undefined'), 'undefined în text');
        assert.ok(!t.includes('—'), 'liniuță lungă în text');
      }
      assert.ok(e.corp.startsWith('Salutare, Ion Test!'));
      assert.ok(w.startsWith('Salut, Ion Test! Sunt Marius de la BEZE Acoustics.'));
    }
  }
});

test('mesajul pentru ecou păstrează fraza din răspunsul standard', () => {
  const e = mesajEmail({ nume: 'Ion Test', tipSpatiu: 'Studio sau home studio', suprafata: '21–40 mp', problema: 'Ecou puternic' });
  assert.ok(e.corp.includes('Am văzut că vrei să tratezi un studio / home studio de 21–40 m² și că problema principală este ecoul.'));
  assert.equal(e.subiect, 'Următorul pas pentru camera ta | BEZE Acoustics');
  const r = mesajEmail({ nume: 'X', tipSpatiu: 'Restaurant sau spațiu comercial', suprafata: 'Peste 40 mp', problema: 'Ecou puternic' });
  assert.equal(r.subiect, 'Următorul pas pentru spațiul tău | BEZE Acoustics');
  assert.ok(r.corp.includes('zona în care stau oamenii și tavanul'));
});

test('mesajul „După apel” cere cotele și pozele, pe „dumneavoastră”, pentru orice spațiu', () => {
  for (const tipSpatiu of [...TIP_SPATIU, '']) {
    const w = mesajWhatsAppDupaApel({ nume: 'Ion Test', tipSpatiu, problema: 'Ecou puternic' }, 'Marius');
    assert.ok(w.startsWith('Bună ziua, Ion Test! Sunt Marius de la BEZE Acoustics. Așa cum am vorbit la telefon'));
    assert.ok(w.includes('lungime, lățime, înălțime'));
    assert.ok(w.includes('din fiecare colț'));
    for (const rau of ['[', '**', 'undefined', '—', ' tu ', 'trimite-ne']) assert.ok(!w.includes(rau), rau + ' în: ' + w.slice(0, 80));
  }
  const r = mesajWhatsAppDupaApel({ nume: 'X', tipSpatiu: 'Restaurant sau spațiu comercial' }, 'Marius');
  assert.ok(r.includes('cotele spațiului') && r.includes('zona în care stau oamenii'));
  const fara = mesajWhatsAppDupaApel({}, '');
  assert.ok(fara.startsWith('Bună ziua! Vă scriem de la BEZE Acoustics.'));
});

test('mailul pentru clientul fără telefon: am vrut să-l sunăm, îi cerem schița și un număr', () => {
  for (const tipSpatiu of [...TIP_SPATIU, '']) {
    for (const problema of [...PROBLEMA, '']) {
      const c = { nume: 'Ion Test', tipSpatiu, suprafata: '10–20 mp', problema };
      const f = mesajEmail(c, { faraTelefon: true });
      assert.ok(f.corp.startsWith('Salutare, Ion Test!\n\nMulțumim pentru mesaj. Am vrut să te sunăm, dar în formular nu ne-ai lăsat un număr de telefon'));
      assert.ok(f.corp.includes('Unde sunt ușa și ferestrele și ce dimensiuni au. Ajunge o schiță de mână pe o foaie'));
      assert.ok(f.corp.includes('- Un număr de telefon, dacă preferi să vorbim.'));
      assert.ok(f.corp.includes('lungime, lățime și înălțime'));
      assert.equal(f.subiect, mesajEmail(c).subiect);
      // Roundcube ia drept HTML un text cu „<” (compose.php), deci niciun mail nu are „<”.
      for (const t of [f.corp, mesajEmail(c).corp]) {
        for (const rau of ['[', '**', 'undefined', '—', '<']) assert.ok(!t.includes(rau), rau + ' în: ' + t.slice(0, 80));
      }
      assert.ok(!mesajEmail(c).corp.includes('nu ne-ai lăsat'), 'mailul obișnuit nu vorbește de telefon');
    }
  }
});

test('linkul de Roundcube deschide un mail nou, cu destinatarul, subiectul și textul', () => {
  const e = mesajEmail({ nume: 'Ion Test', tipSpatiu: 'Sală de repetiții', problema: 'Bas necontrolat' }, { faraTelefon: true });
  const u = new URL(linkRoundcube('ion.test+crm@example.com', e.subiect, e.corp));
  assert.equal(u.origin + u.pathname, ROUNDCUBE);
  assert.equal(u.searchParams.get('_task'), 'mail');
  assert.equal(u.searchParams.get('_action'), 'compose');
  assert.equal(u.searchParams.get('_to'), 'ion.test+crm@example.com');
  assert.equal(u.searchParams.get('_subject'), e.subiect);
  assert.equal(u.searchParams.get('_body'), e.corp);
  // Cel mai lung mail, cu un nume lung: webmail.bezeacoustics.ro a primit pe 23 Nov 2026 linkuri de 12 000 de caractere.
  for (const tipSpatiu of TIP_SPATIU) for (const problema of PROBLEMA) {
    const m = mesajEmail({ nume: 'Alexandru-Constantin Popescu-Ionescu', tipSpatiu, suprafata: 'Peste 40 mp', problema }, { faraTelefon: true });
    assert.ok(linkRoundcube('alexandru.constantin.popescu@example.com', m.subiect, m.corp).length < 8000);
  }
});
