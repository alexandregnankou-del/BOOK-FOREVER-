"""
Fabrique le PDF du roman AMOUR PERDU à partir des fichiers de content/amour-perdu.

    python3 scripts/build-pdf.py

Sortie : public/download/amour-perdu.pdf
"""
import pathlib
import re
from xml.sax.saxutils import escape

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, NextPageTemplate, PageBreak,
    PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'content' / 'amour-perdu'
OUT = ROOT / 'public' / 'download' / 'amour-perdu.pdf'
COVER = pathlib.Path('/tmp/cover-src.jpg')

PAGE_W, PAGE_H = 6 * inch, 9 * inch
GOLD = HexColor('#A9822F')
INK = HexColor('#1B1712')
MUTED = HexColor('#6B6154')

pdfmetrics.registerFont(TTFont('Cormorant', '/tmp/Cormorant-Medium.ttf'))
pdfmetrics.registerFont(TTFont('CormorantBold', '/tmp/Cormorant-SemiBold.ttf'))
pdfmetrics.registerFont(TTFont('Inter', '/tmp/Inter-Regular.ttf'))

TITLES = {
    1: 'Le commencement', 2: 'Une histoire perdue', 3: 'Le changement',
    4: 'Le mal qu’on ne peut pas dire', 5: 'La maladie cachée', 6: 'Les funérailles',
    7: 'La solitude exilée', 8: 'La lueur et l’espoir', 9: 'Vérité et larmes',
    10: 'Une fleur née de la lune', 11: 'La visitation', 12: 'L’appel de Dieu',
    13: 'La main de Dieu', 14: 'L’envol et le réveil',
    15: 'Ce que le cœur accomplit dans l’amour', 16: 'Le vrai amour', 17: 'Cœur comblé',
}

FILES = [
    (0, 'PROLOGUE', 'La chambre douze', '00-prologue.md'),
    *[(n, f'CHAPITRE {n}', TITLES[n], f'{n:02d}-' + slug + '.md') for n, slug in [
        (1, 'le-commencement'), (2, 'une-histoire-perdue'), (3, 'le-changement'),
        (4, 'le-mal-qu-on-ne-peut-pas-dire'), (5, 'la-maladie-cachee'),
        (6, 'les-funerailles'), (7, 'la-solitude-exilee'), (8, 'la-lueur-et-l-espoir'),
        (9, 'verite-et-larmes'), (10, 'une-fleur-nee-de-la-lune'),
        (11, 'la-visitation'), (12, 'l-appel-de-dieu'), (13, 'la-main-de-dieu'),
        (14, 'l-envol-et-le-reveil'), (15, 'ce-que-le-coeur-accomplit'),
        (16, 'le-vrai-amour'), (17, 'coeur-comble'),
    ]],
]

# --- styles -----------------------------------------------------------------
body = ParagraphStyle(
    'body', fontName='Cormorant', fontSize=11.6, leading=17.2, alignment=TA_JUSTIFY,
    textColor=INK, firstLineIndent=5.2 * mm, spaceAfter=0,
)
body_first = ParagraphStyle('body_first', parent=body, firstLineIndent=0)
label = ParagraphStyle(
    'label', fontName='Inter', fontSize=7.2, leading=10, alignment=TA_CENTER,
    textColor=GOLD, spaceAfter=4,
)
chapter_title = ParagraphStyle(
    'ct', fontName='CormorantBold', fontSize=21, leading=25, alignment=TA_CENTER,
    textColor=INK, spaceAfter=16,
)
title_big = ParagraphStyle('tb', fontName='CormorantBold', fontSize=34, leading=38, alignment=TA_CENTER, textColor=INK)
title_mid = ParagraphStyle('tm', fontName='Cormorant', fontSize=15, leading=20, alignment=TA_CENTER, textColor=MUTED)
toc_line = ParagraphStyle('toc', fontName='Cormorant', fontSize=11.5, leading=18, textColor=INK)


def clean_markup(text: str) -> str:
    text = escape(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
    return text


def read_section(path: pathlib.Path):
    raw = path.read_text(encoding='utf-8')
    raw = re.sub(r'^#\s+.*$', '', raw, flags=re.M)          # titre markdown
    raw = re.sub(r'^>\s?', '', raw, flags=re.M)             # épigraphe
    raw = re.sub(r'^---$', '', raw, flags=re.M)
    raw = re.sub(r'^\*Abidjan.*$', '', raw, flags=re.M)
    blocks = [b.strip() for b in re.split(r'\n\s*\n', raw) if b.strip()]
    return blocks


def on_cover(canvas, doc):
    canvas.drawImage(str(COVER), 0, 0, width=PAGE_W, height=PAGE_H, preserveAspectRatio=True, anchor='c', mask=None)


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont('Inter', 7)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(PAGE_W / 2, 14 * mm, f'{doc.page - 4}')
    canvas.setFillColor(Color(0, 0, 0, 0))
    canvas.restoreState()


def build():
    doc = BaseDocTemplate(
        str(OUT), pagesize=(PAGE_W, PAGE_H),
        leftMargin=20 * mm, rightMargin=18 * mm, topMargin=20 * mm, bottomMargin=22 * mm,
        title='AMOUR PERDU', author='Alexandre Anderson G',
        subject='Roman', creator='BOOK FOREVER',
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='main')
    doc.addPageTemplates([
        PageTemplate(id='cover', frames=[frame], onPage=on_cover),
        PageTemplate(id='plain', frames=[frame], onPage=lambda c, d: None),
        PageTemplate(id='text', frames=[frame], onPage=on_page),
    ])

    story = [NextPageTemplate('plain'), Spacer(1, 1), PageBreak()]

    # Page de titre
    story += [
        Spacer(1, 26 * mm),
        Paragraph('ALEXANDRE ANDERSON G.', ParagraphStyle('a', fontName='Inter', fontSize=8.5,
                  leading=12, alignment=TA_CENTER, textColor=MUTED)),
        Spacer(1, 16 * mm),
        Paragraph('AMOUR', title_big),
        Spacer(1, 2 * mm),
        Paragraph('PERDU', title_big),
        Spacer(1, 8 * mm),
        Paragraph('— Roman —', title_mid),
        Spacer(1, 40 * mm),
        Paragraph('BOOK FOREVER', ParagraphStyle('p', fontName='Inter', fontSize=8,
                  leading=12, alignment=TA_CENTER, textColor=GOLD)),
        Paragraph('ADISEN — section Littérature · Abidjan', ParagraphStyle('p2', fontName='Inter',
                  fontSize=7.5, leading=12, alignment=TA_CENTER, textColor=MUTED)),
        PageBreak(),
    ]

    # Colophon
    story += [
        Spacer(1, 60 * mm),
        Paragraph('© 2026 Alexandre Anderson G. Tous droits réservés.', ParagraphStyle(
            'c', fontName='Inter', fontSize=8, leading=13, alignment=TA_CENTER, textColor=MUTED)),
        Spacer(1, 4 * mm),
        Paragraph('Édité par ADISEN — section Littérature, Abidjan, Côte d’Ivoire.<br/>'
                  'Publié sur BOOK FOREVER.', ParagraphStyle('c2', fontName='Inter', fontSize=8,
                  leading=13, alignment=TA_CENTER, textColor=MUTED)),
        Spacer(1, 10 * mm),
        Paragraph('« La mort n’est pas le sujet. »', ParagraphStyle('q', fontName='Cormorant',
                  fontSize=13, leading=18, alignment=TA_CENTER, textColor=GOLD)),
        PageBreak(),
    ]

    # Sommaire
    story += [Paragraph('SOMMAIRE', ParagraphStyle('s', fontName='Inter', fontSize=8.5, leading=12,
              alignment=TA_CENTER, textColor=GOLD)), Spacer(1, 14 * mm)]
    toc_rows = []
    for number, kicker, title, _ in FILES:
        left = f'{kicker.title() if number == 0 else str(number) + "."}' if number else ''
        toc_rows.append([Paragraph(left, toc_line), Paragraph(clean_markup(title), toc_line)])
    table = Table(toc_rows, colWidths=[14 * mm, doc.width - 14 * mm])
    table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TEXTCOLOR', (0, 0), (0, -1), GOLD),
    ]))
    story += [table, NextPageTemplate('text'), PageBreak()]

    # Corps
    for number, kicker, title, filename in FILES:
        path = SRC / filename
        if not path.exists():
            raise SystemExit(f'fichier manquant : {path}')
        story += [Spacer(1, 14 * mm)]
        if number:
            story += [Paragraph(f'CHAPITRE {number}', label)]
        else:
            story += [Paragraph('PROLOGUE', label)]
        story += [Paragraph(clean_markup(title), chapter_title)]
        blocks = read_section(path)
        for i, block in enumerate(blocks):
            style = body_first if i == 0 else body
            text = clean_markup(re.sub(r'\s+', ' ', block))
            story += [Paragraph(text, style)]
        story += [PageBreak()]

    doc.build(story)
    print(f'PDF écrit : {OUT} ({OUT.stat().st_size / 1024:.0f} Ko)')


if __name__ == '__main__':
    build()
