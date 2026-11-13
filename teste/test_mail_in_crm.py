"""Teste pentru sincronizare/mail_in_crm.py. Rulare: python3 -m unittest discover -s teste
Datele sunt inventate (repo-ul e public)."""
import email
import os
import re
import sys
import unittest
from email.message import EmailMessage

AICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AICI, '..', 'sincronizare'))
import mail_in_crm as m  # noqa: E402

HTML_SHOPIFY = """<html><body><table><tr><td>
<p>Ați primit un mesaj nou din formularul de contact al magazinului dumneavoastră online.</p><hr>
<p><b>Cod țară:</b><br>RO</p>
<p><b>Name:</b><br>Ion Test</p>
<p><b>Email:</b><br><a href="mailto:ion.test@example.com">ion.test@example.com</a></p>
<p><b>Phone:</b><br>0712 345 678</p>
<p><b>Ce Tip De Spatiu Vrei Sa Tratezi?*:</b><br>Restaurant sau spatiu comercial</p>
<p><b>Care Sunt Dimensiunile Aproximative Ale Camerei?*:</b><br>Peste 40 mp</p>
<p><b>Ce Problema Observi Cel Mai Mult?*:</b><br>Ecou puternic</p>
</td></tr></table></body></html>"""


def mail(html_corp=HTML_SHOPIFY, subiect='Mesaj nou de la client pe 13 noiembrie 2026, 09:14',
         expeditor='Beze Acoustics (Shopify) <mailer@shopify.com>', reply_to='ion.test@example.com',
         mid='<test-1@shopify.com>'):
    msg = EmailMessage()
    msg['Subject'] = subiect
    msg['From'] = expeditor
    msg['To'] = 'contact@bezeacoustics.ro'
    msg['Reply-To'] = reply_to
    msg['Date'] = 'Fri, 13 Nov 2026 09:14:00 +0200'
    msg['Message-ID'] = mid
    msg.set_content('Versiunea text a mailului.')
    msg.add_alternative(html_corp, subtype='html')
    return email.message_from_bytes(msg.as_bytes())


class CitireText(unittest.TestCase):
    def test_pagina_de_consultanta(self):
        r = m.citeste_text('Cod țară:\nRO\nName:\nIon Test\nEmail:\nion.test@example.com\nPhone:\n0712 345 678\n'
                           'Ce Tip De Spatiu Vrei Sa Tratezi?*:\nRestaurant sau spatiu comercial\n'
                           'Care Sunt Dimensiunile Aproximative Ale Camerei?*:\nPeste 40 mp\n'
                           'Ce Problema Observi Cel Mai Mult?*:\nEcou puternic\n')
        self.assertEqual(r['nume'], 'Ion Test')
        self.assertEqual(r['tara'], 'RO')
        self.assertEqual(r['tipSpatiu'], 'Restaurant sau spațiu comercial')
        self.assertEqual(r['suprafata'], 'Peste 40 mp')
        self.assertEqual(r['problema'], 'Ecou puternic')
        self.assertEqual(r['formular'], 'pagina de consultanță')

    def test_pagina_contact(self):
        r = m.citeste_text('Nume:\nMaria Test\nEmail:\nmaria@example.com\nTelefon:\n+40 799 000 111\n'
                           'Subiect:\nConsultanta\nMesaj:\nBună ziua,\nam o cameră de 3 x 4 m.')
        self.assertEqual(r['subiect'], 'Consultanta')
        self.assertEqual(r['mesaj'], 'Bună ziua,\nam o cameră de 3 x 4 m.')
        self.assertEqual(r['formular'], 'pagina Contact')

    def test_fara_etichete(self):
        self.assertEqual(m.citeste_text('salut')['nume'], '')


class Telefon(unittest.TestCase):
    def test_ro(self):
        for t in ['0712 345 678', '0712345678', '712345678', '+40712345678', '0040712345678', '40712345678']:
            r = m.normalizeaza_telefon(t, 'RO')
            self.assertEqual(r['telefon'], '+40 712 345 678', t)
            self.assertTrue(r['ok'], t)
        self.assertFalse(m.normalizeaza_telefon('0712 345', 'RO')['ok'])

    def test_alte_tari(self):
        self.assertEqual(m.normalizeaza_telefon('01761234567', 'DE')['telefon'], '+49 1761234567')
        self.assertEqual(m.normalizeaza_telefon('+373 69 123 456', 'RO')['telefon'], '+373 69123456')


class AceleasiListeCaInCRM(unittest.TestCase):
    def test_listele_din_lead_js(self):
        with open(os.path.join(AICI, '..', 'lead.js'), encoding='utf-8') as f:
            js = f.read()
        for nume, lista in [('TIP_SPATIU', m.TIP_SPATIU), ('SUPRAFATA', m.SUPRAFATA), ('PROBLEMA', m.PROBLEMA)]:
            bloc = re.search(r'export const %s = \[(.*?)\];' % nume, js, re.S).group(1)
            self.assertEqual(re.findall(r"'([^']*)'", bloc), lista, nume)
        bloc = re.search(r'export const TARI = \[(.*?)\];', js, re.S).group(1)
        din_js = {cod: p for cod, _, p in re.findall(r"\['(\w\w)', '([^']*)', '(\d+)'\]", bloc)}
        self.assertEqual(din_js, m.PREFIX)


class Mailul(unittest.TestCase):
    def test_mail_shopify_devine_client(self):
        msg = mail()
        self.assertTrue(m.e_mail_de_formular(msg))
        c = m.client_din_mail(msg)
        self.assertEqual(c['nume'], 'Ion Test')
        self.assertEqual(c['email'], 'ion.test@example.com')
        self.assertEqual(c['telefon'], '+40 712 345 678')
        self.assertEqual(c['tipSpatiu'], 'Restaurant sau spațiu comercial')
        self.assertEqual(c['problema'], 'Ecou puternic')
        self.assertEqual(c['sursa'], 'Site (formular)')
        self.assertEqual(c['addedAt'], '2026-11-13T07:14:00.000Z')
        self.assertTrue(c['dinMail'])
        self.assertEqual(sorted(c.keys()), sorted(m.CAMPURI_CLIENT))

    def test_alte_mailuri_nu_intra(self):
        self.assertFalse(m.e_mail_de_formular(mail(subiect='Comandă nouă #1001')))
        self.assertFalse(m.e_mail_de_formular(mail(expeditor='Cineva <x@example.com>')))

    def test_emailul_din_raspunde_la(self):
        fara_email = HTML_SHOPIFY.replace('<p><b>Email:</b><br><a href="mailto:ion.test@example.com">ion.test@example.com</a></p>', '')
        c = m.client_din_mail(mail(html_corp=fara_email, reply_to='alt@example.com'))
        self.assertEqual(c['email'], 'alt@example.com')

    def test_id_stabil(self):
        self.assertEqual(m.id_document('<a@b>'), m.id_document('<a@b>'))
        self.assertNotEqual(m.id_document('<a@b>'), m.id_document('<c@d>'))
        self.assertTrue(m.id_document('<a@b>').startswith('mail-'))

    def test_valori_firestore(self):
        self.assertEqual(m.valoare_firestore(None), {'nullValue': None})
        self.assertEqual(m.valoare_firestore(False), {'booleanValue': False})
        self.assertEqual(m.valoare_firestore('x'), {'stringValue': 'x'})


if __name__ == '__main__':
    unittest.main()
