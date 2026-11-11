#!/usr/bin/env python3
"""Convertit le texte des logos Disjonio (kit d'identité) en tracés vectoriels avec la vraie police Manrope,
pour qu'ils s'affichent correctement partout (une image SVG ne peut pas charger la police du site).
Usage : pip install fonttools brotli && python3 scripts/outline-wordmark.py
Entrée : public/branding/disjonio/svg/*.svg · police : public/fonts/manrope-latin-wght-normal.woff2 · sortie : svg/outlined/"""
import re, glob, os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.join(os.path.dirname(__file__), '..')
FONT = os.path.join(ROOT, 'public/fonts/manrope-latin-wght-normal.woff2')
SRC = os.path.join(ROOT, 'public/branding/disjonio/svg')
OUT = os.path.join(SRC, 'outlined')
os.makedirs(OUT, exist_ok=True)
cache = {}
def font_at(w):
    if w not in cache:
        cache[w] = instancer.instantiateVariableFont(TTFont(FONT), {'wght': w}, inplace=False)
    return cache[w]

def outline(text, x, y, size, weight, spacing, anchor, fill):
    f = font_at(weight); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm; hmtx = f['hmtx']
    k = size / upm
    names = [cmap[ord(c)] for c in text]
    width = sum(hmtx[n][0] * k + spacing for n in names)
    cx = x - (width - spacing) / 2 if anchor == 'middle' else x
    d = []
    for n in names:
        pen = SVGPathPen(gs, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
        gs[n].draw(TransformPen(pen, (k, 0, 0, -k, cx, y)))
        d.append(pen.getCommands())
        cx += hmtx[n][0] * k + spacing
    return '<path d="%s" fill="%s"/>' % (''.join(d), fill)

pat = re.compile(r'<text ([^>]*)>([^<]*)</text>')
def conv(m):
    a = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(1)))
    return outline(m.group(2), float(a['x']), float(a['y']), float(a['font-size']), float(a['font-weight']), float(a.get('letter-spacing', 0)), a.get('text-anchor', 'start'), a['fill'])

n = 0
for p in sorted(glob.glob(SRC + '/*.svg')):
    s = open(p, encoding='utf-8').read()
    if '<text' not in s: continue
    open(os.path.join(OUT, os.path.basename(p)), 'w', encoding='utf-8').write(pat.sub(conv, s)); n += 1
print(n, 'logos convertis en tracés →', OUT)
