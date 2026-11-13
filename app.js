import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import * as L from "./lead.js";
import * as E from "./etape.js";
import * as G from "./ghid.js";

const firebaseConfig = {
  apiKey: "AIzaSyDU_QIv1zVKAbhlNDnWeg6ZaDTGvVaHuCs",
  authDomain: "beze-intern.firebaseapp.com",
  projectId: "beze-intern",
  storageBucket: "beze-intern.firebasestorage.app",
  messagingSenderId: "691595185314",
  appId: "1:691595185314:web:afa816d669f9c4f1cd5bfb",
  measurementId: "G-RGGX2KBJ18"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);
const clientsCol = collection(db, 'clients');
const dealsCol = collection(db, 'deals');
const activityCol = collection(db, 'activity');
const eventsCol = collection(db, 'events');
const istoricCol = collection(db, 'istoric');

const ADMIN_EMAIL = 'beiathedj@gmail.com';
function isAdmin(){ return !!(auth.currentUser && auth.currentUser.email === ADMIN_EMAIL); }
// Numele cu care semnează fiecare om din echipă în mesajele de WhatsApp.
const NUME_ECHIPA = { 'beiathedj@gmail.com': 'Marius' };
function numeExpeditor(){ const e = auth.currentUser && auth.currentUser.email; return NUME_ECHIPA[e] || ''; }

(function(){
  const NAV = [
    {key:'azi', label:'Azi', icon:'ti-sun'},
    {key:'clienti', label:'Clienți', icon:'ti-users'},
    {key:'etape', label:'Etape', icon:'ti-layout-kanban'},
    {key:'calendar', label:'Calendar', icon:'ti-calendar'},
    {key:'rapoarte', label:'Rapoarte', icon:'ti-chart-bar'},
    {key:'activitate', label:'Activitate', icon:'ti-history'},
    {key:'ghid', label:'Ghid', icon:'ti-headset'}
  ];
  const SURSE = L.SURSE;

  let currentView = 'azi';
  let clients = [], deals = [], activity = [], events = [], istoric = [];
  let istoricEroare = false;
  let loadedFlags = {clients:false, deals:false, activity:false, events:false, istoric:false};
  let editingClientId = null, editingEventId = null;
  let charts = {};
  const now0 = new Date();
  let calYear = now0.getFullYear(), calMonth = now0.getMonth();
  let calSelectedDate = null;

  function esc(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmtDate(iso){ if(!iso) return ''; const d=new Date(iso); return d.toLocaleDateString('ro-RO',{day:'2-digit',month:'2-digit',year:'numeric'}); }
  function fmtDateTime(iso){ if(!iso) return ''; const d=new Date(iso); return d.toLocaleDateString('ro-RO',{day:'2-digit',month:'2-digit'}) + ' · ' + d.toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'}); }
  function fmtRon(n){ return (Number(n)||0).toLocaleString('ro-RO') + ' RON'; }
  function monthKey(iso){ const d=new Date(iso); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
  function monthLabel(key){ const [y,m]=key.split('-'); const names=['ian','feb','mar','apr','mai','iun','iul','aug','sep','oct','noi','dec']; return names[parseInt(m,10)-1]+' '+y.slice(2); }
  function isThisMonth(iso){ if(!iso) return false; const d=new Date(iso), n=new Date(); return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth(); }
  function isOnDay(iso, offsetDays){
    if(!iso) return false;
    const d = new Date(iso);
    const n = new Date();
    n.setDate(n.getDate() + (offsetDays||0));
    return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
  }

  function digitsOnly(s){ return String(s||'').replace(/\D/g,''); }
  function formatRoPhoneDigits(digits){
    const d = String(digits||'').slice(0,9);
    const parts = [];
    if(d.length>0) parts.push(d.slice(0,3));
    if(d.length>3) parts.push(d.slice(3,6));
    if(d.length>6) parts.push(d.slice(6,9));
    return parts.join(' ');
  }
  function extractPhoneDigitsForEdit(telefon){
    let d = digitsOnly(telefon);
    if(d.startsWith('40') && d.length>9) d = d.slice(2);
    return d.slice(0,9);
  }
  function toDatetimeLocal(iso){
    if(!iso) return '';
    const d = new Date(iso);
    if(isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2,'0');
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
  }

  function toast(text){
    let el = document.getElementById('toast');
    if(!el){
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#15171a;color:#fff;font-size:13px;padding:10px 16px;border-radius:9px;z-index:200;box-shadow:0 6px 20px rgba(0,0,0,0.25);max-width:90vw;';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = 'none'; }, 3500);
  }

  async function copiaza(text, mesaj){
    try{ await navigator.clipboard.writeText(text); toast(mesaj || 'Copiat.'); }
    catch(e){ console.error(e); toast('Nu am putut copia textul. Încearcă din nou.'); }
  }

  async function logActivity(text){
    try{ await addDoc(activityCol, { ts: new Date().toISOString(), text }); }catch(e){ console.error(e); }
  }

  function setConnStatus(text, ok){
    const el = document.getElementById('connStatus');
    el.textContent = text;
    el.style.color = ok ? 'var(--accent-dark)' : 'var(--red)';
    el.style.borderColor = ok ? 'var(--accent)' : 'var(--red)';
    el.style.opacity = '1';
    clearTimeout(el._t);
    // Când totul merge, eticheta dispare după câteva secunde, ca să nu acopere butoanele; la eroare rămâne.
    if(ok) el._t = setTimeout(() => { el.style.transition = 'opacity 0.6s'; el.style.opacity = '0'; }, 4000);
  }

  let listenersStarted = false;
  function startListeners(){
    if(listenersStarted) return;
    listenersStarted = true;
    const toate = () => Object.values(loadedFlags).every(Boolean);
    function gata_(cheie){
      loadedFlags[cheie] = true;
      if(toate()){
        setConnStatus('conectat · date live', true); renderPage();
        if(document.getElementById('listaNesunati') && document.getElementById('modalWrap').style.display === 'flex') openNesunatiModal();
      }
    }
    onSnapshot(clientsCol, snap => {
      clients = snap.docs.map(d => Object.assign({id:d.id}, d.data()));
      gata_('clients');
    }, err => { console.error(err); setConnStatus('eroare conexiune', false); });
    onSnapshot(dealsCol, snap => { deals = snap.docs.map(d => Object.assign({id:d.id}, d.data())); gata_('deals'); },
      err => { console.error(err); gata_('deals'); });
    onSnapshot(activityCol, snap => { activity = snap.docs.map(d => Object.assign({id:d.id}, d.data())); gata_('activity'); },
      err => { console.error(err); gata_('activity'); });
    onSnapshot(eventsCol, snap => { events = snap.docs.map(d => Object.assign({id:d.id}, d.data())); gata_('events'); },
      err => { console.error(err); gata_('events'); });
    onSnapshot(istoricCol, snap => {
      istoric = snap.docs.map(d => Object.assign({id:d.id}, d.data()));
      istoricEroare = false;
      gata_('istoric');
      renderIstoricBox();
    }, err => { console.error(err); istoricEroare = true; istoric = []; gata_('istoric'); });
  }

  renderNav();

  /* ---------- AUTH ---------- */
  function showLogin(){
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appShell').style.display = 'none';
    document.getElementById('connStatus').style.display = 'none';
  }
  function showApp(user){
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appShell').style.display = 'flex';
    document.getElementById('connStatus').style.display = 'block';
    const label = document.getElementById('userEmailLabel');
    if(label) label.textContent = user.email || 'Beze Acoustics';
    startListeners();
  }

  onAuthStateChanged(auth, (user) => {
    if(user) showApp(user); else showLogin();
  });

  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('loginPassword').addEventListener('keydown', (e) => { if(e.key==='Enter') doLogin(); });
  document.getElementById('loginEmail').addEventListener('keydown', (e) => { if(e.key==='Enter') doLogin(); });

  function doLogin(){
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    errEl.style.display = 'none';
    if(!email || !pass){ errEl.textContent = 'completează email și parolă'; errEl.style.display = 'block'; return; }
    signInWithEmailAndPassword(auth, email, pass).catch(err => {
      errEl.textContent = 'email sau parolă incorecte';
      errEl.style.display = 'block';
    });
  }

  document.getElementById('forgotBtn').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const errEl = document.getElementById('loginError');
    const infoEl = document.getElementById('loginInfo');
    errEl.style.display = 'none'; infoEl.style.display = 'none';
    if(!email){ errEl.textContent = 'scrie mai întâi emailul contului, apoi apasă din nou „am uitat parola”'; errEl.style.display = 'block'; return; }
    try{
      auth.languageCode = 'ro';
      await sendPasswordResetEmail(auth, email);
      infoEl.textContent = 'Dacă există un cont cu acest email, ți-am trimis un link pentru parolă nouă la ' + email + '. Uită-te și în Spam. Linkul expiră în scurt timp.';
      infoEl.style.display = 'block';
    }catch(err){
      console.error(err);
      errEl.textContent = err && err.code === 'auth/invalid-email' ? 'emailul nu e scris corect' : 'nu am putut trimite mailul; încearcă din nou peste un minut';
      errEl.style.display = 'block';
    }
  });

  document.getElementById('userMenu').addEventListener('click', () => {
    if(confirm('Te deconectezi din BEZE CRM?')) signOut(auth);
  });

  function renderNav(){
    const nav = document.getElementById('nav');
    nav.innerHTML = '';
    NAV.forEach(n => {
      const el = document.createElement('div');
      el.className = 'navitem' + (currentView===n.key?' active':'');
      el.innerHTML = '<i class="ti '+n.icon+'" style="font-size:15px;" aria-hidden="true"></i><span>'+n.label+'</span>';
      el.addEventListener('click', () => { currentView=n.key; renderNav(); renderPage(); });
      nav.appendChild(el);
    });
  }

  function destroyCharts(){ Object.values(charts).forEach(c=>{try{c.destroy();}catch(e){}}); charts={}; }

  function renderPage(){
    destroyCharts();
    const page = document.getElementById('page');
    if(currentView==='azi'){ page.innerHTML = aziHtml(); wireAzi(); }
    else if(currentView==='clienti'){ page.innerHTML = clientsHtml(); wireClients(); }
    else if(currentView==='etape'){ page.innerHTML = etapeHtml(); wireEtape(); }
    else if(currentView==='calendar'){ page.innerHTML = calendarHtml(); wireCalendar(); }
    else if(currentView==='rapoarte'){ page.innerHTML = rapoarteHtml(); wireRapoarte(); }
    else if(currentView==='activitate'){ page.innerHTML = activityHtml(); }
    else { page.innerHTML = ghidHtml(); wireGhid(); }
  }

  /* ---------- AJUTOARE PENTRU ETAPE ȘI ISTORIC ---------- */
  function etapaPill(key, mic){
    const e = E.etapa(key);
    return '<span class="pill" style="background:'+e.fundal+';color:'+e.culoare+';'+(mic?'font-size:11px;padding:2px 8px;':'')+'">'+esc(e.label)+'</span>';
  }
  function culoareVechime(iso){
    const ore = (Date.now() - new Date(iso).getTime()) / 36e5;
    if(isNaN(ore)) return 'var(--text3)';
    if(ore < 1) return '#1f8f4e';
    if(ore < 24) return 'var(--warm-text)';
    return 'var(--red)';
  }
  const ZILE = ['duminică','luni','marți','miercuri','joi','vineri','sâmbătă'];
  function cand(iso){
    if(!iso) return '';
    const d = new Date(iso);
    if(isNaN(d.getTime())) return '';
    const ora = d.toLocaleTimeString('ro-RO', {hour:'2-digit', minute:'2-digit'});
    const azi = new Date(); azi.setHours(0,0,0,0);
    const zi = new Date(d); zi.setHours(0,0,0,0);
    const dif = Math.round((zi - azi) / 864e5);
    if(dif === 0) return 'azi ' + ora;
    if(dif === 1) return 'mâine ' + ora;
    if(dif === -1) return 'ieri ' + ora;
    if(dif > 1 && dif < 7) return ZILE[d.getDay()] + ' ' + ora;
    return d.toLocaleDateString('ro-RO', {day:'2-digit', month:'2-digit'}) + ' ' + ora;
  }
  function istoricClient(id){
    return istoric.filter(x => x.clientId === id).sort((a,b) => String(b.cand||'').localeCompare(String(a.cand||'')));
  }
  function ultimaNota(c){
    const h = istoricClient(c.id).find(x => x.text);
    return h ? h.text : (c.rezultat || '');
  }
  function zileDeLa(iso){
    const d = new Date(iso);
    if(isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 864e5);
  }
  function spatiuScurt(c){ return [c.tipSpatiu, c.suprafata].filter(Boolean).join(' · '); }

  function butoaneContact(c){
    const cifre = L.cifreTelefon(c.telefon);
    if(!cifre) return '';
    return '<a class="btn" href="tel:+'+cifre+'" data-stop="1" style="text-decoration:none;padding:6px 10px;font-size:12px;display:inline-flex;align-items:center;gap:4px;"><i class="ti ti-phone" aria-hidden="true"></i>Sună</a>' +
      '<a class="btn" href="'+esc(linkWhatsApp(c))+'" target="_blank" rel="noopener" data-stop="1" style="text-decoration:none;padding:6px 10px;font-size:12px;display:inline-flex;align-items:center;gap:4px;"><i class="ti ti-brand-whatsapp" aria-hidden="true"></i>WhatsApp</a>';
  }
  function legaRanduri(container){
    container.querySelectorAll('[data-stop]').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
    container.querySelectorAll('[data-fisa]').forEach(el => el.addEventListener('click', () => openClientModal(el.dataset.fisa)));
    container.querySelectorAll('[data-gata]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openGataModal(b.dataset.gata, b.dataset.etapa || null); }));
    container.querySelectorAll('[data-apel]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openApelModal(b.dataset.apel); }));
    container.querySelectorAll('[data-uneste]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); uneste(b.dataset.uneste, b.dataset.vechi); }));
    container.querySelectorAll('[data-separat]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); nuEAcelasi(b.dataset.separat); }));
  }

  /* ---------- AZI ---------- */
  function tileAzi(numar, titlu, sub, culoare, tinta){
    const apasat = tinta ? ' data-tile="'+tinta+'" role="button" tabindex="0" title="Vezi lista"' : '';
    return '<div class="card'+(tinta?' tile-apasat':'')+'"'+apasat+' style="padding:16px 18px;flex:1;min-width:150px;'+(tinta?'cursor:pointer;position:relative;':'')+'">' +
      (tinta ? '<i class="ti ti-chevron-right" aria-hidden="true" style="position:absolute;top:14px;right:14px;font-size:16px;color:var(--text3);"></i>' : '') +
      '<div style="font-size:26px;font-weight:600;color:'+(culoare||'var(--text)')+';">'+numar+'</div>' +
      '<div style="font-size:13px;font-weight:500;margin-top:2px;">'+titlu+'</div>' +
      '<div style="font-size:12px;color:var(--text3);margin-top:2px;min-height:15px;">'+(sub||'')+'</div></div>';
  }
  function sectiuneAzi(titlu, icon, continut, gol){
    return '<div class="card" style="padding:18px 20px;margin-bottom:16px;">' +
      '<div class="cardhead" style="margin-bottom:10px;"><i class="ti '+icon+'" aria-hidden="true"></i>'+titlu+'</div>' +
      (continut || '<div style="font-size:13px;color:var(--text3);padding:6px 0;">'+gol+'</div>') + '</div>';
  }
  function randAzi(c, stanga, dreapta, butoane){
    return '<div data-fisa="'+c.id+'" style="display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line);cursor:pointer;flex-wrap:wrap;">' +
      '<div style="flex:1;min-width:200px;">'+stanga+'</div>' +
      (dreapta ? '<div style="font-size:12.5px;white-space:nowrap;">'+dreapta+'</div>' : '') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">'+butoane+'</div></div>';
  }
  function randNesunat(c){
    return randAzi(c,
      '<div style="font-weight:500;">'+esc(c.nume)+'</div><div style="font-size:12px;color:var(--text2);">'+esc([spatiuScurt(c), c.problema].filter(Boolean).join(' · ') || c.email || '')+'</div>',
      '<span style="color:'+culoareVechime(c.addedAt)+';font-weight:500;">'+esc(L.vechime(c.addedAt))+'</span>',
      '<button class="btn" data-apel="'+c.id+'" style="padding:6px 10px;font-size:12px;"><i class="ti ti-headset" aria-hidden="true"></i> Ghid</button>' + butoaneContact(c) + '<button class="btn-primary" data-gata="'+c.id+'" style="padding:6px 12px;font-size:12px;">Gata</button>');
  }
  function randRevenit(c, vechi){
    return randAzi(c,
      '<div style="font-weight:500;">'+esc(c.nume)+' <span style="font-size:12px;color:var(--text3);font-weight:400;">a completat din nou formularul, '+esc(L.vechime(c.addedAt))+'</span></div>' +
      '<div style="font-size:12px;color:var(--text2);">acum: '+esc([spatiuScurt(c), c.problema].filter(Boolean).join(' · ') || '-')+'</div>' +
      '<div style="font-size:12px;color:var(--text3);">fișa veche: '+esc(vechi.nume)+', adăugat pe '+esc(fmtDate(vechi.addedAt))+' · '+esc(E.etapa(E.etapaClient(vechi, deals)).label)+(ultimaNota(vechi)?' · „'+esc(ultimaNota(vechi).slice(0,60))+'”':'')+'</div>',
      '',
      '<button class="btn-primary" data-uneste="'+c.id+'" data-vechi="'+vechi.id+'" style="padding:6px 12px;font-size:12px;">Pune în fișa veche</button>' +
      '<button class="btn" data-separat="'+c.id+'" style="padding:6px 10px;font-size:12px;">Nu e același om</button>');
  }
  function aziHtml(){
    const A = E.listeAzi(clients, deals, new Date());
    const k = A.cifre;
    const azi = new Date().toLocaleDateString('ro-RO', {weekday:'long', day:'numeric', month:'long'});
    const nesunati = A.nesunati.map(({c}) => randNesunat(c)).join('');
    const revenit = A.revenit.map(({c, vechi}) => randRevenit(c, vechi)).join('');
    const pasi = A.pasi.map(({c, e, p, intarziat}) => randAzi(c,
      '<div style="font-weight:500;">'+esc(c.nume)+' '+etapaPill(e, true)+'</div><div style="font-size:12px;color:var(--text2);">'+esc(p.ce || 'pas fără descriere')+'</div>',
      '<span style="color:'+(intarziat?'var(--red)':'var(--text2)')+';font-weight:'+(intarziat?'600':'400')+';">'+(intarziat?'întârziat · ':'')+esc(cand(p.la))+'</span>',
      butoaneContact(c) + '<button class="btn-primary" data-gata="'+c.id+'" style="padding:6px 12px;font-size:12px;">Gata</button>')).join('');
    const faraPas = A.faraPas.map(({c, e}) => {
      const z = zileDeLa(c.etapaLa || c.addedAt);
      return randAzi(c,
        '<div style="font-weight:500;">'+esc(c.nume)+' '+etapaPill(e, true)+'</div><div style="font-size:12px;color:var(--text3);">'+(z!==null ? (z===0?'de azi':'de '+z+(z===1?' zi':' zile'))+' în această etapă, fără niciun pas programat' : 'fără niciun pas programat')+'</div>',
        '', '<button class="btn" data-gata="'+c.id+'" style="padding:6px 12px;font-size:12px;">Alege pasul</button>');
    }).join('');
    return (
      (istoricEroare ? '<div style="background:var(--red-bg);color:var(--red);padding:10px 14px;border-radius:9px;font-size:13px;margin-bottom:14px;">Istoricul nu se poate citi: regulile din Firebase nu sunt încă actualizate pentru istoric.</div>' : '') +
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px;flex-wrap:wrap;gap:12px;">' +
        '<div><div class="pagetitle">Azi</div><div class="pagesub">'+esc(azi)+'</div></div>' +
        '<div style="display:flex;gap:8px;"><button id="aziPaste" class="btn"><i class="ti ti-mail" aria-hidden="true"></i> client din mail</button><button id="aziAdd" class="btn-primary">+ client nou</button></div>' +
      '</div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">' +
        tileAzi(k.nesunati, k.nesunati===1?'client nesunat':'clienți nesunați', k.celMaiVechi ? 'cel mai vechi: '+esc(L.vechime(k.celMaiVechi)) : '', k.nesunati ? culoareVechime(k.celMaiVechi || new Date().toISOString()) : '', 'nesunati') +
        tileAzi(k.pasi, k.pasi===1?'pas azi':'pași azi', k.intarziati ? k.intarziati+' întârziat'+(k.intarziati===1?'':'i') : '', k.intarziati ? 'var(--red)' : '') +
        tileAzi(k.oferte, k.oferte===1?'ofertă în așteptare':'oferte în așteptare', k.valoareOferte ? esc(fmtRon(k.valoareOferte)) : '') +
        tileAzi(k.studii, k.studii===1?'studiu săptămâna asta':'studii săptămâna asta', '') +
      '</div>' +
      sectiuneAzi('De sunat acum', 'ti-phone-call', nesunati, 'Niciun client nou nesunat.') +
      (A.revenit.length ? sectiuneAzi('Au revenit', 'ti-arrow-back-up', revenit, '') : '') +
      sectiuneAzi('Pașii de azi', 'ti-clock', pasi, 'Nimic programat pentru azi.') +
      sectiuneAzi('Rămași fără pas următor', 'ti-alert-triangle', faraPas, 'Toți clienții în lucru au un pas programat.') +
      '<div style="font-size:12px;color:var(--text3);margin-top:4px;">Aici apar doar clienții veniți din 10 noiembrie încoace. Cei de dinainte sunt în „Clienți”, la arhivă.</div>'
    );
  }
  function wireAzi(){
    document.getElementById('aziAdd').addEventListener('click', () => openClientModal(null));
    document.getElementById('aziPaste').addEventListener('click', openPasteModal);
    const tile = document.querySelector('[data-tile="nesunati"]');
    if(tile){
      tile.addEventListener('click', openNesunatiModal);
      tile.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openNesunatiModal(); } });
    }
    legaRanduri(document.getElementById('page'));
  }

  // Lista din spatele cardului „clienți nesunați”: aceiași clienți pe care îi numără cardul (noii nesunați și cei care au revenit).
  function openNesunatiModal(){
    const A = E.listeAzi(clients, deals, new Date());
    const n = A.nesunati.length + A.revenit.length;
    const m = document.getElementById('modal');
    m.innerHTML = modalHeader(n === 1 ? '1 client nesunat' : n + ' clienți nesunați') +
      '<div id="listaNesunati">' +
      (n ? '' : '<div style="font-size:13px;color:var(--text3);padding:6px 0;">Niciun client nou nesunat.</div>') +
      (A.nesunati.length ? sectionTitle('Noi, de sunat') + A.nesunati.map(({c}) => randNesunat(c)).join('') : '') +
      (A.revenit.length ? sectionTitle('Au completat din nou formularul') + A.revenit.map(({c, vechi}) => randRevenit(c, vechi)).join('') : '') +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:16px;"><button id="cancelBtn" class="btn">închide</button></div>';
    document.getElementById('modalWrap').style.display = 'flex';
    m.scrollTop = 0;
    legaRanduri(m);
    document.getElementById('closeModal').onclick = closeModal;
    document.getElementById('cancelBtn').onclick = closeModal;
  }

  /* ---------- CLIENTUL CARE REVINE ---------- */
  async function uneste(nouId, vechiId){
    const n = clients.find(x => x.id === nouId), v = clients.find(x => x.id === vechiId);
    if(!n || !v) return;
    if(!isAdmin()){ toast('Doar Beia poate uni fișele.'); return; }
    const acum = new Date().toISOString();
    const eVechi = E.etapaClient(v, deals);
    const etapaNoua = ['asteapta','studiu','oferta'].includes(eVechi) ? eVechi : 'nou';
    const text = 'A completat din nou formularul: ' + [n.tipSpatiu, n.suprafata, n.problema].filter(Boolean).join(' · ') + (n.mesaj ? '\n' + n.mesaj : '');
    try{
      await addDoc(istoricCol, { clientId: v.id, tip: 'formular', text, cand: n.addedAt || acum, cine: auth.currentUser.email, etapaDin: eVechi, etapaIn: etapaNoua });
      const upd = { reactivat: true, etapa: etapaNoua, updatedAt: acum, pasUrmator: '', pasLa: '', nextCallAt: '', nextCallReason: '', notInterested: false };
      if(etapaNoua !== eVechi) upd.etapaLa = acum;
      ['tipSpatiu','suprafata','problema'].forEach(f => { if(n[f]) upd[f] = n[f]; });
      if(!v.email && n.email) upd.email = n.email;
      if(!v.telefon && n.telefon) upd.telefon = n.telefon;
      if(!v.sursa && n.sursa) upd.sursa = n.sursa;
      await updateDoc(doc(db,'clients',v.id), upd);
      await deleteDoc(doc(db,'clients',n.id));
      logActivity('A revenit: ' + v.nume + ' (formularul nou, pus în fișa veche)');
      toast('Formularul nou e în istoricul lui ' + v.nume + '.');
    }catch(err){ console.error(err); toast('Nu s-a putut uni: ' + (err.code || 'eroare')); }
  }
  async function nuEAcelasi(nouId){
    try{
      await updateDoc(doc(db,'clients',nouId), { revenitRespins: true, updatedAt: new Date().toISOString() });
    }catch(err){ console.error(err); toast('Nu s-a salvat.'); }
  }

  /* ---------- „GATA”: CE S-A ÎNTÂMPLAT, ETAPA, PASUL URMĂTOR ---------- */
  const PASI_SUGERATI = ['Sună din nou', 'Verifică dacă a trimis pozele și cotele', 'Studiu la fața locului', 'Trimite oferta', 'Sună pentru răspuns la ofertă', 'Trimite recomandarea pe poze'];
  const PAS_IMPLICIT = {
    nou: ['Sună din nou', 2/24], contactat: ['Sună din nou', 1], asteapta: ['Verifică dacă a trimis pozele și cotele', 2],
    studiu: ['Studiu la fața locului', 2], oferta: ['Sună pentru răspuns la ofertă', 3]
  };
  function laPeste(zile, faraWeekend){
    const d = new Date();
    if(zile < 1){ d.setTime(d.getTime() + zile * 864e5); d.setSeconds(0,0); return d; }
    d.setDate(d.getDate() + Math.round(zile)); d.setHours(10,0,0,0);
    // Pașii propuși singuri nu cad sâmbăta sau duminica; butoanele („mâine”, „peste 3 zile”) fac exact ce spun.
    if(faraWeekend){ while(d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); }
    return d;
  }
  let gata = null;

  function openGataModal(id, etapaAleasa, textInitial){
    const c = clients.find(x => x.id === id);
    if(!c) return;
    const eAcum = E.etapaClient(c, deals);
    gata = { id, eAcum, tip: 'apel', etapa: etapaAleasa || eAcum, atins: !!etapaAleasa };
    const p = E.pasClient(c);
    const m = document.getElementById('modal');
    const chip = (grup, key, label, activ) => '<button type="button" data-grup="'+grup+'" data-key="'+key+'" class="btn" style="padding:6px 11px;font-size:12px;'+(activ?'background:var(--accent);color:#fff;border-color:var(--accent);':'')+'">'+label+'</button>';
    m.innerHTML =
      modalHeader('Gata cu ' + esc(c.nume)) +
      '<div style="font-size:12px;color:var(--text3);margin-bottom:12px;">acum: '+etapaPill(eAcum, true)+(p.la?' · pas: '+esc(p.ce||'')+' · '+esc(cand(p.la)):'')+'</div>' +
      sectionTitle('Ce s-a întâmplat') +
      '<div id="gTip" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' + E.TIPURI_ISTORIC.map(t => chip('tip', t.key, t.label, t.key==='apel')).join('') + '</div>' +
      '<textarea id="gText" rows="'+(textInitial?4:2)+'" placeholder="pe scurt, de exemplu: a zis că trimite poze diseară" style="width:100%;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:9px 11px;border-radius:8px;font-size:13px;outline:none;resize:vertical;font-family:inherit;">'+esc(textInitial||'')+'</textarea>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px;">' + ['Nu a răspuns','Trimite poze și cote','Vrea studiul la fața locului','Vrea ofertă','Nu mai e interesat'].map(t => '<button type="button" class="btn" data-text="'+esc(t)+'" style="padding:4px 9px;font-size:11.5px;">'+t+'</button>').join('') + '</div>' +
      sectionTitle('Etapa') +
      '<div id="gEtapa" style="display:flex;gap:6px;flex-wrap:wrap;">' + E.ETAPE.map(e => chip('etapa', e.key, e.label, e.key===gata.etapa)).join('') + '</div>' +
      '<div id="gMotivBox" style="display:none;margin-top:10px;">' + selectRow('Motivul pierderii','gMotiv', E.MOTIVE, c.motivPierdere||'') + '</div>' +
      '<div id="gValoareBox" style="display:none;margin-top:10px;">' + inputRow('Valoarea ofertei (lei)','gValoare', E.valoareClient(c, deals) || '', 'de exemplu 18000') + '</div>' +
      '<div id="gPasBox">' + sectionTitle('Pasul următor') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<div style="flex:2;min-width:200px;"><input id="gPasCe" list="gPasi" placeholder="ce urmează" style="width:100%;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:9px 11px;border-radius:8px;font-size:13px;outline:none;"><datalist id="gPasi">'+PASI_SUGERATI.map(x=>'<option value="'+esc(x)+'">').join('')+'</datalist></div>' +
          '<div style="flex:1;min-width:170px;"><input id="gPasLa" type="datetime-local" style="width:100%;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:9px 11px;border-radius:8px;font-size:13px;outline:none;"></div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">' +
          [['peste 2 ore', 2/24], ['mâine 10:00', 1], ['peste 3 zile', 3], ['peste o săptămână', 7]].map(([t, z]) => '<button type="button" class="btn" data-peste="'+z+'" style="padding:4px 9px;font-size:11.5px;">'+t+'</button>').join('') +
          '<button type="button" class="btn" id="gFaraPas" style="padding:4px 9px;font-size:11.5px;">fără pas</button>' +
        '</div>' +
      '</div>' +
      '<div id="formError" style="display:none;color:#a3372f;font-size:12px;margin-top:10px;"></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;"><button id="cancelBtn" class="btn">anulează</button><button id="gSave" class="btn-primary">salvează</button></div>';
    document.getElementById('modalWrap').style.display = 'flex';
    m.scrollTop = 0;
    document.getElementById('closeModal').onclick = closeModal;
    document.getElementById('cancelBtn').onclick = closeModal;
    const pasCe = document.getElementById('gPasCe'), pasLa = document.getElementById('gPasLa');
    function puneImplicit(){
      const d = PAS_IMPLICIT[gata.etapa];
      if(!d) return;
      pasCe.value = d[0];
      pasLa.value = toDatetimeLocal(laPeste(d[1], true).toISOString());
    }
    function arataEtapa(){
      const finala = gata.etapa === 'castigat' || gata.etapa === 'pierdut';
      document.getElementById('gMotivBox').style.display = gata.etapa === 'pierdut' ? 'block' : 'none';
      document.getElementById('gValoareBox').style.display = (gata.etapa === 'oferta' || gata.etapa === 'castigat') ? 'block' : 'none';
      document.getElementById('gPasBox').style.display = finala ? 'none' : 'block';
      m.querySelectorAll('[data-grup="etapa"]').forEach(b => {
        const on = b.dataset.key === gata.etapa;
        b.style.background = on ? 'var(--accent)' : '#fff'; b.style.color = on ? '#fff' : 'var(--text2)'; b.style.borderColor = on ? 'var(--accent)' : 'var(--line-strong)';
      });
    }
    // Pasul de acum rămâne dacă nu se schimbă etapa; altfel se propune unul potrivit etapei noi.
    if(gata.atins || !p.la){ puneImplicit(); } else { pasCe.value = p.ce || ''; pasLa.value = toDatetimeLocal(p.la); }
    arataEtapa();
    m.querySelectorAll('[data-grup="tip"]').forEach(b => b.addEventListener('click', () => {
      gata.tip = b.dataset.key;
      m.querySelectorAll('[data-grup="tip"]').forEach(x => { const on = x === b; x.style.background = on ? 'var(--accent)' : '#fff'; x.style.color = on ? '#fff' : 'var(--text2)'; x.style.borderColor = on ? 'var(--accent)' : 'var(--line-strong)'; });
    }));
    m.querySelectorAll('[data-grup="etapa"]').forEach(b => b.addEventListener('click', () => { gata.etapa = b.dataset.key; puneImplicit(); arataEtapa(); }));
    m.querySelectorAll('[data-text]').forEach(b => b.addEventListener('click', () => {
      const t = document.getElementById('gText');
      t.value = t.value ? t.value.replace(/\s*$/, '') + '. ' + b.dataset.text : b.dataset.text;
      if(b.dataset.text === 'Nu mai e interesat'){ gata.etapa = 'pierdut'; arataEtapa(); }
      if(b.dataset.text === 'Trimite poze și cote' && gata.etapa === E.etapaClient(c, deals) && ['nou','contactat'].includes(gata.etapa)){ gata.etapa = 'asteapta'; puneImplicit(); arataEtapa(); }
    }));
    m.querySelectorAll('[data-peste]').forEach(b => b.addEventListener('click', () => { pasLa.value = toDatetimeLocal(laPeste(parseFloat(b.dataset.peste)).toISOString()); if(!pasCe.value) puneImplicit(); }));
    document.getElementById('gFaraPas').addEventListener('click', () => { pasCe.value = ''; pasLa.value = ''; });
    document.getElementById('gSave').onclick = salveazaGata;
  }

  async function salveazaGata(){
    const c = clients.find(x => x.id === gata.id);
    if(!c) return;
    const acum = new Date().toISOString();
    const text = val('gText');
    const finala = gata.etapa === 'castigat' || gata.etapa === 'pierdut';
    const pasCe = finala ? '' : val('gPasCe');
    const pasLaLocal = finala ? '' : document.getElementById('gPasLa').value;
    if(!finala && pasCe && !pasLaLocal){ formError('alege și când (data și ora), sau apasă „fără pas”'); return; }
    if(!finala && !pasLaLocal && !confirm('Nu ai programat un pas următor. Clientul va apărea la „Rămași fără pas următor”. Salvez așa?')) return;
    if(gata.etapa === 'pierdut' && !val('gMotiv')){ formError('alege motivul pierderii'); return; }
    const schimbata = gata.etapa !== gata.eAcum;
    const upd = {
      etapa: gata.etapa,
      pasUrmator: pasLaLocal ? (pasCe || 'Pas') : '',
      pasLa: pasLaLocal ? new Date(pasLaLocal).toISOString() : '',
      nextCallAt: '', nextCallReason: '',
      contactat: gata.etapa !== 'nou' || !!c.contactat || gata.tip !== 'nota',
      notInterested: gata.etapa === 'pierdut',
      updatedAt: acum
    };
    if(schimbata){ upd.etapaLa = acum; }
    if(gata.etapa !== 'pierdut') upd.etapaMax = Math.max(E.etapaMaxima(c, deals), E.indexEtapa(gata.etapa));
    if(gata.etapa === 'pierdut'){ upd.motivPierdere = val('gMotiv'); if(schimbata) upd.etapaPierdere = gata.eAcum; }
    if(gata.etapa === 'oferta' || gata.etapa === 'castigat'){ const v = parseFloat(val('gValoare')); if(!isNaN(v)) upd.valoare = v; }
    if(!c.primulContactLa && gata.tip !== 'nota') upd.primulContactLa = acum;
    if(!E.inLucru(c)) upd.reactivat = true;
    const btn = document.getElementById('gSave');
    btn.disabled = true;
    try{
      if(text || schimbata || gata.tip !== 'nota'){
        await addDoc(istoricCol, { clientId: c.id, tip: gata.tip, text, cand: acum, cine: auth.currentUser.email, etapaDin: gata.eAcum, etapaIn: gata.etapa });
      }
      await updateDoc(doc(db,'clients',c.id), upd);
      logActivity(c.nume + ': ' + E.etapa(gata.etapa).label + (upd.pasLa ? ', următorul pas ' + cand(upd.pasLa) : ''));
      closeModal();
    }catch(err){
      console.error(err);
      btn.disabled = false;
      formError('Nu s-a salvat: ' + (err && err.code === 'permission-denied' ? 'regulile din Firebase nu permit încă istoricul.' : 'verifică internetul și încearcă din nou.'));
    }
  }

  /* ---------- ETAPE (TABLA) ---------- */
  function etapeHtml(){
    const lucru = clients.filter(c => E.inLucru(c) && !E.fisaVeche(c, clients));
    const pe = k => lucru.filter(c => E.etapaClient(c, deals) === k);
    const coloana = k => {
      const lista = pe(k).sort((a,b) => String(E.pasClient(a).la || 'z').localeCompare(String(E.pasClient(b).la || 'z')));
      const suma = lista.reduce((s,c) => s + E.valoareClient(c, deals), 0);
      return '<div class="coloana" data-etapa="'+k+'" style="background:#efeee8;border-radius:12px;padding:10px;min-height:120px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'+etapaPill(k)+'<span style="font-size:12px;color:var(--text3);">'+lista.length+(suma?' · '+esc(fmtRon(suma)):'')+'</span></div>' +
        lista.map(c => {
          const p = E.pasClient(c), intarziat = p.la && new Date(p.la) < new Date(), v = E.valoareClient(c, deals);
          return '<div class="card" draggable="true" data-card="'+c.id+'" data-fisa="'+c.id+'" style="padding:11px 12px;margin-bottom:8px;cursor:grab;border-radius:10px;">' +
            '<div style="font-size:13px;font-weight:500;">'+esc(c.nume)+'</div>' +
            (spatiuScurt(c) ? '<div style="font-size:11.5px;color:var(--text2);margin-top:2px;">'+esc(spatiuScurt(c))+'</div>' : '') +
            (c.problema ? '<div style="font-size:11.5px;color:var(--text3);">'+esc(c.problema)+'</div>' : '') +
            (v ? '<div class="mono" style="font-size:12px;color:var(--accent-dark);margin-top:4px;">'+esc(fmtRon(v))+'</div>' : '') +
            '<div style="font-size:11.5px;margin-top:6px;color:'+(intarziat?'var(--red)':(p.la?'var(--text2)':'var(--warm-text)'))+';">'+(p.la ? '→ '+esc(p.ce||'pas')+' · '+esc(cand(p.la)) : 'fără pas următor')+'</div>' +
          '</div>';
        }).join('') + '</div>';
    };
    const castigati = pe('castigat'), pierduti = pe('pierdut');
    const sumaC = castigati.reduce((s,c) => s + E.valoareClient(c, deals), 0);
    const mic = c => '<div data-fisa="'+c.id+'" style="font-size:12.5px;padding:6px 0;border-top:1px solid var(--line);cursor:pointer;">'+esc(c.nume)+'<span style="color:var(--text3);"> · '+esc(c.etapa==='pierdut' ? (c.motivPierdere||'') : (E.valoareClient(c, deals) ? fmtRon(E.valoareClient(c, deals)) : ''))+'</span></div>';
    return (
      '<div style="margin-bottom:18px;"><div class="pagetitle">Etape</div><div class="pagesub">clienții în lucru · trage o fișă în altă coloană ca să schimbi etapa</div></div>' +
      '<div class="dealsboard" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;align-items:start;">' + E.ACTIVE.map(coloana).join('') + '</div>' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:18px;">' +
        '<div class="card" style="flex:1;min-width:260px;padding:16px 18px;"><div class="cardhead" style="margin-bottom:6px;">'+etapaPill('castigat')+'<span style="font-size:12px;color:var(--text3);font-weight:400;">'+castigati.length+(sumaC?' · '+esc(fmtRon(sumaC)):'')+'</span></div>'+(castigati.map(mic).join('') || '<div style="font-size:12.5px;color:var(--text3);">încă niciunul</div>')+'</div>' +
        '<div class="card" style="flex:1;min-width:260px;padding:16px 18px;"><div class="cardhead" style="margin-bottom:6px;">'+etapaPill('pierdut')+'<span style="font-size:12px;color:var(--text3);font-weight:400;">'+pierduti.length+'</span></div>'+(pierduti.map(mic).join('') || '<div style="font-size:12.5px;color:var(--text3);">încă niciunul</div>')+'</div>' +
      '</div>'
    );
  }
  function wireEtape(){
    const page = document.getElementById('page');
    legaRanduri(page);
    let tras = null;
    page.querySelectorAll('[data-card]').forEach(card => {
      card.addEventListener('dragstart', e => { tras = card.dataset.card; card.style.opacity = '0.4'; e.dataTransfer.effectAllowed = 'move'; });
      card.addEventListener('dragend', () => { card.style.opacity = '1'; });
    });
    page.querySelectorAll('.coloana').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.style.outline = '2px solid var(--accent)'; });
      col.addEventListener('dragleave', () => { col.style.outline = ''; });
      col.addEventListener('drop', e => {
        e.preventDefault(); col.style.outline = '';
        const c = clients.find(x => x.id === tras); tras = null;
        if(c && E.etapaClient(c, deals) !== col.dataset.etapa) openGataModal(c.id, col.dataset.etapa);
      });
    });
  }

  /* ---------- RAPOARTE ---------- */
  let raportInterval = 'start';
  function intervalRaport(){
    const n = new Date();
    if(raportInterval === '30') return { start: new Date(n.getTime() - 30*864e5), end: null, label: 'ultimele 30 de zile' };
    if(raportInterval === 'luna') return { start: new Date(n.getFullYear(), n.getMonth(), 1), end: null, label: 'luna aceasta' };
    if(raportInterval === 'lunaTrecuta') return { start: new Date(n.getFullYear(), n.getMonth()-1, 1), end: new Date(n.getFullYear(), n.getMonth(), 1), label: 'luna trecută' };
    if(raportInterval === 'tot') return { start: null, end: null, label: 'tot timpul' };
    return { start: new Date(E.DATA_START), end: null, label: 'din 10 noiembrie' };
  }
  function fmtOre(h){
    if(h === null) return '-';
    if(h < 1) return Math.round(h*60) + ' min';
    if(h < 48) return (Math.round(h*10)/10).toLocaleString('ro-RO') + ' ore';
    return Math.round(h/24) + ' zile';
  }
  function rapoarteHtml(){
    const I = intervalRaport();
    const drum = E.drumulClientilor(clients, deals, I);
    const total = drum[0].n || 0;
    const cer = E.ceCerClientii(clients, I);
    const v = E.vitezaRaspuns(clients, I);
    const r = E.rezultate(clients, deals, I);
    const opt = [['start','din 10 noiembrie'],['30','ultimele 30 de zile'],['luna','luna aceasta'],['lunaTrecuta','luna trecută'],['tot','tot timpul']];
    const card = (titlu, intrebare, corp) => '<div class="card" style="padding:20px 22px;margin-bottom:16px;"><div class="cardhead" style="margin-bottom:2px;">'+titlu+'</div><div style="font-size:12.5px;color:var(--text3);margin-bottom:14px;">'+intrebare+'</div>'+corp+'</div>';
    const drumHtml = total ? drum.map(d => {
      const p = total ? d.n / total : 0;
      return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">' +
        '<div style="width:170px;font-size:12.5px;color:var(--text2);flex-shrink:0;">'+esc(d.label)+'</div>' +
        '<div style="flex:1;background:#efeee8;border-radius:6px;height:22px;position:relative;"><div style="width:'+Math.max(p*100, d.n?2:0)+'%;background:'+(d.key==='castigat'?'#3f8f3f':'#1f8f72')+';height:100%;border-radius:6px;"></div></div>' +
        '<div style="width:90px;text-align:right;font-size:12.5px;"><b>'+d.n+'</b> <span style="color:var(--text3);">('+Math.round(p*100)+'%)</span></div></div>';
    }).join('') : '<div style="font-size:13px;color:var(--text3);">Niciun client în acest interval.</div>';
    const maxCel = Math.max(1, ...cer.randuri.flatMap(rr => cer.coloane.map(cc => (cer.matrice[rr]||{})[cc] || 0)));
    const cerHtml = cer.randuri.length ? '<div style="overflow-x:auto;"><table style="border-collapse:collapse;width:100%;"><thead><tr><th style="padding:8px;"></th>' + cer.coloane.map(cc => '<th style="padding:8px;font-size:11px;text-transform:none;letter-spacing:0;">'+esc(cc)+'</th>').join('') + '</tr></thead><tbody>' +
      cer.randuri.map(rr => '<tr><td style="padding:8px;font-size:12.5px;white-space:nowrap;">'+esc(rr)+'</td>' + cer.coloane.map(cc => { const n = (cer.matrice[rr]||{})[cc] || 0; return '<td style="padding:8px;text-align:center;font-size:13px;background:rgba(31,143,114,'+(n ? 0.12 + 0.6*n/maxCel : 0)+');">'+(n||'')+'</td>'; }).join('') + '</tr>').join('') + '</tbody></table></div>'
      : '<div style="font-size:13px;color:var(--text3);">Niciun client în acest interval.</div>';
    const vitHtml = v.masurati ?
      '<div style="display:flex;gap:28px;flex-wrap:wrap;align-items:flex-end;">' +
        '<div><div style="font-size:30px;font-weight:600;color:#0d5c56;">'+fmtOre(v.mediana)+'</div><div style="font-size:12px;color:var(--text3);">timpul tipic până la primul contact</div></div>' +
        '<div style="font-size:13px;line-height:1.7;">în prima oră: <b>'+v.subOOra+'</b> din '+v.masurati+'<br>în prima zi: <b>'+v.subOZi+'</b> din '+v.masurati+(v.nesunati?'<br><span style="color:var(--warm-text);">încă nesunați: <b>'+v.nesunati+'</b></span>':'')+'</div>' +
      '</div>'
      : '<div style="font-size:13px;color:var(--text3);">Se măsoară de acum înainte: de fiecare dată când apeși „Gata” la un client nou, CRM-ul notează cât a trecut de la formular.'+(v.nesunati?' Încă nesunați: <b>'+v.nesunati+'</b>.':'')+'</div>';
    const motive = Object.entries(r.motive).sort((a,b) => b[1]-a[1]);
    const rezHtml = '<div style="display:flex;gap:28px;flex-wrap:wrap;margin-bottom:12px;">' +
        '<div><div style="font-size:22px;font-weight:600;">'+r.cuOferta+'</div><div style="font-size:12px;color:var(--text3);">oferte trimise'+(r.valOferte?' · '+esc(fmtRon(r.valOferte)):'')+'</div></div>' +
        '<div><div style="font-size:22px;font-weight:600;color:#3f8f3f;">'+r.castigati+'</div><div style="font-size:12px;color:var(--text3);">câștigați'+(r.valCastigat?' · '+esc(fmtRon(r.valCastigat)):'')+'</div></div>' +
        '<div><div style="font-size:22px;font-weight:600;">'+(r.rataCastig===null?'-':Math.round(r.rataCastig*100)+'%')+'</div><div style="font-size:12px;color:var(--text3);">din ofertele încheiate, câștigate</div></div>' +
      '</div>' +
      (motive.length ? '<div style="font-size:12.5px;color:var(--text2);margin-bottom:4px;">De ce s-au pierdut:</div>' + motive.map(([mm, n]) => '<div style="font-size:13px;padding:3px 0;">'+esc(mm)+': <b>'+n+'</b></div>').join('') : '<div style="font-size:13px;color:var(--text3);">Niciun client pierdut în acest interval.</div>');
    return (
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:18px;flex-wrap:wrap;gap:12px;">' +
        '<div><div class="pagetitle">Rapoarte</div><div class="pagesub">o privire pe săptămână: ce merge și unde se pierd clienții</div></div>' +
        '<select id="raportInterval" class="filt">' + opt.map(([k,l]) => '<option value="'+k+'"'+(k===raportInterval?' selected':'')+'>'+l+'</option>').join('') + '</select>' +
      '</div>' +
      card('Lead-uri pe săptămână, pe surse', 'Când merg reclamele și când nu (ultimele 12 săptămâni, indiferent de interval).', '<div style="height:240px;"><canvas id="chartSaptamani"></canvas></div>') +
      card('Drumul clienților', 'Din clienții veniți '+esc(I.label)+', câți au ajuns cel puțin până la fiecare etapă (cei pierduți se numără până la etapa la care s-au oprit).', drumHtml) +
      card('Ce cer clienții', 'Tipul spațiului și problema, pentru clienții veniți '+esc(I.label)+'.', cerHtml) +
      card('Cât de repede răspunzi', 'De la formular până la primul apel sau mesaj, pentru clienții veniți '+esc(I.label)+'.', vitHtml) +
      card('Oferte, câștiguri, pierderi', 'Pentru clienții veniți '+esc(I.label)+'.', rezHtml) +
      '<div style="font-size:12px;color:var(--text3);">La clienții de dinainte de 10 noiembrie, etapa e dedusă din fișele vechi (contactat, neinteresat, oferte).</div>'
    );
  }
  function wireRapoarte(){
    document.getElementById('raportInterval').addEventListener('change', e => { raportInterval = e.target.value; renderPage(); });
    try{
      if(typeof Chart === 'undefined') throw new Error('Chart.js nu s-a încărcat');
      const S = E.leadPeSaptamani(clients, new Date(), 12);
      const culori = ['#1f8f72','#3576c9','#d98e4c','#c94f8f','#7a4fc9','#3f8f3f','#98978a','#c0453f'];
      charts.saptamani = new Chart(document.getElementById('chartSaptamani'), {
        type: 'bar',
        data: {
          labels: S.saptamani.map(w => w.start.toLocaleDateString('ro-RO', {day:'2-digit', month:'2-digit'})),
          datasets: S.surse.map((s, i) => ({ label: s, data: S.saptamani.map(w => w.surse[s] || 0), backgroundColor: culori[i % culori.length], maxBarThickness: 40 }))
        },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } },
          scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: '#eceae1' } } } }
      });
    }catch(err){ console.error('Eroare la grafic:', err); }
  }

  /* ---------- GHID PENTRU APEL ---------- */
  const LOC_GENERIC = { nume:'[numele clientului]', expeditor:'[numele tău]', spatiu:'[spațiul, din formular]', suprafata:' [de … m²]', problema:'[și că vă deranjează …]', pasUrmator:'[pasul stabilit]' };
  function generic(text){ return String(text).replace(/\{(\w+)\}/g, (m, k) => LOC_GENERIC[k] || m); }
  function citat(text){ return '<div style="background:#f3faf7;border-left:3px solid var(--accent);padding:9px 12px;border-radius:0 8px 8px 0;font-size:13.5px;margin:6px 0;line-height:1.5;">„'+esc(text)+'”</div>'; }
  function lista(items){ return '<ul style="margin:6px 0;padding-left:18px;display:flex;flex-direction:column;gap:4px;">' + items.map(x => '<li style="font-size:13px;color:var(--text2);line-height:1.45;">'+esc(x)+'</li>').join('') + '</ul>'; }
  function cardGhid(nr, titlu, corp){
    return '<div class="card ghidcard" style="padding:20px 22px;margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        (nr ? '<span style="width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;font-size:13px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">'+nr+'</span>' : '') +
        '<span style="font-size:15.5px;font-weight:600;">'+esc(titlu)+'</span></div>' + corp + '</div>';
  }
  function tabel(cap, randuri){
    return '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr>' + cap.map(h => '<th style="text-transform:none;letter-spacing:0;font-size:12px;padding:8px 10px;">'+esc(h)+'</th>').join('') + '</tr></thead><tbody>' +
      randuri.map(r => '<tr>' + r.map(x => '<td style="font-size:13px;padding:9px 10px;vertical-align:top;line-height:1.45;">'+esc(x)+'</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  function corpPas(p){
    let h = '';
    if(p.faci) h += lista(p.faci);
    (p.spui || []).forEach(s => { h += citat(generic(s)); });
    if(p.daca && p.daca.length) h += '<div style="font-size:12px;color:var(--text3);margin-top:8px;">Dacă:</div>' + tabel(['Situația','Ce faci'], p.daca.map(([a,b]) => [a, generic(b)]));
    return h;
  }

  function ghidHtml(){
    const pas = k => G.PASI.find(p => p.cheie === k);
    const grupuri = [...new Set(G.INTREBARI.map(i => i.grup))];
    return (
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:18px;flex-wrap:wrap;gap:12px;">' +
        '<div><div class="pagetitle">Ghid pentru apel</div><div class="pagesub">pentru oricine sună clienții · versiunea '+esc(G.VERSIUNE)+' · în fișa fiecărui client, „Ghid pentru apel” îl arată completat pentru omul respectiv</div></div>' +
        '<button id="ghidPrint" class="btn no-print"><i class="ti ti-printer" aria-hidden="true"></i> tipărește sau salvează PDF</button>' +
      '</div>' +
      cardGhid('', 'Pe scurt', '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">' +
        G.PRINCIPII.map(p => '<div style="background:#faf9f6;border:1px solid var(--line);border-radius:10px;padding:12px 14px;"><div style="font-weight:600;font-size:13.5px;margin-bottom:4px;">'+esc(p.titlu)+'</div><div style="font-size:12.5px;color:var(--text2);line-height:1.45;">'+esc(p.text)+'</div></div>').join('') + '</div>') +
      cardGhid(1, pas('inainte').titlu, corpPas(pas('inainte'))) +
      cardGhid(2, pas('deschidere').titlu, corpPas(pas('deschidere'))) +
      cardGhid(3, pas('confirmare').titlu, corpPas(pas('confirmare'))) +
      cardGhid(4, pas('intrebari').titlu, corpPas(pas('intrebari')) + grupuri.map(g =>
        '<div style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text3);margin:12px 0 2px;">'+esc(g)+'</div>' +
        G.INTREBARI.filter(i => i.grup === g).map(i => citat(i.intreb) + (i.ajutor ? '<div style="font-size:12px;color:var(--text3);margin:-2px 0 6px 15px;">'+esc(i.ajutor)+'</div>' : '')).join('')).join('')) +
      cardGhid(5, pas('explicatie').titlu, corpPas(pas('explicatie')) + L.PROBLEMA.map(pr =>
        '<div style="font-size:12.5px;font-weight:600;margin:12px 0 0;">'+esc(pr)+'</div>' + citat(G.EXPLICATII[pr])).join('')) +
      cardGhid(6, pas('pas').titlu, corpPas(pas('pas')) +
        tabel(['Când','Propui','Rezerva'], [
          ['Bas necontrolat sau mixuri care sună diferit', 'Studiul la fața locului', 'Recomandare pe poze'],
          ['Restaurant, sală de repetiții sau peste 40 m²', 'Studiul la fața locului', 'Recomandare pe poze'],
          ['Cameră mică (până la 20 m²) cu ecou, voce neclară sau „nu știu”', 'Recomandare pe poze', 'Setul din magazin'],
          ['Izolare față de vecini sau home cinema', 'Îl dai lui Beia', '-'],
          ['Orice altceva', 'Recomandare pe poze', 'Studiul la fața locului']
        ]) +
        ['poze','studiu','kit','beia'].map(k => '<div style="font-size:12.5px;font-weight:600;margin:14px 0 0;">'+esc(G.TREPTE[k].titlu)+'</div>' + citat(G.TREPTE[k].spui) + '<div style="font-size:12px;color:var(--text3);margin-left:15px;">După apel: '+esc(G.TREPTE[k].dupa)+'</div>').join('') +
        '<div style="font-size:12.5px;font-weight:600;margin:14px 0 4px;">Seturile din magazin (prețuri de pe site, 13 noiembrie 2026)</div>' + tabel(['Set','Preț','Pentru'], G.SETURI)) +
      cardGhid(7, pas('inchidere').titlu, corpPas(pas('inchidere'))) +
      cardGhid('', 'Când clientul spune…', tabel(['Clientul spune','Tu răspunzi','Notă'], G.OBIECTII)) +
      cardGhid('', 'Ce nu spui niciodată', tabel(['Nu spui','Spui în loc'], G.NICIODATA)) +
      cardGhid('', 'Când îl dai lui Beia', lista(G.LA_BEIA) + '<div style="font-size:12.5px;color:var(--text2);margin-top:6px;">Cum: la „Gata” scrii „Pentru Beia: …” cu ce ai aflat, iar pasul următor e „Beia sună”, la ora stabilită cu clientul.</div>') +
      cardGhid('', 'Pe tipul spațiului', '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">' +
        Object.entries(G.SPATII).map(([nume, s]) => '<div style="border:1px solid var(--line);border-radius:10px;padding:12px 14px;"><div style="font-weight:600;font-size:13.5px;margin-bottom:6px;">'+esc(nume)+'</div>' +
          [['Vrea', s.vrea], ['Întrebi în plus', s.intrebi], ['Propui', s.propui], ['Atenție', s.atentie]].filter(x => x[1]).map(([a,b]) => '<div style="font-size:12.5px;line-height:1.45;margin-bottom:4px;"><span style="color:var(--text3);">'+a+':</span> '+esc(b)+'</div>').join('') + '</div>').join('') + '</div>') +
      '<div class="card ghidcard" style="padding:16px 20px;margin-bottom:14px;background:#fbf5ea;border-color:var(--warm-bg);"><div style="font-weight:600;font-size:13.5px;color:var(--warm-text);margin-bottom:4px;">De confirmat de Beia, înainte să-l folosească altcineva</div>' + lista(G.DE_CONFIRMAT) + '</div>' +
      '<div style="font-size:11.5px;color:var(--text3);line-height:1.6;margin-bottom:20px;"><b>Surse.</b> ' + G.SURSE.map(esc).join(' ') + '</div>'
    );
  }
  function wireGhid(){
    document.getElementById('ghidPrint').addEventListener('click', () => window.print());
  }

  const CAMPURI_APEL = ['folosire','sistem','deranjeaza','incercat','implicatie','castig','termen','buget','decide'];
  const CAMPURI_CONSTRUCTIE = [['ap_pereti','Pereți','pereti'],['ap_tavan','Tavan','tavan'],['ap_podea','Pe jos','podea']];
  const ETICHETE_APEL = { folosire:'Folosește', sistem:'Sistem audio', pereti:'Pereți', tavan:'Tavan', podea:'Pe jos', deranjeaza:'Îl deranjează', incercat:'A încercat', implicatie:'Cum îl încurcă', castig:'Ce ar câștiga', termen:'Termen', buget:'Buget', decide:'Hotărăște cu', oras:'Oraș' };

  function openApelModal(id){
    const c = clients.find(x => x.id === id);
    if(!c) return;
    const S = G.scenariu(c, numeExpeditor());
    const pas = k => S.pasi.find(p => p.cheie === k);
    const sect = (nr, titlu, corp) => '<div style="margin-top:16px;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span style="width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;font-size:12px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;">'+nr+'</span><span style="font-weight:600;font-size:14px;">'+esc(titlu)+'</span></div>'+corp+'</div>';
    const intrebare = i => {
      let input;
      if(i.camp === 'dimensiuni'){
        const v = f => (c[f] !== null && c[f] !== undefined) ? c[f] : '';
        input = '<div style="display:flex;gap:6px;">' + [['ap_lungime','Lungime (m)','lungime'],['ap_latime','Lățime (m)','latime'],['ap_inaltime','Înălțime (m)','inaltime']].map(([idd, ph, f]) =>
          '<input id="'+idd+'" type="number" step="0.01" min="0" placeholder="'+ph+'" value="'+esc(v(f))+'" style="flex:1;min-width:0;background:#fff;border:1px solid var(--line-strong);padding:8px 9px;border-radius:8px;font-size:12.5px;outline:none;">').join('') + '</div>';
      } else if(i.camp === 'constructie'){
        input = '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + CAMPURI_CONSTRUCTIE.map(([idd, ph, f]) =>
          '<input id="'+idd+'" placeholder="'+ph+'" value="'+esc(c[f]||'')+'" style="flex:1;min-width:110px;background:#fff;border:1px solid var(--line-strong);padding:8px 9px;border-radius:8px;font-size:12.5px;outline:none;">').join('') + '</div>';
      } else {
        const valoare = i.camp === 'oras' ? (c.adresa || '') : (c[i.camp] || '');
        input = '<input id="ap_'+i.camp+'" value="'+esc(valoare)+'" placeholder="ce a răspuns" style="width:100%;background:#fff;border:1px solid var(--line-strong);padding:8px 10px;border-radius:8px;font-size:12.5px;outline:none;">';
      }
      return '<div style="margin:8px 0 12px;"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.04em;">'+esc(i.grup)+'</div>' + citat(i.intreb) +
        (i.ajutor ? '<div style="font-size:11.5px;color:var(--text3);margin:-2px 0 5px 15px;">'+esc(i.ajutor)+'</div>' : '') + input + '</div>';
    };
    const m = document.getElementById('modal');
    m.innerHTML =
      modalHeader('Apel cu ' + esc(c.nume)) +
      '<div style="font-size:12px;color:var(--text3);">'+esc([c.tipSpatiu, c.suprafata, c.problema].filter(Boolean).join(' · ') || 'nu a completat spațiul')+' · venit '+esc(L.vechime(c.addedAt))+'</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">' + butoaneContact(c) + '</div>' +
      sect(1, 'Deschiderea', citat(pas('deschidere').spui[0]) + tabel(['Dacă','Ce faci'], pas('deschidere').daca)) +
      sect(2, 'Confirmi ce a scris', citat(pas('confirmare').spui[0]) + '<div style="font-size:12px;color:var(--text3);margin-left:15px;">Îl lași să povestească și nu-l întrerupi.</div>') +
      sect(3, 'Întrebările', '<div style="font-size:12px;color:var(--text3);">Sari peste ce ți-a spus deja. Răspunsurile se salvează în fișă.</div>' + G.INTREBARI.map(intrebare).join('')) +
      sect(4, 'Repeți și explici', '<div style="font-size:12.5px;color:var(--text2);">Întâi: „Deci, ca să văd dacă am înțeles: …”. Apoi:</div>' + citat(S.explicatie)) +
      sect(5, 'Propui: ' + S.treapta.titlu, '<div style="font-size:12px;color:var(--text3);">De ce: '+esc(S.treapta.motiv)+'</div>' + citat(S.treapta.spui) + '<div style="font-size:12px;color:var(--text3);margin-left:15px;">După apel: '+esc(S.treapta.dupa)+'</div>' +
        (S.rezerva ? '<details style="margin-top:6px;"><summary style="cursor:pointer;font-size:12.5px;color:var(--text2);">Dacă nu vrea: '+esc(S.rezerva.titlu)+'</summary>' + citat(S.rezerva.spui) + '</details>' : '')) +
      sect(6, 'Închizi', citat(pas('inchidere').spui[0])) +
      '<details style="margin-top:16px;"><summary style="cursor:pointer;font-size:13px;font-weight:500;">Când clientul spune…</summary>' + tabel(['Clientul spune','Tu răspunzi'], S.obiectii.map(o => [o[0], o[1]])) + '</details>' +
      '<details style="margin-top:8px;"><summary style="cursor:pointer;font-size:13px;font-weight:500;">Ce nu spui niciodată</summary>' + tabel(['Nu spui','Spui în loc'], G.NICIODATA) + '</details>' +
      '<details style="margin-top:8px;"><summary style="cursor:pointer;font-size:13px;font-weight:500;">'+esc(c.tipSpatiu || 'Alt tip de spațiu')+': ce vrea, ce mai întrebi</summary><div style="font-size:12.5px;line-height:1.5;margin-top:6px;">' +
        [['Vrea', S.spatiu.vrea], ['Întrebi în plus', S.spatiu.intrebi], ['Propui', S.spatiu.propui], ['Atenție', S.spatiu.atentie]].filter(x => x[1]).map(([a,b]) => '<div><span style="color:var(--text3);">'+a+':</span> '+esc(b)+'</div>').join('') + '</div></details>' +
      '<div id="formError" style="display:none;color:#a3372f;font-size:12px;margin-top:10px;"></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;flex-wrap:wrap;"><button id="cancelBtn" class="btn">închide</button><button id="apSave" class="btn-primary">salvează răspunsurile și mergi la „Gata”</button></div>';
    document.getElementById('modalWrap').style.display = 'flex';
    m.scrollTop = 0;
    legaRanduri(m);
    document.getElementById('closeModal').onclick = closeModal;
    document.getElementById('cancelBtn').onclick = closeModal;
    document.getElementById('apSave').onclick = () => salveazaApel(c);
  }

  async function salveazaApel(c){
    const upd = { updatedAt: new Date().toISOString() };
    const rezumat = [];
    CAMPURI_APEL.forEach(f => { const v = val('ap_'+f); if(v !== (c[f] || '')) upd[f] = v; if(v) rezumat.push(ETICHETE_APEL[f] + ': ' + v); });
    const oras = val('ap_oras');
    if(oras && oras !== (c.adresa || '')) upd.adresa = oras;
    if(oras) rezumat.unshift(ETICHETE_APEL.oras + ': ' + oras);
    [['ap_lungime','lungime'],['ap_latime','latime'],['ap_inaltime','inaltime']].forEach(([idd, f]) => { const v = val(idd); if(v !== '') upd[f] = parseFloat(v); });
    const constructie = [];
    CAMPURI_CONSTRUCTIE.forEach(([idd, , f]) => { const v = val(idd); if(v !== (c[f] || '')) upd[f] = v; if(v) constructie.push(ETICHETE_APEL[f] + ': ' + v); });
    const cote = ['lungime','latime','inaltime'].map(f => upd[f] !== undefined ? upd[f] : c[f]).filter(x => x !== null && x !== undefined && x !== '');
    if(cote.length === 3) rezumat.splice(oras ? 1 : 0, 0, 'Cote: ' + cote.map(x => Number(x).toLocaleString('ro-RO')).join(' × ') + ' m');
    if(constructie.length) rezumat.splice((oras ? 1 : 0) + (cote.length === 3 ? 1 : 0), 0, constructie.join('. '));
    try{
      await updateDoc(doc(db,'clients',c.id), upd);
      const eAcum = E.etapaClient(c, deals);
      openGataModal(c.id, eAcum === 'nou' ? 'contactat' : null, rezumat.join('. '));
    }catch(err){ console.error(err); formError('Nu s-a salvat: verifică internetul și încearcă din nou.'); }
  }

  // Ce a scris clientul în formular, sus în fișă: primul lucru de citit înainte de apel.
  function ceACompletat(c){
    const r = [];
    const spatiu = [c.tipSpatiu, c.suprafata].filter(Boolean).join(' · ');
    if(spatiu) r.push(['Spațiu', spatiu]);
    if(c.problema) r.push(['Problema', c.problema]);
    if(c.mesaj) r.push(['Mesajul lui', c.mesaj]);
    if(c.nevoie) r.push(['Notițe', c.nevoie]);
    const contact = [c.telefon, c.email].filter(Boolean).join(' · ');
    if(contact) r.push(['Contact', contact]);
    if(!r.length) return '';
    return '<div style="background:#f3faf7;border:1px solid #cfe9df;border-radius:10px;padding:11px 14px;margin-bottom:12px;">' +
      '<div style="font-size:11px;color:var(--accent-dark);font-weight:600;margin-bottom:5px;">'+(c.dinMail ? 'CE A COMPLETAT ÎN FORMULAR' : 'DESPRE CE E VORBA')+'</div>' +
      r.map(([k,v]) => '<div style="font-size:13.5px;line-height:1.5;"><span style="color:var(--text3);">'+esc(k)+':</span> <span style="white-space:pre-wrap;'+(k==='Problema'?'font-weight:600;':'')+'">'+esc(v)+'</span></div>').join('') + '</div>';
  }

  function ceAmAflat(c){
    const r = [];
    if(c.adresa) r.push(['Oraș', c.adresa]);
    if(c.lungime && c.latime) r.push(['Cote', [c.lungime, c.latime, c.inaltime].filter(Boolean).map(x => Number(x).toLocaleString('ro-RO')).join(' × ') + ' m']);
    ['pereti','tavan','podea'].forEach(f => { if(c[f]) r.push([ETICHETE_APEL[f], c[f]]); });
    CAMPURI_APEL.forEach(f => { if(c[f]) r.push([ETICHETE_APEL[f], c[f]]); });
    if(!r.length) return '';
    return '<div style="background:#faf9f6;border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-bottom:12px;"><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">CE AM AFLAT LA APEL</div>' +
      r.map(([a,b]) => '<div style="font-size:12.5px;line-height:1.5;"><span style="color:var(--text3);">'+esc(a)+':</span> '+esc(b)+'</div>').join('') + '</div>';
  }

  /* ---------- CALENDAR ---------- */
  const RO_MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
  const RO_DAYS = ['Lun','Mar','Mie','Joi','Vin','Sâm','Dum'];

  function dateStr(y,m,d){ return y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'); }
  function todayStr(){ const n=new Date(); return dateStr(n.getFullYear(), n.getMonth(), n.getDate()); }

  function itemsForDay(ds){
    const pasi = clients.filter(c => E.inLucru(c) && E.ACTIVE.includes(E.etapaClient(c, deals)))
      .map(c => ({ c, p: E.pasClient(c) }))
      .filter(({p}) => p.la && toDatetimeLocal(p.la).slice(0,10) === ds)
      .map(({c, p}) => ({ type:'call', time: new Date(p.la).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'}), label: (p.ce || 'Pas') + ': ' + c.nume, sub: E.etapa(E.etapaClient(c, deals)).label, refId:c.id }));
    const custom = events.filter(e => e.date===ds)
      .map(e => ({ type:'event', time:e.time||'', label:e.title, sub:e.notes||'', refId:e.id }));
    return [...pasi, ...custom].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  }

  function calendarHtml(){
    const firstOfMonth = new Date(calYear, calMonth, 1);
    const startOffset = (firstOfMonth.getDay()+6)%7; // Monday=0
    const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
    const tStr = todayStr();

    let cells = '';
    for(let i=0;i<startOffset;i++) cells += '<div></div>';
    for(let d=1; d<=daysInMonth; d++){
      const ds = dateStr(calYear, calMonth, d);
      const items = itemsForDay(ds);
      const isToday = ds===tStr;
      const preview = items.slice(0,2).map(it => {
        const color = it.type==='call' ? 'var(--warm-text)' : it.type==='deal' ? 'var(--blue)' : 'var(--accent-dark)';
        return '<div style="font-size:10.5px;color:'+color+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;">'+(it.time?it.time+' ':'')+esc(it.label)+'</div>';
      }).join('');
      const more = items.length>2 ? '<div style="font-size:10px;color:var(--text3);margin-top:2px;">+'+(items.length-2)+' mai multe</div>' : '';
      cells += '<div class="calday" data-date="'+ds+'" style="min-height:88px;border:1px solid var(--line);border-radius:8px;padding:6px 7px;cursor:pointer;background:'+(isToday?'var(--accent-bg)':'#fff')+';">' +
        '<div style="font-size:12px;font-weight:'+(isToday?'700':'500')+';color:'+(isToday?'var(--accent-dark)':'var(--text)')+';">'+d+'</div>' +
        preview + more +
      '</div>';
    }

    return (
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">' +
        '<div><div class="pagetitle">Calendar</div><div class="pagesub">apeluri programate + întâlniri</div></div>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<i class="ti ti-chevron-left" id="calPrev" style="font-size:20px;cursor:pointer;color:var(--text2);" aria-hidden="true"></i>' +
          '<span style="font-size:15px;font-weight:500;min-width:150px;text-align:center;">'+RO_MONTHS[calMonth]+' '+calYear+'</span>' +
          '<i class="ti ti-chevron-right" id="calNext" style="font-size:20px;cursor:pointer;color:var(--text2);" aria-hidden="true"></i>' +
          '<button id="calTodayBtn" class="btn" style="margin-left:6px;">azi</button>' +
          '<button id="calAddBtn" class="btn-primary">+ eveniment</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:8px;">' +
        RO_DAYS.map(d=>'<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.03em;color:var(--text3);text-align:center;">'+d+'</div>').join('') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">' + cells + '</div>'
    );
  }

  function wireCalendar(){
    document.getElementById('calPrev').addEventListener('click', () => { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderPage(); });
    document.getElementById('calNext').addEventListener('click', () => { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderPage(); });
    document.getElementById('calTodayBtn').addEventListener('click', () => { const n=new Date(); calYear=n.getFullYear(); calMonth=n.getMonth(); renderPage(); });
    document.getElementById('calAddBtn').addEventListener('click', () => openEventModal(null, todayStr()));
    document.querySelectorAll('.calday').forEach(cell => {
      cell.addEventListener('click', () => openDayModal(cell.dataset.date));
    });
  }

  function openDayModal(ds){
    calSelectedDate = ds;
    const items = itemsForDay(ds);
    const d = new Date(ds+'T00:00:00');
    const m = document.getElementById('modal');
    m.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<div style="font-size:15px;font-weight:500;">'+d.toLocaleDateString('ro-RO',{weekday:'long',day:'numeric',month:'long'})+'</div>' +
        '<button id="closeModal" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:18px;">&times;</button>' +
      '</div>' +
      (items.length===0
        ? '<div style="text-align:center;padding:30px 10px;color:var(--text3);font-size:13px;">nimic programat în ziua asta</div>'
        : '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">' +
            items.map(it => {
              const color = it.type==='call' ? 'var(--warm-text)' : it.type==='deal' ? 'var(--blue)' : 'var(--accent-dark)';
              const icon = it.type==='call' ? 'ti-phone-outgoing' : it.type==='deal' ? 'ti-file-text' : 'ti-calendar-event';
              return '<div class="dayitem" data-type="'+it.type+'" data-ref="'+it.refId+'" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;'+(it.type==='event'?'cursor:pointer;':'')+'">' +
                '<i class="ti '+icon+'" style="font-size:16px;color:'+color+';flex-shrink:0;" aria-hidden="true"></i>' +
                '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:500;">'+(it.time?it.time+' — ':'')+esc(it.label)+'</div>' +
                (it.sub?'<div style="font-size:11.5px;color:var(--text3);">'+esc(it.sub)+'</div>':'') + '</div>' +
              '</div>';
            }).join('') +
          '</div>'
      ) +
      '<button id="dayAddBtn" class="btn" style="width:100%;">+ adaugă eveniment în această zi</button>';
    document.getElementById('modalWrap').style.display = 'flex';
    document.getElementById('closeModal').onclick = closeModal;
    document.getElementById('dayAddBtn').onclick = () => openEventModal(null, ds);
    m.querySelectorAll('.dayitem[data-type="event"]').forEach(el => {
      el.addEventListener('click', () => openEventModal(el.dataset.ref, ds));
    });
    m.querySelectorAll('.dayitem[data-type="call"]').forEach(el => {
      el.addEventListener('click', () => openClientModal(el.dataset.ref));
    });
  }

  function openEventModal(id, defaultDate){
    editingEventId = id || null;
    const ev = id ? events.find(x=>x.id===id) : null;
    const m = document.getElementById('modal');
    m.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<div style="font-size:15px;font-weight:500;">'+(ev?'Editează eveniment':'Eveniment nou')+'</div>' +
        '<button id="closeModal" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:18px;">&times;</button>' +
      '</div>' +
      field('Titlu','f_ev_title', ev?ev.title:'') +
      field('Data','f_ev_date', ev?ev.date:defaultDate, 'date') +
      field('Oră (opțional)','f_ev_time', ev?ev.time:'', 'time') +
      textareaField('Notițe','f_ev_notes', ev?ev.notes:'') +
      '<div id="formError" style="display:none;color:#a3372f;font-size:12px;margin-top:6px;"></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px;">' +
        (ev?'<button id="deleteBtn" style="background:none;border:none;color:var(--text3);font-size:12px;cursor:pointer;">șterge</button>':'<span></span>') +
        '<div style="display:flex;gap:8px;"><button id="cancelBtn" class="btn">anulează</button><button id="saveBtn" class="btn-primary">salvează</button></div>' +
      '</div>';
    document.getElementById('modalWrap').style.display = 'flex';
    document.getElementById('closeModal').onclick = closeModal;
    document.getElementById('cancelBtn').onclick = closeModal;
    document.getElementById('saveBtn').onclick = saveEvent;
    if(ev) document.getElementById('deleteBtn').onclick = () => deleteEvent(ev.id);
  }

  async function saveEvent(){
    const title = document.getElementById('f_ev_title').value.trim();
    const date = document.getElementById('f_ev_date').value;
    const errEl = document.getElementById('formError');
    if(!title || !date){ errEl.textContent='completează titlul și data'; errEl.style.display='block'; return; }
    errEl.style.display='none';
    const data = {
      title,
      date,
      time: document.getElementById('f_ev_time').value,
      notes: document.getElementById('f_ev_notes').value.trim(),
      updatedAt: new Date().toISOString()
    };
    if(editingEventId){
      await updateDoc(doc(db,'events',editingEventId), data);
      logActivity('Eveniment actualizat: '+title);
    } else {
      data.createdAt = new Date().toISOString();
      await addDoc(eventsCol, data);
      logActivity('Eveniment nou: '+title);
    }
    if(calSelectedDate) openDayModal(calSelectedDate); else closeModal();
  }

  async function deleteEvent(id){
    if(!confirm('Ștergi acest eveniment?')) return;
    const ev = events.find(x=>x.id===id);
    await deleteDoc(doc(db,'events',id));
    if(ev) logActivity('Eveniment șters: '+ev.title);
    if(calSelectedDate) openDayModal(calSelectedDate); else closeModal();
  }

  /* ---------- CLIENTI ---------- */
  // Filtrele se țin aici, ca să nu se golească atunci când se schimbă datele și pagina se redesenează.
  const filtre = { q:'', luna:'', sursa:'', spatiu:'', problema:'', etapa:'', lucru:'lucru', important:'' };

  function clientsHtml(){
    const opt = (list, sel, gol) => '<option value="">'+gol+'</option>' + list.map(([v,l]) => '<option value="'+esc(v)+'"'+(v===sel?' selected':'')+'>'+esc(l)+'</option>').join('');
    const simple = list => list.map(x => [x, x]);
    const nLucru = clients.filter(c => E.inLucru(c)).length;
    return (
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;flex-wrap:wrap;gap:14px;">' +
        '<div><div class="pagetitle">Clienți</div><div class="pagesub">'+nLucru+' în lucru · '+(clients.length-nLucru)+' în arhivă (dinainte de 10 noiembrie)</div></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button id="exportBtn" class="btn"><i class="ti ti-download" aria-hidden="true"></i> exportă backup</button>' +
          '<button id="pasteBtn" class="btn"><i class="ti ti-mail" aria-hidden="true"></i> client din mail</button>' +
          '<button id="addBtn" class="btn-primary">+ client nou</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">' +
        '<input id="search" type="text" value="'+esc(filtre.q)+'" placeholder="caută nume, telefon sau email..." style="background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:9px 13px;border-radius:9px;font-size:13px;width:230px;outline:none;">' +
        '<select id="filtLucru" class="filt">'+[['lucru','în lucru'],['arhiva','arhivă'],['toti','toți clienții']].map(([v,l]) => '<option value="'+v+'"'+(v===filtre.lucru?' selected':'')+'>'+l+'</option>').join('')+'</select>' +
        '<select id="filtEtapa" class="filt">'+opt(E.ETAPE.map(e => [e.key, e.label]), filtre.etapa, 'toate etapele')+'</select>' +
        '<select id="filtSpatiu" class="filt">'+opt(simple(L.TIP_SPATIU), filtre.spatiu, 'toate spațiile')+'</select>' +
        '<select id="filtProblema" class="filt">'+opt(simple(L.PROBLEMA), filtre.problema, 'toate problemele')+'</select>' +
        '<select id="filtSursa" class="filt">'+opt(simple(SURSE), filtre.sursa, 'toate sursele')+'</select>' +
        '<select id="filtLuna" class="filt">'+opt(monthFilterPairs(), filtre.luna, 'toate lunile')+'</select>' +
        '<select id="filtImportant" class="filt">'+opt([['da','doar importanți ⭐']], filtre.important, 'importanți și ceilalți')+'</select>' +
      '</div>' +
      '<div class="card" style="padding:0;overflow:hidden;">' +
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
          '<thead><tr><th style="padding-left:20px;width:24px;"></th><th>Nume</th><th>Telefon</th><th>Spațiu</th><th>Problemă</th><th>Etapa</th><th>Ultima notă</th><th style="padding-right:24px;">Venit</th></tr></thead>' +
          '<tbody id="tbody"></tbody>' +
        '</table></div>' +
        '<div id="empty" style="display:none;text-align:center;padding:50px 20px;color:var(--text3);font-size:13px;">niciun client pentru aceste filtre</div>' +
      '</div>'
    );
  }

  function monthFilterPairs(){
    const names = ['ianuarie','februarie','martie','aprilie','mai','iunie','iulie','august','septembrie','octombrie','noiembrie','decembrie'];
    const keys = Array.from(new Set(clients.filter(c => c.addedAt).map(c => monthKey(c.addedAt)))).sort().reverse();
    return keys.map(k => { const [y,m] = k.split('-'); const l = names[parseInt(m,10)-1] + ' ' + y; return [k, l.charAt(0).toUpperCase() + l.slice(1)]; });
  }

  function wireClients(){
    document.getElementById('addBtn').addEventListener('click', () => openClientModal(null));
    document.getElementById('pasteBtn').addEventListener('click', openPasteModal);
    document.getElementById('exportBtn').addEventListener('click', exportBackup);
    document.getElementById('search').addEventListener('input', e => { filtre.q = e.target.value; renderClientsTable(); });
    [['filtLucru','lucru'],['filtEtapa','etapa'],['filtSpatiu','spatiu'],['filtProblema','problema'],['filtSursa','sursa'],['filtLuna','luna'],['filtImportant','important']].forEach(([id, k]) =>
      document.getElementById(id).addEventListener('change', e => { filtre[k] = e.target.value; renderClientsTable(); }));
    renderClientsTable();
  }

  function exportBackup(){
    const payload = { exportedAt: new Date().toISOString(), clients, deals, activity, events, istoric };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = 'beze-crm-backup-'+stamp+'.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderClientsTable(){
    const q = filtre.q.trim().toLowerCase();
    const filtered = clients.filter(c => {
      if(q){
        const qn = L.norm(q), qDigits = digitsOnly(q);
        const ok = L.norm(c.nume).includes(qn) || L.norm(c.email).includes(qn) || (c.telefon||'').toLowerCase().includes(q) || (qDigits.length>2 && digitsOnly(c.telefon).includes(qDigits));
        if(!ok) return false;
      }
      const lucru = E.inLucru(c);
      if(filtre.lucru==='lucru' && !lucru) return false;
      if(filtre.lucru==='arhiva' && lucru) return false;
      if(filtre.etapa && E.etapaClient(c, deals)!==filtre.etapa) return false;
      if(filtre.luna && monthKey(c.addedAt)!==filtre.luna) return false;
      if(filtre.sursa && c.sursa!==filtre.sursa) return false;
      if(filtre.spatiu && c.tipSpatiu!==filtre.spatiu) return false;
      if(filtre.problema && c.problema!==filtre.problema) return false;
      if(filtre.important==='da' && !c.important) return false;
      return true;
    }).sort((a,b)=>(b.addedAt||'').localeCompare(a.addedAt||''));
    document.getElementById('empty').style.display = filtered.length ? 'none':'block';
    const tbody = document.getElementById('tbody');
    tbody.innerHTML = '';
    filtered.forEach(c => tbody.appendChild(clientRowEl(c)));
  }

  function clientRowEl(c){
    const tr = document.createElement('tr');
    tr.className = 'rowhover';
    const e = E.etapaClient(c, deals);
    if(e === 'pierdut') tr.style.opacity = '0.55';
    const p = E.pasClient(c);
    const lucru = E.inLucru(c);
    const pasTxt = (lucru && p.la && E.ACTIVE.includes(e)) ? '<div style="font-size:11px;color:'+(new Date(p.la) < new Date() ? 'var(--red)' : 'var(--text3)')+';margin-top:3px;white-space:nowrap;">→ '+esc(p.ce||'pas')+' · '+esc(cand(p.la))+'</div>' : '';
    const starTd = document.createElement('td');
    starTd.style.cssText = 'padding-left:20px;white-space:nowrap;';
    const starIcon = document.createElement('i');
    starIcon.className = 'ti ti-star';
    starIcon.style.cssText = 'font-size:17px;cursor:pointer;color:'+(c.important?'#d9a53c':'var(--line-strong)')+';';
    starIcon.title = c.important ? 'client important: clic ca să scoți' : 'marchează ca important';
    starIcon.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await updateDoc(doc(db,'clients',c.id), { important: !c.important, updatedAt: new Date().toISOString() });
    });
    starTd.appendChild(starIcon);
    tr.appendChild(starTd);
    const spatiu = spatiuScurt(c);
    const nou = lucru && e === 'nou';
    const dublura = gasesteDublura(c.telefon, c.email, c.id);
    const nota = ultimaNota(c);
    tr.insertAdjacentHTML('beforeend',
      '<td style="max-width:200px;"><div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(c.nume) +
        (dublura ? ' <span class="pill" title="Mai e un client cu același telefon sau email: '+esc(dublura.nume)+'" style="background:var(--red-bg);color:var(--red);font-size:10.5px;padding:2px 7px;">dublură?</span>' : '') + '</div>' +
        (c.email ? '<div style="font-size:11.5px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(c.email)+'</div>' : '') + '</td>' +
      '<td class="mono" style="white-space:nowrap;">'+esc(c.telefon||'')+'</td>' +
      '<td style="max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+esc(spatiu || c.nevoie || '')+'">'+(spatiu ? esc(spatiu) : '<span style="color:var(--text3);">'+esc(c.nevoie||'')+'</span>')+'</td>' +
      '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+esc(c.problema||'')+'">'+esc(c.problema||'')+'</td>' +
      '<td style="white-space:nowrap;">'+etapaPill(e, true)+pasTxt+'</td>' +
      '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2);" title="'+esc(nota)+'">'+esc(nota)+'</td>' +
      '<td style="padding-right:24px;white-space:nowrap;color:'+(nou?culoareVechime(c.addedAt):'var(--text3)')+';font-weight:'+(nou?'500':'400')+';" title="'+esc(fmtDateTime(c.addedAt))+'">'+esc(L.vechime(c.addedAt))+'</td>'
    );
    const phoneTd = tr.children[2];
    const cifre = L.cifreTelefon(c.telefon);
    if(cifre){
      const acts = document.createElement('span');
      acts.style.cssText = 'margin-left:8px;display:inline-flex;gap:8px;vertical-align:middle;';
      acts.innerHTML =
        '<a href="tel:+'+cifre+'" title="Sună" style="color:var(--accent-dark);"><i class="ti ti-phone" style="font-size:16px;" aria-hidden="true"></i></a>' +
        '<a href="'+esc(linkWhatsApp(c))+'" target="_blank" rel="noopener" title="WhatsApp, cu mesajul pregătit" style="color:#1f8f4e;"><i class="ti ti-brand-whatsapp" style="font-size:16px;" aria-hidden="true"></i></a>';
      acts.querySelectorAll('a').forEach(a => a.addEventListener('click', ev => ev.stopPropagation()));
      phoneTd.appendChild(acts);
    }
    tr.addEventListener('click', () => openClientModal(c.id));
    return tr;
  }

  function linkWhatsApp(c){
    const cifre = L.cifreTelefon(c.telefon);
    return 'https://wa.me/' + cifre + '?text=' + encodeURIComponent(L.mesajWhatsApp(c, numeExpeditor()));
  }

  /* ---------- ACTIVITATE ---------- */
  function activityHtml(){
    const items = activity.slice().sort((a,b)=>(b.ts||'').localeCompare(a.ts||''));
    return (
      '<div style="margin-bottom:22px;"><div class="pagetitle">Activitate</div><div class="pagesub">jurnal de acțiuni</div></div>' +
      '<div class="card" style="padding:0;overflow:hidden;">' +
        '<div style="display:flex;flex-direction:column;">' +
          items.map(a => '<div style="padding:17px 22px;border-bottom:1px solid var(--line);font-size:13.5px;">'+esc(a.text)+'<div style="font-size:12px;color:var(--text3);margin-top:3px;">'+fmtDateTime(a.ts)+'</div></div>').join('') +
        '</div>' +
        (items.length===0 ? '<div style="text-align:center;padding:50px 20px;color:var(--text3);font-size:13px;">nicio activitate încă</div>' : '') +
      '</div>'
    );
  }

  /* ---------- SHARED FORM HELPERS ---------- */
  function field(label, id, val, type){
    return '<div style="margin-bottom:10px;"><div style="font-size:12px;color:var(--text2);margin-bottom:5px;">'+label+'</div>' +
      '<input id="'+id+'" type="'+(type||'text')+'" value="'+esc(val||'')+'" style="width:100%;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:9px 11px;border-radius:8px;font-size:13px;outline:none;"></div>';
  }
  function textareaField(label, id, val){
    return '<div style="margin-bottom:10px;"><div style="font-size:12px;color:var(--text2);margin-bottom:5px;">'+label+'</div>' +
      '<textarea id="'+id+'" rows="2" style="width:100%;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:9px 11px;border-radius:8px;font-size:13px;outline:none;resize:vertical;font-family:inherit;">'+esc(val||'')+'</textarea></div>';
  }
  function selectField(label, id, options, selected, withEmpty){
    const opts = options.map(o => '<option value="'+o+'"'+(o===selected?' selected':'')+'>'+o+'</option>').join('');
    return '<div style="margin-bottom:10px;"><div style="font-size:12px;color:var(--text2);margin-bottom:5px;">'+label+'</div>' +
      '<select id="'+id+'" style="width:100%;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:9px 11px;border-radius:8px;font-size:13px;outline:none;">' +
      (withEmpty?'<option value="">–</option>':'') + opts + '</select></div>';
  }
  function dimensionsField(label, c){
    return '<div style="margin-bottom:10px;"><div style="font-size:12px;color:var(--text2);margin-bottom:5px;">'+label+'</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<input id="f_latime" type="number" step="0.01" min="0" placeholder="Lățime (m)" value="'+esc(c&&c.latime!=null?c.latime:'')+'" style="flex:1;min-width:0;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:9px 10px;border-radius:8px;font-size:13px;outline:none;">' +
        '<input id="f_lungime" type="number" step="0.01" min="0" placeholder="Lungime (m)" value="'+esc(c&&c.lungime!=null?c.lungime:'')+'" style="flex:1;min-width:0;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:9px 10px;border-radius:8px;font-size:13px;outline:none;">' +
        '<input id="f_inaltime" type="number" step="0.01" min="0" placeholder="Înălțime (m)" value="'+esc(c&&c.inaltime!=null?c.inaltime:'')+'" style="flex:1;min-width:0;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:9px 10px;border-radius:8px;font-size:13px;outline:none;">' +
      '</div></div>';
  }

  /* ---------- CLIENT MODAL ---------- */
  let clientPrefill = null;
  let emailPanelOpen = false;
  let fisaDeschisa = null;

  function val(id){ const el = document.getElementById(id); return el ? String(el.value||'').trim() : ''; }

  function optionList(options, selected){
    const opts = options.slice();
    if(selected && !opts.includes(selected)) opts.push(selected);
    return '<option value="">–</option>' + opts.map(o => '<option value="'+esc(o)+'"'+(o===selected?' selected':'')+'>'+esc(o)+'</option>').join('');
  }
  function selectRow(label, id, options, selected){
    return '<div style="margin-bottom:10px;flex:1;min-width:150px;"><div style="font-size:12px;color:var(--text2);margin-bottom:5px;">'+label+'</div>' +
      '<select id="'+id+'" style="width:100%;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:9px 11px;border-radius:8px;font-size:13px;outline:none;">'+optionList(options, selected)+'</select></div>';
  }
  function inputRow(label, id, value, placeholder){
    return '<div style="margin-bottom:10px;flex:1;min-width:150px;"><div style="font-size:12px;color:var(--text2);margin-bottom:5px;">'+label+'</div>' +
      '<input id="'+id+'" type="text" value="'+esc(value===null||value===undefined?'':value)+'" placeholder="'+esc(placeholder||'')+'" style="width:100%;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:9px 11px;border-radius:8px;font-size:13px;outline:none;"></div>';
  }
  function sectionTitle(text){
    return '<div style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text3);margin:16px 0 8px;">'+text+'</div>';
  }
  function modalHeader(title){
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
      '<div style="font-size:15px;font-weight:500;">'+title+'</div>' +
      '<button id="closeModal" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:18px;">&times;</button>' +
    '</div>';
  }

  // Ce e acum în formular, pentru butoanele Sună / WhatsApp / mail.
  function formClientSnapshot(){
    const tel = L.normalizeazaTelefon(val('f_telefon'), val('f_tara') || 'RO');
    return { nume: val('f_nume'), telefon: tel.telefon, email: val('f_email'), tipSpatiu: val('f_tip'), suprafata: val('f_supr'), problema: val('f_problema') };
  }

  function copyRow(label, text, id){
    return '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);">' +
      '<div style="flex:1;min-width:0;"><div style="font-size:11px;color:var(--text3);">'+label+'</div>' +
      '<div style="font-size:12.5px;color:var(--text);white-space:pre-wrap;max-height:'+(id==='cpCorp'?'90px':'none')+';overflow:hidden;">'+esc(text)+'</div></div>' +
      '<button class="btn" id="'+id+'" style="padding:6px 10px;font-size:12px;flex-shrink:0;">copiază</button></div>';
  }

  function renderQuickActions(){
    const box = document.getElementById('quickActions');
    if(!box) return;
    const s = formClientSnapshot();
    const cifre = L.cifreTelefon(s.telefon);
    const e = L.mesajEmail(s);
    box.innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        (cifre ? '<a class="btn" href="tel:+'+cifre+'" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;"><i class="ti ti-phone" aria-hidden="true"></i>Sună</a>' : '') +
        (cifre ? '<a class="btn" href="'+esc(linkWhatsApp(s))+'" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;"><i class="ti ti-brand-whatsapp" aria-hidden="true"></i>WhatsApp</a>' : '') +
        (s.email ? '<button class="btn" id="qaEmail" style="display:inline-flex;align-items:center;gap:6px;"><i class="ti ti-mail" aria-hidden="true"></i>Mail de răspuns</button>' : '') +
      '</div>' +
      (s.email && emailPanelOpen
        ? '<div style="margin-top:10px;padding:4px 12px 10px;background:#faf9f6;border:1px solid var(--line);border-radius:8px;">' +
            '<div style="font-size:12px;color:var(--text2);margin:8px 0 2px;">În webmail: „Scrie un mesaj”, apoi copiezi de aici pe rând destinatarul, subiectul și textul.</div>' +
            copyRow('Către', s.email, 'cpCatre') + copyRow('Subiect', e.subiect, 'cpSubiect') + copyRow('Text', e.corp, 'cpCorp') +
          '</div>'
        : '');
    const btn = document.getElementById('qaEmail');
    if(btn) btn.onclick = () => { emailPanelOpen = !emailPanelOpen; renderQuickActions(); };
    const bind = (id, text, msg) => { const b = document.getElementById(id); if(b) b.onclick = () => copiaza(text, msg); };
    bind('cpCatre', s.email, 'Adresa e copiată.');
    bind('cpSubiect', e.subiect, 'Subiectul e copiat.');
    bind('cpCorp', e.corp, 'Textul e copiat. Lipește-l în mail (Cmd+V) și citește-l înainte de trimitere.');
  }

  function gasesteDublura(telefon, email, exceptId){
    const d = L.cifreTelefon(telefon);
    const em = String(email||'').trim().toLowerCase();
    return clients.find(x => x.id !== exceptId && (
      (d.length >= 8 && L.cifreTelefon(x.telefon) === d) ||
      (em && String(x.email||'').trim().toLowerCase() === em)
    ));
  }

  const ICON_ISTORIC = Object.fromEntries(E.TIPURI_ISTORIC.map(t => [t.key, t.icon]).concat([['formular','ti-forms']]));
  function renderIstoricBox(){
    const box = document.getElementById('istoricBox');
    const c = clients.find(x => x.id === fisaDeschisa);
    if(!box || !c) return;
    const lista = istoricClient(c.id);
    const rand = (icon, cand_, text, extra) => '<div style="display:flex;gap:10px;padding:9px 0;border-top:1px solid var(--line);">' +
      '<i class="ti '+icon+'" style="font-size:15px;color:var(--text3);margin-top:2px;" aria-hidden="true"></i>' +
      '<div style="flex:1;min-width:0;"><div style="font-size:11.5px;color:var(--text3);">'+cand_+extra+'</div>' +
      (text ? '<div style="font-size:13px;white-space:pre-wrap;">'+esc(text)+'</div>' : '') + '</div></div>';
    box.innerHTML =
      (istoricEroare ? '<div style="font-size:12px;color:var(--red);padding:6px 0;">Istoricul nu se poate citi încă (regulile din Firebase).</div>' : '') +
      lista.map(h => rand(ICON_ISTORIC[h.tip] || 'ti-note', esc(fmtDateTime(h.cand)),
        h.text, (h.etapaIn && h.etapaIn !== h.etapaDin ? ' · ' + etapaPill(h.etapaDin||'nou', true) + ' → ' + etapaPill(h.etapaIn, true) : ''))).join('') +
      (c.rezultat ? rand('ti-archive', 'din fișa veche', c.rezultat, '') : '') +
      (!lista.length && !c.rezultat ? '<div style="font-size:12.5px;color:var(--text3);padding:6px 0;">Nimic încă. Fiecare apel, mesaj sau notă apare aici, cu data lui.</div>' : '');
  }

  function openClientModal(id, prefill){
    editingClientId = id || null;
    clientPrefill = id ? null : (prefill || null);
    fisaDeschisa = id || null;
    emailPanelOpen = false;
    const c = id ? clients.find(x=>x.id===id) : (prefill || null);
    if(id && !c) return;
    const tara = (c && c.tara) || 'RO';
    const taraOpts = L.TARI.slice();
    if(tara && !taraOpts.some(t => t[0]===tara)) taraOpts.push([tara, tara, '']);
    const e = id ? E.etapaClient(c, deals) : 'nou';
    const p = id ? E.pasClient(c) : {ce:'', la:''};
    const detalii =
      field('Nume','f_nume', c?c.nume:'') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<div style="margin-bottom:10px;flex:0 0 150px;"><div style="font-size:12px;color:var(--text2);margin-bottom:5px;">Țara</div>' +
          '<select id="f_tara" style="width:100%;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:9px 11px;border-radius:8px;font-size:13px;outline:none;">' +
            taraOpts.map(([cod, nume, pr]) => '<option value="'+cod+'"'+(cod===tara?' selected':'')+'>'+esc(nume)+(pr?' (+'+pr+')':'')+'</option>').join('') +
          '</select></div>' +
        inputRow('Telefon','f_telefon', c?c.telefon:'', '0724 500 507') +
      '</div>' +
      field('Email','f_email', c?c.email:'') +
      field('Oraș sau adresă','f_adresa', c?c.adresa:'') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        selectRow('Sursă','f_sursa', SURSE, c?c.sursa:'') +
        inputRow('Formular sau reclamă','f_reclama', c?c.reclama:'', 'de exemplu: pagina de consultanță') +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        selectRow('Tip spațiu','f_tip', L.TIP_SPATIU, c?c.tipSpatiu:'') +
        selectRow('Suprafață','f_supr', L.SUPRAFATA, c?c.suprafata:'') +
      '</div>' +
      selectRow('Problema','f_problema', L.PROBLEMA, c?c.problema:'') +
      dimensionsField('Dimensiuni măsurate (dacă le știi)', c) +
      textareaField('Mesajul clientului (din formular)','f_mesaj', c?c.mesaj:'') +
      textareaField('Notițe (nevoia clientului)','f_nevoie', c?c.nevoie:'') +
      inputRow('Valoarea ofertei (lei)','f_valoare', c && id ? (E.valoareClient(c, deals) || '') : '', 'se completează la ofertă') +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:4px 0;">' +
        '<input id="f_important" type="checkbox" '+(c&&c.important?'checked':'')+' style="width:16px;height:16px;accent-color:#d9a53c;">' +
        '<label for="f_important" style="font-size:13px;color:var(--text2);cursor:pointer;">⭐ client important / potențial ridicat</label></div>';
    const m = document.getElementById('modal');
    m.innerHTML =
      modalHeader(id ? esc(c.nume) : (prefill ? 'Client nou, din mail' : 'Client nou')) +
      (id ? '<div style="font-size:12px;color:var(--text3);margin-bottom:12px;">venit '+esc(L.vechime(c.addedAt))+' ('+esc(fmtDateTime(c.addedAt))+')' + (c.sursa?' · '+esc(c.sursa):'') + (c.reclama?' · '+esc(c.reclama):'') + (E.inLucru(c)?'':' · <b>arhivă</b>') + '</div>'
          : (prefill ? '<div style="font-size:12px;color:var(--accent-dark);background:var(--accent-bg);padding:8px 10px;border-radius:8px;margin-bottom:12px;">Am completat fișa din mail. Verifică datele, apoi „salvează”.</div>' : '')) +
      (id ? ceACompletat(c) : '') +
      (id ?
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">' +
          E.ETAPE.map(x => '<button type="button" class="btn" data-etapa-fisa="'+x.key+'" style="padding:5px 10px;font-size:12px;'+(x.key===e?'background:'+x.fundal+';color:'+x.culoare+';border-color:'+x.culoare+';font-weight:600;':'')+'">'+esc(x.label)+'</button>').join('') +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#faf9f6;border:1px solid var(--line);border-radius:10px;padding:11px 14px;margin-bottom:12px;">' +
          '<div style="flex:1;min-width:180px;"><div style="font-size:11px;color:var(--text3);">PASUL URMĂTOR</div>' +
          '<div style="font-size:13.5px;font-weight:500;color:'+(p.la && new Date(p.la) < new Date() ? 'var(--red)' : 'var(--text)')+';">'+(p.la ? esc(p.ce||'pas')+' · '+esc(cand(p.la)) : (E.ACTIVE.includes(e) ? 'niciun pas programat' : 'client încheiat'))+'</div></div>' +
          '<button class="btn" id="fisaApel" style="padding:8px 12px;"><i class="ti ti-headset" aria-hidden="true"></i> Ghid pentru apel</button>' +
          '<button class="btn-primary" id="fisaGata" style="padding:8px 14px;">Gata</button>' +
        '</div>' + ceAmAflat(c) : '') +
      '<div id="quickActions" style="margin-bottom:14px;"></div>' +
      (id ?
        sectionTitle('Istoric') +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px;">' +
          '<select id="hTip" style="background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:8px 9px;border-radius:8px;font-size:12.5px;">'+E.TIPURI_ISTORIC.map(t => '<option value="'+t.key+'"'+(t.key==='nota'?' selected':'')+'>'+t.label+'</option>').join('')+'</select>' +
          '<input id="hText" placeholder="adaugă o notă sau ce s-a vorbit" style="flex:1;min-width:160px;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:8px 10px;border-radius:8px;font-size:12.5px;outline:none;">' +
          '<button class="btn" id="hAdd" style="padding:7px 12px;font-size:12.5px;">adaugă</button>' +
        '</div>' +
        '<div id="istoricBox" style="margin-bottom:10px;"></div>' +
        '<details id="detalii" style="margin-top:8px;"><summary style="cursor:pointer;font-size:12.5px;color:var(--text2);padding:8px 0;">Detalii: contact, spațiu, mesajul din formular</summary>' + detalii + '</details>'
        : detalii) +
      '<div id="formError" style="display:none;color:#a3372f;font-size:12px;margin-top:10px;"></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px;">' +
        (id && isAdmin()?'<button id="deleteBtn" style="background:none;border:none;color:var(--text3);font-size:12px;cursor:pointer;">șterge client</button>':'<span></span>') +
        '<div style="display:flex;gap:8px;"><button id="cancelBtn" class="btn">închide</button><button id="saveBtn" class="btn-primary">'+(id?'salvează detaliile':'salvează')+'</button></div>' +
      '</div>';
    document.getElementById('modalWrap').style.display = 'flex';
    m.scrollTop = 0;
    document.getElementById('closeModal').onclick = closeModal;
    document.getElementById('cancelBtn').onclick = closeModal;
    document.getElementById('saveBtn').onclick = saveClient;
    if(id && isAdmin()) document.getElementById('deleteBtn').onclick = () => deleteClient(id);
    if(id){
      document.getElementById('fisaGata').onclick = () => openGataModal(id);
      document.getElementById('fisaApel').onclick = () => openApelModal(id);
      m.querySelectorAll('[data-etapa-fisa]').forEach(b => b.addEventListener('click', () => openGataModal(id, b.dataset.etapaFisa)));
      document.getElementById('hAdd').onclick = adaugaInIstoric;
      document.getElementById('hText').addEventListener('keydown', ev => { if(ev.key === 'Enter') adaugaInIstoric(); });
      renderIstoricBox();
    }
    ['f_nume','f_telefon','f_email'].forEach(fid => document.getElementById(fid).addEventListener('input', renderQuickActions));
    ['f_tara','f_tip','f_supr','f_problema'].forEach(fid => document.getElementById(fid).addEventListener('change', renderQuickActions));
    renderQuickActions();
  }

  async function adaugaInIstoric(){
    const c = clients.find(x => x.id === fisaDeschisa);
    const text = val('hText'), tip = val('hTip') || 'nota';
    if(!c || !text) return;
    const acum = new Date().toISOString();
    try{
      await addDoc(istoricCol, { clientId: c.id, tip, text, cand: acum, cine: auth.currentUser.email });
      const upd = { updatedAt: acum };
      if(tip !== 'nota' && !c.primulContactLa){ upd.primulContactLa = acum; upd.contactat = true; }
      await updateDoc(doc(db,'clients',c.id), upd);
      document.getElementById('hText').value = '';
    }catch(err){ console.error(err); formError('Nu s-a salvat în istoric: ' + (err.code === 'permission-denied' ? 'regulile din Firebase nu permit încă istoricul.' : 'verifică internetul.')); }
  }

  function formError(msg){
    const errEl = document.getElementById('formError');
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }

  async function saveClient(){
    const nume = val('f_nume');
    const tara = val('f_tara') || 'RO';
    const telBrut = val('f_telefon');
    const email = val('f_email');
    if(!nume){ formError('completează numele'); return; }
    if(!telBrut && !email){ formError('completează telefonul sau emailul'); return; }
    let telefon = '';
    if(telBrut){
      const t = L.normalizeazaTelefon(telBrut, tara);
      if(!t.ok){ formError('numărul de telefon nu pare complet: ' + (t.telefon || telBrut)); return; }
      telefon = t.telefon;
    }
    document.getElementById('formError').style.display = 'none';
    const num = id => document.getElementById(id).value === '' ? null : parseFloat(document.getElementById(id).value);
    const valoare = parseFloat(val('f_valoare').replace(/\s/g,'').replace(',', '.'));
    const data = {
      nume, telefon, tara, email,
      adresa: val('f_adresa'),
      sursa: val('f_sursa'),
      reclama: val('f_reclama'),
      tipSpatiu: val('f_tip'),
      suprafata: val('f_supr'),
      problema: val('f_problema'),
      mesaj: val('f_mesaj'),
      latime: num('f_latime'),
      lungime: num('f_lungime'),
      inaltime: num('f_inaltime'),
      nevoie: val('f_nevoie'),
      important: document.getElementById('f_important').checked,
      updatedAt: new Date().toISOString()
    };
    if(!isNaN(valoare)) data.valoare = valoare;
    const saveBtn = document.getElementById('saveBtn');
    try{
      if(editingClientId){
        saveBtn.disabled = true;
        await updateDoc(doc(db,'clients',editingClientId), data);
        logActivity('Client actualizat: '+nume);
        toast('Detaliile sunt salvate.');
        saveBtn.disabled = false;
      } else {
        const dup = gasesteDublura(telefon, email, null);
        if(dup && !confirm('Există deja un client cu același telefon sau email: '+dup.nume+' (adăugat pe '+fmtDate(dup.addedAt)+').\n\nÎl adaug totuși ca client nou?')) return;
        saveBtn.disabled = true;
        const acum = new Date().toISOString();
        Object.assign(data, { etapa: 'nou', etapaLa: acum, etapaMax: 0, contactat: false, notInterested: false, rezultat: '',
          pasUrmator: '', pasLa: '', nextCallAt: '', nextCallReason: '',
          addedAt: (clientPrefill && clientPrefill.addedAt) || acum });
        await addDoc(clientsCol, data);
        logActivity('Client nou adăugat: '+nume + (clientPrefill ? ' (din mail)' : ''));
        closeModal();
      }
    }catch(err){
      console.error(err);
      saveBtn.disabled = false;
      formError('Nu s-a salvat: ' + (err && err.code === 'permission-denied' ? 'contul tău nu are voie să scrie în CRM.' : 'verifică internetul și încearcă din nou.'));
    }
  }

  /* ---------- CLIENT NOU DIN MAIL ---------- */
  function openPasteModal(){
    const m = document.getElementById('modal');
    m.innerHTML =
      modalHeader('Client nou din mail') +
      '<div style="font-size:13px;color:var(--text2);margin-bottom:10px;line-height:1.5;">Deschide în webmail mailul „Mesaj nou de la client”, selectează cu mouse-ul tot textul din chenarul alb, copiază-l (Cmd+C) și lipește-l aici (Cmd+V).</div>' +
      '<textarea id="f_mail" rows="11" placeholder="Cod țară: RO&#10;Name: ...&#10;Email: ...&#10;Phone: ..." style="width:100%;background:#fff;border:1px solid var(--line-strong);color:var(--text);padding:10px 11px;border-radius:8px;font-size:12.5px;outline:none;resize:vertical;font-family:inherit;"></textarea>' +
      '<div id="formError" style="display:none;color:#a3372f;font-size:12px;margin-top:8px;"></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;"><button id="cancelBtn" class="btn">anulează</button><button id="parseBtn" class="btn-primary">completează fișa</button></div>';
    document.getElementById('modalWrap').style.display = 'flex';
    document.getElementById('closeModal').onclick = closeModal;
    document.getElementById('cancelBtn').onclick = closeModal;
    const ta = document.getElementById('f_mail');
    ta.focus();
    document.getElementById('parseBtn').onclick = () => {
      const r = L.citesteMail(ta.value);
      if(!r.nume && !r.email && !r.telefonBrut){
        formError('Nu am găsit în text numele, emailul sau telefonul. Copiază tot mailul, cu rândurile „Name”, „Email” și „Phone”.');
        return;
      }
      const tara = r.tara || 'RO';
      const tel = r.telefonBrut ? L.normalizeazaTelefon(r.telefonBrut, tara) : { telefon:'', ok:false };
      openClientModal(null, {
        nume: r.nume, email: r.email, tara,
        telefon: tel.ok ? tel.telefon : r.telefonBrut,
        tipSpatiu: r.tipSpatiu, suprafata: r.suprafata, problema: r.problema,
        mesaj: [r.subiect ? 'Subiect: ' + r.subiect : '', r.mesaj].filter(Boolean).join('\n'),
        sursa: 'Site (formular)', reclama: r.formular
      });
    };
  }

  async function deleteClient(id){
    if(!isAdmin()) return;
    const c = clients.find(x=>x.id===id);
    if(!confirm('Ștergi definitiv clientul "'+(c?c.nume:'')+'"? Nu poate fi recuperat.')) return;
    await deleteDoc(doc(db,'clients',id));
    if(c) logActivity('Client șters: '+c.nume);
    closeModal();
  }

  function closeModal(){
    document.getElementById('modalWrap').style.display = 'none';
    editingClientId = null; editingEventId = null; calSelectedDate = null; clientPrefill = null; emailPanelOpen = false; fisaDeschisa = null; gata = null;
  }

  document.getElementById('topSearch').addEventListener('keydown', (e) => {
    if(e.key==='Enter'){
      filtre.q = document.getElementById('topSearch').value;
      filtre.lucru = 'toti';
      currentView='clienti'; renderNav(); renderPage();
    }
  });

  window.addEventListener('beforeunload', destroyCharts);
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW register failed', err));
  });
}
