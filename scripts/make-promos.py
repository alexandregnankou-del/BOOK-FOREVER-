#!/usr/bin/env python3
"""
Montage des vidéos promotionnelles BOOK FOREVER, sans crédit de génération IA.

Pour chaque roman : la couverture reste nette au centre, un fond flouté et
sombre l'entoure, la caméra avance très lentement. Une ligne discrète rappelle
les deux chapitres offerts et l'adresse du site.

Une cinquième vidéo présente la chaîne WhatsApp.

Sortie : videos/*.mp4 — 1080x1920, 30 i/s, H.264, sans son.
"""
import os
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COVERS = os.path.join(ROOT, 'public', 'media', 'covers')
OUT = os.path.join(ROOT, 'videos')
os.makedirs(OUT, exist_ok=True)

SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
SERIF_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
SANS_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

W, H, FPS, SECONDS = 1080, 1920, 30, 8
GOLD = (201, 162, 39)
CREAM = (245, 239, 230)


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr[-1500:], file=sys.stderr)
        raise SystemExit(f'ffmpeg a échoué ({result.returncode})')


def caption_bar(text, path, size=34):
    """Bandeau bas discret : fond dégradé + une ligne de texte."""
    img = Image.new('RGBA', (W, 260), (0, 0, 0, 0))
    px = img.load()
    for y in range(260):  # dégradé vers le bas
        alpha = int(200 * (y / 260) ** 1.4)
        for x in range(W):
            px[x, y] = (10, 8, 6, alpha)
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(SANS, size)
    tw = draw.textlength(text, font=font)
    draw.text(((W - tw) / 2, 150), text, font=font, fill=CREAM + (225,))
    img.save(path)


def book_video(cover_name, slug, caption):
    cover = os.path.join(COVERS, f'{cover_name}.jpg')
    banner = os.path.join(OUT, f'_banner-{slug}.png')
    caption_bar(caption, banner)
    target = os.path.join(OUT, f'{slug}.mp4')

    filters = (
        # fond : la même couverture, agrandie, floutée et assombrie
        f'[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},'
        f'boxblur=30:2,eq=brightness=-0.24:saturation=0.8,'
        f'zoompan=z=\'min(1.0+0.00035*on,1.05)\':d={FPS * SECONDS}:'
        f'x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':s={W}x{H}:fps={FPS}[bg];'
        # premier plan : la couverture, nette, avance très légèrement
        f'[1:v]scale=-2:1200,'
        f'zoompan=z=\'min(1.0+0.0006*on,1.07)\':d={FPS * SECONDS}:'
        f'x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':s=800x1200:fps={FPS}[fg];'
        f'[bg][fg]overlay=(W-w)/2:(H-h)/2-70[tmp];'
        f'[tmp][2:v]overlay=0:H-h[all];'
        f'[all]fade=t=in:st=0:d=0.6,fade=t=out:st={SECONDS - 0.9}:d=0.9,'
        f'format=yuv420p[v]'
    )

    run([
        'ffmpeg', '-y', '-loop', '1', '-t', str(SECONDS), '-i', cover,
        '-loop', '1', '-t', str(SECONDS), '-i', cover,
        '-loop', '1', '-t', str(SECONDS), '-i', banner,
        '-filter_complex', filters, '-map', '[v]', '-t', str(SECONDS),
        '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '22',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', target,
    ])
    os.remove(banner)
    print(f'  {os.path.basename(target)}  {os.path.getsize(target) / 1024:.0f} Ko')


def channel_card(path):
    """Carte verticale pour la chaîne WhatsApp : fond dégradé, texte doré."""
    img = Image.new('RGB', (W, H), (20, 17, 14))
    draw = ImageDraw.Draw(img)
    for y in range(H):  # dégradé chaud
        t = y / H
        draw.line([(0, y), (W, y)], fill=(int(20 + 22 * t), int(17 + 14 * t), int(14 + 6 * t)))

    glow = Image.new('RGB', (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W * 0.05, H * 0.05, W * 0.95, H * 0.55], fill=(70, 54, 20))
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    img = Image.blend(img, glow, 0.35)
    draw = ImageDraw.Draw(img)

    def fit(text, font_path, start_size, max_width):
        """Réduit la taille jusqu'à ce que la ligne tienne dans la largeur."""
        size = start_size
        while size > 18:
            font = ImageFont.truetype(font_path, size)
            if draw.textlength(text, font=font) <= max_width:
                return font
            size -= 2
        return ImageFont.truetype(font_path, 18)

    def center(text, font, y, fill):
        w = draw.textlength(text, font=font)
        draw.text(((W - w) / 2, y), text, font=font, fill=fill)

    maxw = W - 150

    center('B O O K   F O R E V E R', ImageFont.truetype(SANS_BOLD, 32), 430, GOLD)
    center('Les nouveautés', fit('Les nouveautés', SERIF_BOLD, 88, maxw), 520, CREAM)
    center('avant tout le monde', fit('avant tout le monde', SERIF_BOLD, 88, maxw), 630, CREAM)

    draw.line([(W / 2 - 90, 800), (W / 2 + 90, 800)], fill=GOLD, width=3)

    body_size = 38
    lines = [
        'Nouveaux chapitres dès leur sortie',
        'Offres et pass réservés aux abonnés',
        'Aucun message privé, aucun spam',
    ]
    body = ImageFont.truetype(SANS, body_size)
    widest = max(draw.textlength('•  ' + line, font=body) for line in lines)
    left = (W - widest) / 2
    for i, line in enumerate(lines):
        draw.text((left, 910 + i * 74), '•', font=body, fill=GOLD)
        draw.text((left + 34, 910 + i * 74), line, font=body, fill=(200, 190, 172))

    center('Rejoindre la chaîne', ImageFont.truetype(SANS_BOLD, 46), 1330, GOLD)
    center('whatsapp.com/channel/0029VbDDuHM5Ejy5yt0ylo1j',
           fit('whatsapp.com/channel/0029VbDDuHM5Ejy5yt0ylo1j', SANS, 30, maxw), 1400, (150, 142, 128))
    center('book-forever.onrender.com', ImageFont.truetype(SANS, 32), 1500, (170, 160, 142))

    img.save(path, 'JPEG', quality=94)


def channel_video():
    card = os.path.join(OUT, '_channel-card.jpg')
    channel_card(card)
    target = os.path.join(OUT, 'chaine-whatsapp.mp4')
    filters = (
        f'[0:v]scale={W}:{H},zoompan=z=\'min(1.0+0.00035*on,1.05)\':'
        f'd={FPS * SECONDS}:x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':'
        f's={W}x{H}:fps={FPS},'
        f'fade=t=in:st=0:d=0.7,fade=t=out:st={SECONDS - 0.9}:d=0.9,format=yuv420p[v]'
    )
    run([
        'ffmpeg', '-y', '-loop', '1', '-t', str(SECONDS), '-i', card,
        '-filter_complex', filters, '-map', '[v]', '-t', str(SECONDS),
        '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '22',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', target,
    ])
    os.remove(card)
    print(f'  {os.path.basename(target)}  {os.path.getsize(target) / 1024:.0f} Ko')


if __name__ == '__main__':
    print('Romans :')
    book_video('pour-une-femme', 'pour-une-femme-que-j-aime', 'Deux chapitres offerts · book-forever.onrender.com')
    book_video('les-larmes', 'les-larmes-d-une-plume', 'Deux chapitres offerts · book-forever.onrender.com')
    book_video('light-in-the-dark', 'light-in-the-dark', 'Deux chapitres offerts · book-forever.onrender.com')
    book_video('si-je-t-aimais-au-present', 'si-je-t-aimais-au-present', 'Deux chapitres offerts · book-forever.onrender.com')
    print('Chaîne :')
    channel_video()
    print('Terminé.')
