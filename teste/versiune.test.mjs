// Versiunea fișierelor: index.html (import map + app.js) și sw.js trebuie să aibă aceeași cifră,
// altfel browserul poate folosi fișiere vechi după o publicare (Safari, 23 Nov 2026). Rulare: node --test teste/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const radacina = new URL('../', import.meta.url);
const citeste = f => fs.readFileSync(new URL(f, radacina), 'utf8');

test('index.html și sw.js au aceeași versiune a fișierelor', () => {
  const html = citeste('index.html'), sw = citeste('sw.js');
  const v = Number((sw.match(/^const V = (\d+);/m) || [])[1]);
  assert.ok(v > 0, 'V lipsește din sw.js');
  assert.ok(html.includes('<script type="module" src="app.js?v=' + v + '"></script>'), 'app.js?v=' + v + ' în index.html');
  const harta = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]).imports;
  // Orice fișier local importat de alt fișier trebuie să fie în harta din index.html, cu aceeași versiune.
  const locale = new Set();
  for (const f of ['app.js', 'lead.js', 'etape.js', 'ghid.js']) {
    for (const m of citeste(f).matchAll(/from\s+["'](\.\/[^"']+)["']/g)) locale.add(m[1]);
  }
  assert.ok(locale.size >= 3);
  for (const f of locale) assert.equal(harta[f], f + '?v=' + v, f + ' în import map');
});
