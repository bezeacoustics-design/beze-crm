#!/usr/bin/env python3
"""Aduce în CRM clienții din mailurile „Mesaj nou de la client” trimise de Shopify pe contact@bezeacoustics.ro.

Căsuța se deschide doar pentru citire (EXAMINE și BODY.PEEK): mailurile nu se marchează ca citite,
nu se mută și nu se șterg. În CRM scrie contul „robot”, care are voie doar să adauge clienți și rânduri
în jurnal (regulile Firestore), nu să citească sau să modifice ceva.

Folosire:
  mail_in_crm.py --proba            arată ce ar aduce, fără să scrie nimic (numele apar doar cu inițiale)
  mail_in_crm.py                    aduce clienții noi; așa îl pornește macOS la câteva minute
  mail_in_crm.py --creeaza-robot    o singură dată: face contul robotului și îi pune parola în Keychain
Opțiuni:
  --de-la AAAA-LL-ZZ                de la ce dată se uită (implicit 2026-11-01, hotărârea lui Beia)
  --backup FIȘIER.json              backup exportat din CRM: sare peste clienții care există deja

Doar biblioteca standard Python (fără pachete instalate). Merge pe Python 3.9 sau mai nou.
"""
import argparse
import datetime as dt
import email
import email.header
import email.utils
import hashlib
import html
import imaplib
import json
import os
import re
import secrets
import ssl
import subprocess
import sys
import unicodedata
import urllib.error
import urllib.request

IMAP_HOST = 'mail.bezeacoustics.ro'
IMAP_USER = 'contact@bezeacoustics.ro'
DOSARE = ['INBOX', 'INBOX.Archive', 'Archive']        # cele care nu există se sar
KEYCHAIN_IMAP = 'beze-crm-imap'
KEYCHAIN_ROBOT = 'beze-crm-robot'
ROBOT_EMAIL = 'crm-robot@bezeacoustics.ro'
API_KEY = 'AIzaSyDU_QIv1zVKAbhlNDnWeg6ZaDTGvVaHuCs'   # cheia publică a aplicației web, aceeași ca în app.js
PROIECT = 'beze-intern'
DE_LA_IMPLICIT = '2026-11-01'
SUBIECT = 'Mesaj nou de la client'
DOSAR_STARE = os.path.expanduser('~/Library/Application Support/BEZE CRM')
FISIER_STARE = os.path.join(DOSAR_STARE, 'mail-in-crm.json')

# Aceleași liste ca în lead.js (testul verifică să nu se despartă).
TIP_SPATIU = ['Studio sau home studio', 'Cameră pentru podcast', 'Cameră pentru gaming sau streaming', 'Birou',
              'Restaurant sau spațiu comercial', 'Sală de repetiții', 'Home cinema', 'Alt tip de spațiu']
SUPRAFATA = ['Sub 10 mp', '10–20 mp', '21–40 mp', 'Peste 40 mp', 'Nu știu exact']
PROBLEMA = ['Ecou puternic', 'Voce neclară', 'Bas necontrolat', 'Mixurile sună diferit în alte locuri',
            'Nu știu ce tratament îmi trebuie', 'Izolare (zgomot de la sau către vecini)']
PREFIX = {'RO': '40', 'MD': '373', 'HU': '36', 'BG': '359', 'RS': '381', 'UA': '380', 'DE': '49', 'AT': '43',
          'IT': '39', 'ES': '34', 'FR': '33', 'GB': '44', 'IE': '353', 'NL': '31', 'BE': '32', 'CH': '41',
          'PL': '48', 'CZ': '420', 'GR': '30', 'PT': '351', 'SE': '46', 'DK': '45', 'NO': '47', 'US': '1', 'CA': '1'}

CAMPURI_CLIENT = ['nume', 'telefon', 'tara', 'email', 'adresa', 'sursa', 'reclama', 'tipSpatiu', 'suprafata',
                  'problema', 'mesaj', 'latime', 'lungime', 'inaltime', 'nevoie', 'rezultat', 'contactat',
                  'important', 'notInterested', 'nextCallReason', 'nextCallAt', 'addedAt', 'updatedAt',
                  'dinMail', 'mailId']


# ---------- citirea textului (același algoritm ca citesteMail din lead.js) ----------

def norm(s):
    s = unicodedata.normalize('NFD', str(s or ''))
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub('[‐-―]', '-', s).lower()
    return re.sub(r'\s+', ' ', s).strip()


def canonic(valoare, lista):
    n = norm(valoare)
    if not n:
        return ''
    for x in lista:
        if norm(x) == n:
            return x
    return str(valoare).strip()


def _pliaza(s):
    out = []
    for c in s:
        f = unicodedata.normalize('NFD', c)[0].lower()[:1] or c
        out.append('-' if '‐' <= f <= '―' else f)
    return ''.join(out)


ETICHETE = [
    ('tara', re.compile(r'cod tara\s*:')),
    ('tipSpatiu', re.compile(r'ce tip de spatiu[^:\n]{0,40}:')),
    ('suprafata', re.compile(r'care sunt dimensiunile[^:\n]{0,60}:')),
    ('problema', re.compile(r'ce problema observi[^:\n]{0,40}:')),
    ('nume', re.compile(r'(?:^|\n)[ \t]*(?:name|nume)[ \t]*:')),
    ('email', re.compile(r'(?:^|\n)[ \t]*e-?mail[ \t]*:')),
    ('telefon', re.compile(r'(?:^|\n)[ \t]*(?:phone|telefon)[ \t]*:')),
    ('subiect', re.compile(r'(?:^|\n)[ \t]*subiect[ \t]*:')),
    ('mesaj', re.compile(r'(?:^|\n)[ \t]*(?:mesaj|message|body)[ \t]*:')),
]


def citeste_text(text):
    t = re.sub(r'\r\n?', '\n', str(text or ''))
    p = _pliaza(t)
    gasite = []
    for camp, re_ in ETICHETE:
        m = re_.search(p)
        if m:
            gasite.append((m.start(), m.end(), camp))
    gasite.sort()
    brut = {}
    for i, (start, end, camp) in enumerate(gasite):
        urm = gasite[i + 1][0] if i + 1 < len(gasite) else len(t)
        brut[camp] = re.sub(r'\n{3,}', '\n\n', t[end:urm]).strip()
    prim = lambda k: (brut.get(k) or '').split('\n')[0].strip()
    if brut.get('tipSpatiu') or brut.get('suprafata') or brut.get('problema'):
        formular = 'pagina de consultanță'
    elif brut.get('subiect'):
        formular = 'pagina Contact'
    elif brut.get('nume') or brut.get('email'):
        formular = 'formularul scurt'
    else:
        formular = ''
    em = (brut.get('email') or '').split()
    return {
        'nume': prim('nume'),
        'email': em[0] if em else '',
        'telefonBrut': prim('telefon'),
        'tara': prim('tara').upper()[:2],
        'tipSpatiu': canonic(prim('tipSpatiu'), TIP_SPATIU),
        'suprafata': canonic(prim('suprafata'), SUPRAFATA),
        'problema': canonic(prim('problema'), PROBLEMA),
        'subiect': prim('subiect'),
        'mesaj': brut.get('mesaj') or '',
        'formular': formular,
    }


def normalizeaza_telefon(brut, tara='RO'):
    t = str(brut or '').strip()
    d = re.sub(r'\D', '', t)
    if not d:
        return {'telefon': '', 'cifre': '', 'ok': False}
    cod = (tara or 'RO').upper()
    if t.startswith('+'):
        intl = d
    elif d.startswith('00'):
        intl = d[2:]
    elif cod == 'RO':
        if d.startswith('40') and len(d) == 11:
            intl = d
        elif d.startswith('0') and len(d) == 10:
            intl = '40' + d[1:]
        elif len(d) == 9:
            intl = '40' + d
        else:
            intl = '40' + re.sub(r'^0', '', d)
    else:
        p = PREFIX.get(cod, '')
        intl = d if (p and d.startswith(p) and len(d) > len(p) + 6) else p + re.sub(r'^0', '', d)
    if intl.startswith('40'):
        r = intl[2:]
        grupe = [x for x in (r[0:3], r[3:6], r[6:]) if x]
        return {'telefon': '+40 ' + ' '.join(grupe), 'cifre': intl, 'ok': len(r) == 9}
    p = next((x for x in sorted(set(PREFIX.values()), key=len, reverse=True) if intl.startswith(x)), '')
    return {'telefon': '+' + (p + ' ' + intl[len(p):] if p else intl), 'cifre': intl, 'ok': 8 <= len(intl) <= 15}


# ---------- mailul ----------

def decodeaza_antet(v):
    if not v:
        return ''
    parti = []
    for bucata, cod in email.header.decode_header(v):
        if isinstance(bucata, bytes):
            parti.append(bucata.decode(cod or 'utf-8', errors='replace'))
        else:
            parti.append(bucata)
    return ''.join(parti)


def html_in_text(h):
    h = re.sub(r'(?is)<(script|style|head)[^>]*>.*?</\1>', '', h)
    h = re.sub(r'(?i)<br\s*/?>', '\n', h)
    h = re.sub(r'(?i)</(p|div|tr|li|h[1-6]|table|td|th)>', '\n', h)
    h = re.sub(r'<[^>]+>', '', h)
    h = html.unescape(h).replace('\xa0', ' ')
    linii = [re.sub(r'[ \t]+', ' ', x).strip() for x in h.split('\n')]
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(linii)).strip()


def textul_mailului(msg):
    plain, htm = None, None
    for part in msg.walk():
        if part.get_content_maintype() == 'multipart' or part.get_filename():
            continue
        tip = part.get_content_type()
        try:
            corp = part.get_payload(decode=True)
            if corp is None:
                continue
            text = corp.decode(part.get_content_charset() or 'utf-8', errors='replace')
        except (LookupError, AttributeError):
            continue
        if tip == 'text/plain' and plain is None:
            plain = text
        elif tip == 'text/html' and htm is None:
            htm = text
    # Formularul se citește mai sigur din HTML (etichetele pe rânduri separate); textul simplu e rezerva.
    if htm:
        t = html_in_text(htm)
        if citeste_text(t)['nume'] or citeste_text(t)['email']:
            return t
    return plain or (html_in_text(htm) if htm else '')


def e_mail_de_formular(msg):
    subiect = decodeaza_antet(msg.get('Subject'))
    expeditor = decodeaza_antet(msg.get('From')).lower()
    return subiect.strip().startswith(SUBIECT) and 'shopify' in expeditor


def client_din_mail(msg, acum=None):
    """Fișa clientului (câmpurile din CRM) dintr-un mail de formular; None dacă nu are nume sau contact."""
    acum = acum or dt.datetime.now(dt.timezone.utc)
    r = citeste_text(textul_mailului(msg))
    raspunde_la = email.utils.parseaddr(decodeaza_antet(msg.get('Reply-To')))[1]
    em = r['email'] or raspunde_la
    if not (r['nume'] or em or r['telefonBrut']):
        return None
    tara = r['tara'] or 'RO'
    tel = normalizeaza_telefon(r['telefonBrut'], tara) if r['telefonBrut'] else {'telefon': '', 'ok': False}
    try:
        data = email.utils.parsedate_to_datetime(msg.get('Date')).astimezone(dt.timezone.utc)
    except (TypeError, ValueError):
        data = acum
    mesaj = '\n'.join(x for x in ['Subiect: ' + r['subiect'] if r['subiect'] else '', r['mesaj']] if x)
    return {
        'nume': r['nume'] or em or 'Client din formular',
        'telefon': tel['telefon'] if tel['ok'] else r['telefonBrut'],
        'tara': tara, 'email': em, 'adresa': '',
        'sursa': 'Site (formular)', 'reclama': r['formular'],
        'tipSpatiu': r['tipSpatiu'], 'suprafata': r['suprafata'], 'problema': r['problema'],
        'mesaj': mesaj, 'latime': None, 'lungime': None, 'inaltime': None,
        'nevoie': '', 'rezultat': '', 'contactat': False, 'important': False, 'notInterested': False,
        'nextCallReason': '', 'nextCallAt': '',
        'addedAt': iso(data), 'updatedAt': iso(acum),
        'dinMail': True, 'mailId': (msg.get('Message-ID') or '').strip(),
    }


def iso(d):
    return d.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.') + '%03dZ' % (d.microsecond // 1000)


def id_document(message_id, rezerva=''):
    baza = message_id or rezerva
    return 'mail-' + hashlib.sha1(baza.encode('utf-8')).hexdigest()[:20]


def cheie_client(c):
    d = re.sub(r'\D', '', c.get('telefon') or '')
    return (d if len(d) >= 8 else ''), (c.get('email') or '').strip().lower()


# ---------- Keychain, Firebase ----------

def din_keychain(serviciu, cont):
    r = subprocess.run(['security', 'find-generic-password', '-s', serviciu, '-a', cont, '-w'],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit('Lipsește din Keychain: %s (%s).' % (serviciu, cont))
    return r.stdout.rstrip('\n')


def cerere(url, corp=None, token=None, metoda=None):
    date = json.dumps(corp).encode('utf-8') if corp is not None else None
    req = urllib.request.Request(url, data=date, method=metoda or ('POST' if date else 'GET'))
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode('utf-8') or '{}')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode('utf-8') or '{}')
        except ValueError:
            return e.code, {}


def autentificare_robot():
    parola = din_keychain(KEYCHAIN_ROBOT, ROBOT_EMAIL)
    cod, r = cerere('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY,
                    {'email': ROBOT_EMAIL, 'password': parola, 'returnSecureToken': True})
    if cod != 200:
        raise SystemExit('Robotul nu a putut intra în Firebase (%s): %s' % (cod, r.get('error', {}).get('message')))
    return r['idToken'], r['localId']


def creeaza_robot():
    r0 = subprocess.run(['security', 'find-generic-password', '-s', KEYCHAIN_ROBOT, '-a', ROBOT_EMAIL],
                        capture_output=True)
    if r0.returncode == 0:
        _, uid = autentificare_robot()
        print('Robotul există deja. UID:', uid)
        return
    parola = secrets.token_urlsafe(32)
    cod, r = cerere('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + API_KEY,
                    {'email': ROBOT_EMAIL, 'password': parola, 'returnSecureToken': True})
    if cod != 200:
        raise SystemExit('Contul robotului nu s-a putut face (%s): %s' % (cod, r.get('error', {}).get('message')))
    subprocess.run(['security', 'add-generic-password', '-s', KEYCHAIN_ROBOT, '-a', ROBOT_EMAIL, '-w', parola, '-U'],
                   check=True)
    print('Robotul e făcut, parola e în Keychain. UID:', r['localId'])


def valoare_firestore(v):
    if v is None:
        return {'nullValue': None}
    if isinstance(v, bool):
        return {'booleanValue': v}
    if isinstance(v, (int, float)):
        return {'doubleValue': float(v)}
    return {'stringValue': str(v)}


def scrie_client(token, doc_id, c):
    url = ('https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/clients?documentId=%s'
           % (PROIECT, doc_id))
    return cerere(url, {'fields': {k: valoare_firestore(c[k]) for k in CAMPURI_CLIENT}}, token)


def scrie_jurnal(token, text):
    url = 'https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/activity' % PROIECT
    acum = iso(dt.datetime.now(dt.timezone.utc))
    return cerere(url, {'fields': {'ts': {'stringValue': acum}, 'text': {'stringValue': text}}}, token)


def notificare(titlu, text):
    scrie = lambda s: s.replace('\\', '\\\\').replace('"', '\\"')
    subprocess.run(['osascript', '-e', 'display notification "%s" with title "%s" sound name "Glass"'
                    % (scrie(text), scrie(titlu))], capture_output=True)


# ---------- starea locală ----------

def citeste_stare():
    try:
        with open(FISIER_STARE, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {'importate': {}, 'sarite': {}}


def salveaza_stare(stare):
    os.makedirs(DOSAR_STARE, exist_ok=True)
    tmp = FISIER_STARE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(stare, f, ensure_ascii=False, indent=1)
    os.replace(tmp, FISIER_STARE)


def chei_din_backup(cale):
    with open(cale, encoding='utf-8') as f:
        d = json.load(f)
    tel, em = set(), set()
    for c in d.get('clients', []):
        t, e = cheie_client(c)
        if t:
            tel.add(t)
        if e:
            em.add(e)
    return tel, em


# ---------- rularea ----------

def mailuri_de_formular(de_la):
    parola = din_keychain(KEYCHAIN_IMAP, IMAP_USER)
    M = imaplib.IMAP4_SSL(IMAP_HOST, 993, ssl_context=ssl.create_default_context(), timeout=60)
    try:
        M.login(IMAP_USER, parola)
        typ, lista = M.list()
        existente = set()
        for linie in lista or []:
            m = re.search(rb'"([^"]+)"\s*$|\s(\S+)$', linie)
            if m:
                existente.add((m.group(1) or m.group(2)).decode('utf-8', 'replace'))
        for dosar in DOSARE:
            if dosar not in existente:
                continue
            typ, _ = M.select('"%s"' % dosar, readonly=True)
            if typ != 'OK':
                continue
            data_imap = de_la.strftime('%d-%b-%Y')
            typ, nr = M.search(None, 'SINCE', data_imap, 'SUBJECT', '"%s"' % SUBIECT)
            for n in (nr[0].split() if nr and nr[0] else []):
                typ, d = M.fetch(n, '(BODY.PEEK[])')
                if typ != 'OK' or not d or not isinstance(d[0], tuple):
                    continue
                yield dosar, email.message_from_bytes(d[0][1])
    finally:
        try:
            M.logout()
        except Exception:
            pass


def initiale(nume):
    return ' '.join(p[:1] + '.' for p in (nume or '').split()) or '?'


def ruleaza(args):
    de_la = dt.datetime.strptime(args.de_la, '%Y-%m-%d')
    stare = citeste_stare()
    tel_vechi, em_vechi = chei_din_backup(args.backup) if args.backup else (set(), set())
    for v in stare['importate'].values():
        if v.get('telefon'):
            tel_vechi.add(v['telefon'])
        if v.get('email'):
            em_vechi.add(v['email'])
    token = None if args.proba else autentificare_robot()[0]
    noi, sarite, erori = [], 0, 0
    acum = dt.datetime.now(dt.timezone.utc)
    for dosar, msg in mailuri_de_formular(de_la):
        if not e_mail_de_formular(msg):
            continue
        mid = (msg.get('Message-ID') or '').strip()
        cheie_mail = mid or (decodeaza_antet(msg.get('Subject')) + (msg.get('Date') or ''))
        if cheie_mail in stare['importate'] or cheie_mail in stare['sarite']:
            continue
        c = client_din_mail(msg, acum)
        if c is None:
            stare['sarite'][cheie_mail] = 'fără nume și fără contact'
            sarite += 1
            continue
        t, e = cheie_client(c)
        if (t and t in tel_vechi) or (e and e in em_vechi):
            if not args.proba:
                stare['sarite'][cheie_mail] = 'există deja în CRM'
            sarite += 1
            if args.proba:
                print('  sare  %-9s %s  %s (există deja)' % (dosar[:9], c['addedAt'][:16], initiale(c['nume'])))
            continue
        doc_id = id_document(mid, cheie_mail)
        if args.proba:
            print('  nou   %-9s %s  %-10s tel:%s email:%s | %s | %s | %s | %s' % (
                dosar[:9], c['addedAt'][:16], initiale(c['nume']), 'da' if t else 'nu', 'da' if e else 'nu',
                c['tipSpatiu'] or '-', c['suprafata'] or '-', c['problema'] or '-', c['reclama'] or '-'))
            noi.append(c)
            if t:
                tel_vechi.add(t)
            if e:
                em_vechi.add(e)
            continue
        cod, r = scrie_client(token, doc_id, c)
        if cod == 200 or cod == 409:
            stare['importate'][cheie_mail] = {'doc': doc_id, 'cand': iso(acum), 'telefon': t, 'email': e}
            if t:
                tel_vechi.add(t)
            if e:
                em_vechi.add(e)
            if cod == 200:
                noi.append(c)
                scrie_jurnal(token, 'Client nou din mail: ' + c['nume'])
        else:
            erori += 1
            print('Eroare la scriere (%s): %s' % (cod, r.get('error', {}).get('message')), file=sys.stderr)
    if not args.proba:
        stare['ultima_rulare'] = iso(acum)
        salveaza_stare(stare)
        proaspete = [c for c in noi if (acum - dt.datetime.fromisoformat(c['addedAt'].replace('Z', '+00:00'))).total_seconds() < 86400]
        if len(proaspete) == 1:
            c = proaspete[0]
            notificare('BEZE CRM: client nou', '%s · %s' % (c['nume'], ' · '.join(x for x in [c['tipSpatiu'], c['problema']] if x)))
        elif len(proaspete) > 1:
            notificare('BEZE CRM', '%d clienți noi din formularul de pe site' % len(proaspete))
    print('%s  %s: %d noi, %d sărite, %d erori' % (iso(acum)[:19], 'PROBĂ' if args.proba else 'gata', len(noi), sarite, erori))
    return 1 if erori else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description='Clienții din mailurile Shopify, în BEZE CRM.')
    ap.add_argument('--proba', action='store_true', help='nu scrie nimic, doar arată')
    ap.add_argument('--creeaza-robot', action='store_true')
    ap.add_argument('--de-la', default=DE_LA_IMPLICIT)
    ap.add_argument('--backup', help='backup JSON exportat din CRM, pentru clienții care există deja')
    args = ap.parse_args(argv)
    if args.creeaza_robot:
        creeaza_robot()
        return 0
    return ruleaza(args)


if __name__ == '__main__':
    sys.exit(main())
