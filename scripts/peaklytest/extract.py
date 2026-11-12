"""Extract practice-test questions from the PeaklyTest PDFs (one question per page, Chrome-printed HTML + KaTeX).

Usage: python -I extract.py <pdf> <out_dir>
Writes <out_dir>/<slug>.json and figure images to <out_dir>/img/<slug>/.
"""
import io
import json
import os
import re
import statistics
import sys

import pymupdf
from PIL import Image

LIG = {0xE009: 'tt', 0xE007: 'ff', 0xE008: 'ffl', 0xFB00: 'ff', 0xFB01: 'fi', 0xFB02: 'fl', 0xFB03: 'ffi', 0xFB04: 'ffl'}
MATH_CMD = {
    '−': '-', '⋅': '\\cdot ', '·': '\\cdot ', '×': '\\times ', '÷': '\\div ', '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ',
    '±': '\\pm ', '∞': '\\infty ', '≈': '\\approx ', '∠': '\\angle ', '△': '\\triangle ', '{': '\\{', '}': '\\}',
    '⁡': '', '​': '', '⁢': '',
}
FUNCS = {'sin', 'cos', 'tan', 'log', 'ln'}


class Glyph:
    __slots__ = ('ch', 'font', 'size', 'x0', 'y0', 'x1', 'y1', 'ox', 'oy', 'seq', 'bold', 'semi', 'color', 'math', 'ul')

    def __init__(self, **kw):
        for k, v in kw.items():
            setattr(self, k, v)
        self.ul = False

    @property
    def cx(self):
        return (self.x0 + self.x1) / 2


class Doc:
    def __init__(self, path):
        self.doc = pymupdf.open(path)
        self.fonts = {}
        # some files were printed at a smaller scale: normalise everything to the reference layout (header bar 503pt wide)
        widths = []
        for p in list(self.doc)[:6]:
            widths += [x['rect'].width for x in p.get_drawings() if 50 < x['rect'].y0 < 60 and x['rect'].height > 10 and x['rect'].width > 300][:1]
        w = statistics.median(widths) if widths else 503.3
        self.s = 1.0 if abs(w - 503.3) < 20 else w / 503.3

    def X(self, x):
        return 40 + (x - 40) / self.s

    def Y(self, y):
        return 55 + (y - 55) / self.s

    def tr(self, r):
        return pymupdf.Rect(self.X(r[0]), self.Y(r[1]), self.X(r[2]), self.Y(r[3]))

    def inv(self, r):
        return pymupdf.Rect(40 + (r[0] - 40) * self.s, 55 + (r[1] - 55) * self.s, 40 + (r[2] - 40) * self.s, 55 + (r[3] - 55) * self.s)

    def font_name(self, f):
        m = re.match(r'Type3 \((\d+) 0 R\)', f)
        if not m:
            return f
        x = int(m.group(1))
        if x not in self.fonts:
            fd = self.doc.xref_get_key(x, 'FontDescriptor')
            name = '?'
            if fd[0] == 'xref':
                name = self.doc.xref_get_key(int(fd[1].split()[0]), 'FontName')[1].split('+')[-1]
            self.fonts[x] = name
        return self.fonts[x]


# ---------------------------------------------------------------- page primitives
def page_glyphs(D, page):
    out = []
    for t in page.get_texttrace():
        fn = D.font_name(t['font'])
        math = fn.startswith('KaTeX')
        for c in t['chars']:
            u = c[0]
            if u < 0:
                continue
            ch = LIG.get(u, chr(u))
            if u == 0xE020:
                ch = '⧸'  # KaTeX slash drawn over '=' to make '≠'
            bb = c[3]
            if math and (not ch.strip() or ch in '​⁡⁢⁣‌‍'):
                continue
            out.append(Glyph(ch=ch, font=fn, size=t['size'] / D.s, x0=D.X(bb[0]), y0=D.Y(bb[1]), x1=D.X(bb[2]), y1=D.Y(bb[3]), ox=D.X(c[2][0]), oy=D.Y(c[2][1]),
                             seq=t['seqno'], bold=('Bold' in fn and 'Semi' not in fn) or 'ExtraBold' in fn, semi='SemiBold' in fn,
                             color=tuple(round(x, 2) for x in t['color']), math=math))
    return out


def clipped_drawings(D, page):
    """Drawings with their rect cut to the active clip (KaTeX root signs are very wide paths clipped by CSS)."""
    out = []
    clips = {}
    for d in page.get_drawings(extended=True):
        lvl = d.get('level', 0)
        if d['type'] == 'clip':
            clips = {k: v for k, v in clips.items() if k < lvl}
            clips[lvl] = pymupdf.Rect(d['scissor'])
            continue
        if d['type'] == 'group':
            continue
        r = pymupdf.Rect(d['rect'])
        for k, v in clips.items():
            if k < lvl:
                r = r & v
        d = dict(d)
        d['rect'] = D.tr(r)
        out.append(d)
    return out


def is_chrome(d):
    r = d['rect']
    if r.y1 < 80:
        return True
    if r.width > 380 and r.height > 15:
        return True  # option boxes, explanation background, spr box
    f = d.get('fill')
    if f and abs(f[0] - 0.13) < 0.03 and abs(f[2] - 0.87) < 0.03:
        return True  # blue pill / selected circle
    if 15 < r.width < 20 and 15 < r.height < 20 and r.x0 < 70:
        return True  # label circle
    if d.get('color') and d['color'][0] > 0.5 and r.width > 300:
        return True
    return False


def thin(d):
    r = d['rect']
    return d['items'] and all(i[0] == 're' for i in d['items']) and (r.height <= 1.6 or r.width <= 1.6)


# ---------------------------------------------------------------- math
def tex_char(g):
    ch = g.ch
    if ch in MATH_CMD:
        return MATH_CMD[ch]
    return ch


def emit_glyph_seq(nodes):
    """nodes: list of dicts with 'tex', 'x0','x1','size','word' ; joins with spacing and wraps upright words."""
    out = ''
    i = 0
    prev = None
    while i < len(nodes):
        n = nodes[i]
        if n.get('upright'):
            j = i
            word = ''
            while j < len(nodes) and nodes[j].get('upright') and (j == i or nodes[j]['x0'] - nodes[j - 1]['x1'] < 0.12 * n['size']):
                word += nodes[j]['tex']
                j += 1
            if prev is not None and n['x0'] - prev['x1'] > 0.2 * n['size']:
                out += ' '
            out += ('\\' + word + ' ') if word in FUNCS else ('\\text{' + word + '}')
            prev = nodes[j - 1]
            i = j
            continue
        if prev is not None and n['x0'] - prev['x1'] > 0.2 * max(n['size'], 6) and not out.endswith(' '):
            out += ' '
        t = n['tex']
        if out and out[-1].isalpha() and re.match(r'\\[a-zA-Z]', out.split(' ')[-1] or '') and t[:1].isalpha():
            out += ' '
        out += t
        prev = n
        i += 1
    return out


def build_level(glyphs, bars, paths):
    """Return LaTeX for a set of glyphs + drawings belonging to one row/sub-expression."""
    if not glyphs and not bars and not paths:
        return ''
    nodes = []
    used = set()
    comps = []
    for b in bars:
        comps.append(('frac', b['rect']))
    for p in paths:
        comps.append(('path', p['rect']))
    comps.sort(key=lambda c: -c[1].width)
    claimed_comp = set()
    for ci, (kind, r) in enumerate(comps):
        if ci in claimed_comp:
            continue
        if kind == 'frac':
            num = [g for g in glyphs if id(g) not in used and r.x0 - 1 <= g.cx <= r.x1 + 1 and g.oy <= r.y0 + 1 and g.oy > r.y0 - 3.5 * g.size]
            den = [g for g in glyphs if id(g) not in used and r.x0 - 1 <= g.cx <= r.x1 + 1 and g.oy > r.y1 and g.y0 < r.y1 + 3.0 * g.size]
            if not den:
                continue
            sub_b_num, sub_p_num, sub_b_den, sub_p_den = [], [], [], []
            for cj, (k2, r2) in enumerate(comps):
                if cj == ci or cj in claimed_comp:
                    continue
                if r.x0 - 1 <= (r2.x0 + r2.x1) / 2 <= r.x1 + 1 and r2.width <= r.width:
                    tgt = None
                    if r2.y1 <= r.y0 + 0.5 and r2.y0 > r.y0 - 40:
                        tgt = (sub_b_num, sub_p_num)
                    elif r2.y0 >= r.y1 - 0.5 and r2.y1 < r.y1 + 40:
                        tgt = (sub_b_den, sub_p_den)
                    if tgt:
                        (tgt[0] if k2 == 'frac' else tgt[1]).append({'rect': r2})
                        claimed_comp.add(cj)
            for g in num + den:
                used.add(id(g))
            if not num:
                tex = '\\overline{' + build_level(den, sub_b_den, sub_p_den) + '}'
                nodes.append({'tex': tex, 'x0': r.x0, 'x1': r.x1, 'size': max(g.size for g in den), 'comp': True, 'cy': r.y1})
                continue
            tex = '\\frac{' + build_level(num, sub_b_num, sub_p_num) + '}{' + build_level(den, sub_b_den, sub_p_den) + '}'
            sz = max([g.size for g in num + den] or [10])
            nodes.append({'tex': tex, 'x0': r.x0, 'x1': r.x1, 'size': sz / 0.7 if sz < 9 else sz, 'comp': True, 'cy': r.y0, 'frac': True, 'gs': sz})
        else:
            sz_est = statistics.median([g.size for g in glyphs]) if glyphs else 10
            inner = [g for g in glyphs if id(g) not in used and r.x0 + 0.45 * g.size < g.cx <= r.x1 + 0.5 and r.y0 - 1 <= (g.oy - 0.3 * g.size) <= r.y1 + 1]
            if r.width < 0.75 * sz_est or not inner:
                # tall delimiter drawn as a path
                if r.height > 1.1 * sz_est:
                    others = [g for g in glyphs if abs((g.oy) - (r.y0 + r.y1) / 2) < r.height]
                    left = sum(1 for g in others if g.cx > r.x1) >= sum(1 for g in others if g.cx < r.x0)
                    nodes.append({'tex': '(' if left else ')', 'x0': r.x0, 'x1': r.x1, 'size': sz_est, 'comp': True, 'cy': (r.y0 + r.y1) / 2})
                continue
            sub_b, sub_p = [], []
            for cj, (k2, r2) in enumerate(comps):
                if cj == ci or cj in claimed_comp:
                    continue
                if r.x0 <= r2.x0 and r2.x1 <= r.x1 + 1 and r.y0 - 1 <= r2.y0 and r2.y1 <= r.y1 + 1:
                    (sub_b if k2 == 'frac' else sub_p).append({'rect': r2})
                    claimed_comp.add(cj)
            for g in inner:
                used.add(id(g))
            tex = '\\sqrt{' + build_level(inner, sub_b, sub_p) + '}'
            nodes.append({'tex': tex, 'x0': r.x0, 'x1': r.x1, 'size': sz_est, 'comp': True, 'cy': (r.y0 + r.y1) / 2})
    rest = [g for g in glyphs if id(g) not in used]
    if rest:
        base_size = max(g.size for g in rest)
        big = [g for g in rest if g.size >= 0.92 * base_size]
        base_y = statistics.median([g.oy for g in big])
    else:
        base_size, base_y = (nodes[0]['size'] if nodes else 10), None
    items = []
    for g in rest:
        role = 'base'
        if base_y is not None and g.size < 0.9 * base_size:
            if g.oy < base_y - 0.12 * base_size:
                role = 'sup'
            elif g.oy > base_y + 0.08 * base_size:
                role = 'sub'
        items.append(('g', g, role))
    for n in nodes:
        role = 'base'
        # a small fraction raised well above the baseline is an exponent, e.g. 2.80^{x/2}
        if n.get('frac') and base_y is not None and n['gs'] < 0.85 * base_size and n['cy'] < base_y - 0.45 * base_size:
            role = 'supnode'
        items.append(('n', n, role))
    items.sort(key=lambda it: it[1]['x0'] if it[0] == 'n' else it[1].x0)
    seq = []
    i = 0
    while i < len(items):
        kind, obj, role = items[i]
        if role == 'supnode':
            seq.append({'tex': '^{' + obj['tex'] + '}', 'x0': obj['x0'], 'x1': obj['x1'], 'size': base_size, 'script': True})
            i += 1
            continue
        if role in ('sup', 'sub'):
            j = i
            grp = []
            while j < len(items) and items[j][2] == role and items[j][0] == 'g':
                grp.append(items[j][1])
                j += 1
            inner = build_level(grp, [], [])
            tex = ('^{' if role == 'sup' else '_{') + inner + '}'
            seq.append({'tex': tex, 'x0': grp[0].x0, 'x1': grp[-1].x1, 'size': base_size, 'script': True})
            i = j
            continue
        if kind == 'n':
            seq.append(obj)
        else:
            up = obj.font.startswith('KaTeX_Main') and obj.ch.isascii() and obj.ch.isalpha()
            seq.append({'tex': tex_char(obj), 'x0': obj.x0, 'x1': obj.x1, 'size': obj.size, 'upright': up})
        i += 1
    # scripts attach without spacing
    out_nodes = []
    for n in seq:
        if n.get('script') and out_nodes:
            out_nodes[-1] = dict(out_nodes[-1], tex=out_nodes[-1]['tex'] if not out_nodes[-1].get('upright') else out_nodes[-1]['tex'])
            out_nodes.append(dict(n, x0=out_nodes[-1]['x1']))
        else:
            out_nodes.append(n)
    tex = emit_glyph_seq(out_nodes)
    tex = re.sub(r'\}\s+([\^_])', r'}\1', tex)
    tex = tex.replace('^{∘}', '°').replace('^{\\circ}', '°')
    tex = re.sub(r'=\s*⧸|⧸\s*=', lambda m: '\\ne ', tex).replace('⧸', '/')
    return tex


def math_rows(glyphs, drawings):
    """Split a math run into rows (wrapped lines or display rows); returns [(tex, x0, x1, baseline, top, bottom)]."""
    bars = [d for d in drawings if thin(d) and d['rect'].height <= 1.6 and d['rect'].width > 1.5]
    paths = [d for d in drawings if not thin(d)]
    # row baselines from full-size glyphs not stacked inside fractions
    maxs = max(g.size for g in glyphs)
    inside_frac = set()
    frac_bars = []
    for b in bars:
        r = b['rect']
        near = [g for g in glyphs if r.x0 - 1 <= g.cx <= r.x1 + 1 and abs(g.oy - r.y0) < 2.2 * g.size]
        # a fraction has glyphs above and below its bar; a bar with glyphs only below is an overline
        if any(g.oy <= r.y0 + 0.5 for g in near) and any(g.oy > r.y1 for g in near):
            inside_frac.update(id(g) for g in near)
            frac_bars.append(b)
    cands = sorted(g.oy for g in glyphs if g.size >= 0.92 * maxs and id(g) not in inside_frac)
    if not cands:
        cands = sorted(g.oy for g in glyphs if id(g) not in inside_frac)
    if not cands:
        cands = sorted(((b['rect'].y0 + 0.3 * maxs) for b in frac_bars)) or [statistics.median(g.oy for g in glyphs)]
    rows = []
    for y in cands:
        if rows and y - rows[-1][-1] < 0.9 * maxs:
            rows[-1].append(y)
        else:
            rows.append([y])
    bases = [statistics.median(r) for r in rows]
    if len(bases) == 1:
        groups = [(bases[0], glyphs, bars, paths)]
    else:
        def nearest(y):
            return min(range(len(bases)), key=lambda k: abs(bases[k] - y))
        gg = [[] for _ in bases]
        bb = [[] for _ in bases]
        pp = [[] for _ in bases]
        for b in bars:
            r = b['rect']
            bb[nearest(r.y0 + 0.25 * maxs)].append(b)
        for p in paths:
            r = p['rect']
            pp[nearest((r.y0 + r.y1) / 2 + 0.3 * maxs)].append(p)
        for g in glyphs:
            k = None
            for kk, b in enumerate(bb):
                for x in b:
                    r = x['rect']
                    if r.x0 - 1 <= g.cx <= r.x1 + 1 and abs(g.oy - r.y0) < 2.2 * g.size:
                        k = kk
            for kk, b in enumerate(pp):
                for x in b:
                    r = x['rect']
                    if r.x0 - 1 <= g.cx <= r.x1 + 1 and r.y0 - 2 <= g.oy - 0.3 * g.size <= r.y1 + 2:
                        k = kk if k is None else k
            gg[nearest(g.oy) if k is None else k].append(g)
        groups = [(bases[k], gg[k], bb[k], pp[k]) for k in range(len(bases)) if gg[k] or bb[k] or pp[k]]
    out = []
    for base, gs, bs, ps in groups:
        tex = build_level(gs, bs, ps).strip()
        xs = [g.x0 for g in gs] + [b['rect'].x0 for b in bs + ps]
        xe = [g.x1 for g in gs] + [b['rect'].x1 for b in bs + ps]
        ys = [g.y0 for g in gs] + [b['rect'].y0 for b in bs + ps]
        ye = [g.y1 for g in gs] + [b['rect'].y1 for b in bs + ps]
        out.append((tex, min(xs), max(xe), base, min(ys), max(ye)))
    return out


# ---------------------------------------------------------------- page analysis
class Token:
    __slots__ = ('kind', 'text', 'x0', 'x1', 'y', 'top', 'bottom', 'bold', 'semi', 'ul', 'size', 'color')

    def __init__(self, **kw):
        for k, v in kw.items():
            setattr(self, k, v)


def analyse_page(D, pno, img_dir, slug, counter):
    page = D.doc[pno]
    glyphs = page_glyphs(D, page)
    drawings = clipped_drawings(D, page)
    content_dr = [d for d in drawings if not is_chrome(d)]
    info = {'pno': pno}

    # header line
    head = [g for g in glyphs if g.oy < 100 and abs(g.size - 8.3) < 0.3]
    info['header'] = ''.join(g.ch for g in head).strip()
    glyphs = [g for g in glyphs if g not in head]

    # markers
    labels = [g for g in glyphs if g.bold and abs(g.size - 8.8) < 0.3 and g.ch in 'ABCD' and g.x0 < 64]
    boxes = [d['rect'] for d in drawings if d['rect'].width > 380 and 25 < d['rect'].height and d['rect'].y0 > 45]
    opt_boxes = []
    for lab in labels:
        cont = [r for r in boxes if r.x0 - 1 <= lab.x0 and lab.x1 <= r.x1 + 1 and r.y0 - 1 <= lab.y0 and lab.y1 <= r.y1 + 1]
        if cont:
            r = min(cont, key=lambda r: r.height)
            opt_boxes.append((lab.ch, pymupdf.Rect(r)))
    labels_ids = {id(g) for g in labels}
    pill = [g for g in glyphs if g.bold and abs(g.size - 10.2) < 0.4 and g.color == (1.0, 1.0, 1.0)]
    pill_math = []
    if pill:
        py0 = min(g.y0 for g in pill) - 3
        py1 = max(g.y1 for g in pill) + 3
        pill_math = [g for g in glyphs if g.math and py0 <= g.oy <= py1 + 2 and g.x0 < 260 and g not in pill]
        info['answer_raw'] = (''.join(g.ch for g in sorted(pill + pill_math, key=lambda g: g.x0)))
        info['answer_y'] = py0
    expl_head = [g for g in glyphs if 'ExtraBold' in g.font and abs(g.size - 9.6) < 0.3]
    info['expl_y'] = min(g.y0 for g in expl_head) if expl_head else None
    spr = [g for g in glyphs if g.color == (0.33, 0.33, 0.33)]
    info['spr_y'] = min(g.y0 for g in spr) if spr else None
    skip = labels_ids | {id(g) for g in pill + pill_math + expl_head + spr}
    glyphs = [g for g in glyphs if id(g) not in skip]
    info['options_found'] = [c for c, _ in opt_boxes]

    # ---- drawings: tables (grids of thin rects), bars (fractions / underlines), paths (roots, delimiters, figures)
    thin_all = [d for d in content_dr if thin(d)]
    paths_all = [d for d in content_dr if not thin(d)]
    groups = []
    for d in thin_all:
        r = pymupdf.Rect(d['rect'])
        hit = [gi for gi, g in enumerate(groups) if (g['rect'] + (-1.5, -1.5, 1.5, 1.5)).intersects(r)]
        if hit:
            base = groups[hit[0]]
            for gi in sorted(hit[1:], reverse=True):
                base['items'] += groups[gi]['items']
                base['drs'] += groups[gi]['drs']
                base['rect'] |= groups[gi]['rect']
                groups.pop(gi)
            base['items'].append(r)
            base['drs'].append(d)
            base['rect'] |= r
        else:
            groups.append({'rect': pymupdf.Rect(r), 'items': [r], 'drs': [d]})
    tables = []
    bars = []
    for g in groups:
        hs = [r for r in g['items'] if r.height <= 1.6]
        vs = [r for r in g['items'] if r.width <= 1.6 and r.height > 1.6]
        if len(vs) >= 2 and len(hs) >= 2:
            tables.append(g)
        else:
            bars += [d for d in g['drs'] if d['rect'].height <= 1.6 and d['rect'].width > 1.5]
    # vector figures: clusters of paths that are big or many
    clusters = []
    for d in paths_all:
        r = pymupdf.Rect(d['rect'])
        hit = [c for c in clusters if (c['rect'] + (-4, -4, 4, 4)).intersects(r)]
        if hit:
            hit[0]['rect'] |= r
            hit[0]['drs'].append(d)
        else:
            clusters.append({'rect': pymupdf.Rect(r), 'drs': [d]})
    figs = []
    math_paths = []
    for c in clusters:
        r = c['rect']
        shapes = [d for d in c['drs'] if not all(i[0] == 're' for i in d['items'])]
        if not shapes:
            continue  # plain rectangles: backgrounds, shadows
        if (len(c['drs']) >= 4 and r.width > 30 and r.height > 30) or (r.width > 60 and r.height > 60):
            figs.append(r)
        else:
            math_paths += c['drs']

    # ---- math formulas: connected groups of KaTeX glyphs (plus their bars and paths)
    mg = [g for g in glyphs if g.math]
    tg = [g for g in glyphs if not g.math]
    parent = list(range(len(mg) + len(bars) + len(math_paths)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    order = sorted(range(len(mg)), key=lambda i: mg[i].y0)
    for ii, i in enumerate(order):
        a = mg[i]
        for j in order[ii + 1:]:
            b = mg[j]
            if b.y0 > a.y1 + 8:
                break
            need = 0.25 * min(a.size, b.size)
            # an exponent after a big delimiter, e.g. (1/8)^x, sits high above the delimiter's glyph box
            big, small = (a, b) if a.size > b.size else (b, a)
            if big.font.startswith('KaTeX_Size') and small.size < 0.9 * big.size and -1 <= small.x0 - big.x1 <= 3 and big.oy - 1.3 * big.size < small.oy < big.oy:
                union(i, j)
                continue
            if min(a.y1, b.y1) - max(a.y0, b.y0) < need:
                continue
            gap = max(b.x0 - a.x1, a.x0 - b.x1)
            if gap > 0.75 * max(a.size, b.size):
                continue
            lo, hi = (a.x1, b.x0) if a.x0 <= b.x0 else (b.x1, a.x0)
            ylo, yhi = max(a.y0, b.y0), min(a.y1, b.y1)
            blocked = any(t.cx > lo - 0.3 and t.cx < hi + 0.3 and t.y1 > ylo and t.y0 < yhi for t in tg if t.x1 >= lo - 3 and t.x0 <= hi + 3)
            if not blocked:
                union(i, j)
    nb = len(mg)
    attached = set()
    for k, d in enumerate(bars + math_paths):
        r = pymupdf.Rect(d['rect']) + (-1.5, -1.5, 1.5, 1.5)
        if k < len(bars):
            # a bar joins glyphs above and below it (fraction / overline); a bar with only glyphs above is an underline
            br = d['rect']
            inx = [i for i, g in enumerate(mg) if br.x0 - 1 <= g.cx <= br.x1 + 1]
            above = [i for i in inx if mg[i].oy <= br.y0 + 0.5 and br.y0 - mg[i].y1 < 0.6 * mg[i].size]
            # a numerator never sits on a line of regular text; glyphs that do belong to the previous line
            above = [i for i in above if not any(abs(t.oy - mg[i].oy) < 1.2 and abs(t.x0 - mg[i].x0) < 150 for t in tg)]
            below = [i for i in inx if mg[i].oy > br.y1 and mg[i].y0 - br.y1 < 0.6 * mg[i].size]
            if not below:
                continue
            hits = above + below
        else:
            rr = pymupdf.Rect(d["rect"]) + (-1.5, -1.5, 4, 1.5)  # exponents sit just right of a tall delimiter
            hits = [i for i, g in enumerate(mg) if rr.intersects(pymupdf.Rect(g.x0, g.y0, g.x1, g.y1))]
        for i in hits:
            union(nb + k, i)
        if hits:
            attached.add(k)
    comps = {}
    for i in range(len(mg)):
        comps.setdefault(find(i), {'g': [], 'd': []})['g'].append(mg[i])
    for k, d in enumerate(bars + math_paths):
        if k in attached:
            comps.setdefault(find(nb + k), {'g': [], 'd': []})['d'].append(d)
    tokens = []
    for c in comps.values():
        if not c['g']:
            continue
        for tex, a, b, base, top, bot in math_rows(c['g'], c['d']):
            if '$' in tex:
                tex = tex.replace('\\$', '').replace('$', '').strip()
                tokens.append(Token(kind='text', text='$', x0=a - 0.01, x1=a, y=base, top=top, bottom=bot, bold=False, semi=False, ul=False, size=10.5, color=None))
            if tex:
                tokens.append(Token(kind='math', text=tex, x0=a, x1=b, y=base, top=top, bottom=bot, bold=False, semi=False, ul=False, size=c['g'][0].size, color=None))
    free_bars = [d for k, d in enumerate(bars) if k not in attached]
    for d in free_bars:
        r = d['rect']
        for gl in tg:
            if r.x0 - 0.5 <= gl.cx <= r.x1 + 0.5 and -1 <= r.y0 - gl.oy <= 5:
                gl.ul = True
        for t in tokens:
            if t.kind == 'math' and r.x0 - 1 <= (t.x0 + t.x1) / 2 <= r.x1 + 1 and -1 <= r.y0 - t.y <= 6:
                t.ul = True
    blocks = []
    # images
    imgs = []
    for im in page.get_image_info(xrefs=True):
        r = D.tr(im['bbox'])
        if r.width < 8 or r.height < 8:
            continue
        imgs.append((r, im['xref']))
    tex_tokens = tokens
    # text tokens
    for g in glyphs:
        if g.math:
            continue
        tokens.append(Token(kind='text', text=g.ch, x0=g.x0, x1=g.x1, y=g.oy, top=g.y0, bottom=g.y1, bold=g.bold, semi=g.semi, ul=g.ul, size=g.size, color=g.color))

    def inside(t, r, pad=1.5):
        cx = (t.x0 + t.x1) / 2
        cy = (t.top + t.bottom) / 2
        return r.x0 - pad <= cx <= r.x1 + pad and r.y0 - pad <= cy <= r.y1 + pad

    # tables -> markdown
    for tb in tables:
        R = tb['rect']
        xs = sorted({round((r.x0 + r.x1) / 2, 0) for r in tb['items'] if r.width <= 1.6 and r.height > 1.6})
        ys = sorted({round((r.y0 + r.y1) / 2, 0) for r in tb['items'] if r.height <= 1.6})
        xs = dedup(xs)
        ys = dedup(ys)
        cells = [[[] for _ in range(len(xs) - 1)] for _ in range(len(ys) - 1)]
        mine = [t for t in tokens if inside(t, R)]
        for t in mine:
            cx = (t.x0 + t.x1) / 2
            cy = t.y - 0.3 * t.size
            ci = next((i for i in range(len(xs) - 1) if xs[i] - 1 <= cx <= xs[i + 1] + 1), None)
            ri = next((i for i in range(len(ys) - 1) if ys[i] - 1 <= cy <= ys[i + 1] + 1), None)
            if ci is not None and ri is not None:
                cells[ri][ci].append(t)
        tokens = [t for t in tokens if t not in mine]
        rows = []
        for row in cells:
            rows.append([' '.join(l for l in render_lines(make_lines(c)) if l).replace('|', '/') if c else '' for c in row])
        # drop fully empty columns / rows
        keep_c = [i for i in range(len(xs) - 1) if any(r[i] for r in rows)]
        rows = [[r[i] for i in keep_c] for r in rows if any(r[i] for i in keep_c)]
        if rows:
            rows[0] = [c.replace('**', '') for c in rows[0]]
        md = '\n'.join('| ' + ' | '.join(r) + ' |' for r in rows)
        blocks.append({'y': R.y0, 'kind': 'table', 'md': md, 'rect': R})
    for r, xref in imgs:
        if any((r & tb['rect']).get_area() > 0.3 * tb['rect'].get_area() for tb in tables):
            continue  # shadow image behind a table
        if not xref:
            pix = page.get_pixmap(clip=D.inv(r), dpi=40)
            im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('L')
            if statistics.pstdev(list(im.getdata())) < 6:
                continue  # flat decorative image
        counter[0] += 1
        name = f'{counter[0]:03d}.webp'
        try:
            if not xref:
                raise ValueError('inline image')
            save_image(D.doc, xref, os.path.join(img_dir, name))
        except Exception:
            pix = page.get_pixmap(clip=D.inv(r), dpi=200)
            Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB').save(os.path.join(img_dir, name), 'WEBP', quality=88)
        blocks.append({'y': r.y0, 'kind': 'image', 'file': f'{slug}/{name}', 'rect': r})
        tokens = [t for t in tokens if not inside(t, r)]
    for r in figs:
        if any(r.intersects(tb['rect']) for tb in tables):
            continue
        counter[0] += 1
        name = f'{counter[0]:03d}.webp'
        clip = r + (-8, -8, 8, 8)
        # include text labels sitting around the drawing
        lab = [t for t in tokens if inside(t, clip, 0)]
        for t in lab:
            clip |= pymupdf.Rect(t.x0, t.top, t.x1, t.bottom)
        pix = page.get_pixmap(clip=D.inv(clip + (-2, -2, 2, 2)), dpi=220)
        im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
        im.save(os.path.join(img_dir, name), 'WEBP', quality=88)
        blocks.append({'y': clip.y0, 'kind': 'image', 'file': f'{slug}/{name}', 'rect': clip, 'vector': True})
        tokens = [t for t in tokens if not inside(t, clip, 0)]

    info['tokens'] = tokens
    info['blocks'] = blocks
    info['opt_boxes'] = opt_boxes
    return info


def dedup(vals, tol=3):
    out = []
    for v in vals:
        if out and v - out[-1] < tol:
            continue
        out.append(v)
    return out


def save_image(doc, xref, path):
    pix = pymupdf.Pixmap(doc, xref)
    smask = doc.xref_get_key(xref, 'SMask')
    if smask[0] == 'xref':
        try:
            mask = pymupdf.Pixmap(doc, int(smask[1].split()[0]))
            pix = pymupdf.Pixmap(pix, mask)
        except Exception:
            pass
    if pix.colorspace and pix.colorspace.n not in (1, 3):
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    im = Image.open(io.BytesIO(pix.tobytes('png')))
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        im = bg
    im.convert('RGB').save(path, 'WEBP', quality=88)


# ---------------------------------------------------------------- lines and paragraphs
def make_lines(tokens):
    toks = sorted(tokens, key=lambda t: t.y)
    lines = []
    for t in toks:
        placed = False
        for ln in lines[-3:]:
            if abs(ln['y'] - t.y) < 3.2:
                ln['t'].append(t)
                placed = True
                break
        if not placed:
            lines.append({'y': t.y, 't': [t]})
    for ln in lines:
        ln['t'].sort(key=lambda t: t.x0)
        ln['x0'] = min(t.x0 for t in ln['t'])
        ln['x1'] = max(t.x1 for t in ln['t'])
        ln['top'] = min(t.top for t in ln['t'])
        ln['bottom'] = max(t.bottom for t in ln['t'])
        txt = [t for t in ln['t'] if t.kind == 'text' and t.text.strip()]
        ln['semi'] = bool(txt) and sum(t.semi for t in txt) > 0.6 * len(txt)
        ln['bold_all'] = bool(txt) and all(t.bold for t in txt)
        ln['math_only'] = not txt
        ln['size'] = statistics.median([t.size for t in ln['t']])
    lines.sort(key=lambda l: l['y'])
    return lines


def render_line(ln):
    out = ''
    bold = False
    ul = False
    for t in ln['t']:
        if t.kind == 'math':
            piece = '$' + t.text + '$' if t.text else ''
            b = False
        else:
            piece = t.text
            if piece == '$':
                piece = '\\$'
            if piece == '*':
                piece = '∗'
            b = t.bold and piece.strip() != ''
        u = t.ul and piece.strip() != ''
        if t.kind == 'text' and piece == ' ':
            out += ' '
            continue
        if b != bold:
            if bold:
                sp = out.endswith(' ') or piece[:1].isalnum() or piece[:1] in '$(<'
                out = out.rstrip() + '**' + (' ' if sp else '')
            else:
                out += '**'
            bold = b
        if u != ul:
            if ul:
                tail = ' ' if out.endswith(' ') else ''
                out = out.rstrip() + '</u>' + tail
            else:
                out += '<u>'
            ul = u
        out += piece
    if ul:
        out = out.rstrip() + '</u>'
    if bold:
        out = out.rstrip() + '**'
    out = re.sub(r'\*\*\s*\*\*', ' ', out)
    out = re.sub(r'</u>(\s*)<u>', r'\1', out)
    return re.sub(r'[ \t]+', ' ', out).strip()


def render_lines(lines):
    return [render_line(l) for l in lines]


def join_lines(texts, lines, right):
    out = ''
    for i, (t, ln) in enumerate(zip(texts, lines)):
        if i == 0:
            out = t
            continue
        prev = lines[i - 1]
        short = prev['x1'] < right - 70
        if short:
            out += '\n' + t
        elif re.search(r'[A-Za-z]-$|[—/–]$', out) or (out.endswith('-</u>')):
            out += t
        else:
            out += ' ' + t
    return out


def paragraphs(lines):
    """Group lines into paragraphs by vertical gaps, style changes and bullets."""
    paras = []
    for ln in lines:
        if not paras:
            paras.append([ln])
            continue
        prev = paras[-1][-1]
        gap = ln['top'] - prev['bottom']
        lh = ln['size']
        first = ln['t'][0]
        bullet = first.kind == 'text' and first.text in '•●'
        newp = gap > 0.55 * lh or ln['semi'] != prev['semi'] or bullet or ln['math_only'] != prev['math_only']
        if ln['math_only'] and prev['math_only'] and gap < 0.7 * lh:
            newp = False
        if newp:
            paras.append([ln])
        else:
            paras[-1].append(ln)
    return paras


# ---------------------------------------------------------------- questions
def split_questions(D):
    pages = []
    for pno in range(len(D.doc)):
        page = D.doc[pno]
        txt = page.get_text().strip()
        first = txt.split('\n')[0] if txt else ''
        pages.append((pno, first, txt))
    questions = []
    modules = []
    cur_mod = {'section': None, 'questions': []}
    for pno, first, txt in pages:
        m = re.match(r'^(Reading and Writing|Math)\nModule (\d)', txt)
        if m:
            if cur_mod['questions']:
                modules.append(cur_mod)
            cur_mod = {'section': 'Math' if m.group(1) == 'Math' else 'Reading & Writing', 'module': int(m.group(2)), 'questions': []}
            continue
        if re.match(r'^Question \d+ continued', first) or not re.search(r' · ', first) or not txt:
            if cur_mod['questions']:
                cur_mod['questions'][-1]['pages'].append(pno)
            continue
        cur_mod['questions'].append({'pages': [pno], 'skill': first})
    if cur_mod['questions']:
        modules.append(cur_mod)
    if modules and modules[0]['section'] is None:
        modules[0]['section'] = 'Reading & Writing'
        modules[0]['module'] = 1
    return modules


def build_question(D, q, img_dir, slug, counter, section):
    zone = 'stem'
    parts = {'stem': [], 'expl': [], 'A': [], 'B': [], 'C': [], 'D': []}
    answer = None
    for pno in q['pages']:
        info = analyse_page(D, pno, img_dir, slug, counter)
        if info.get('answer_raw'):
            answer = info['answer_raw']
        # assign tokens and blocks to zones
        markers = []
        for c, r in info['opt_boxes']:
            markers.append((r.y0, 'opt'))
        if info['spr_y'] is not None:
            markers.append((info['spr_y'], 'spr'))
        if info.get('answer_y') is not None:
            markers.append((info['answer_y'], 'answer'))
        if info['expl_y'] is not None:
            markers.append((info['expl_y'], 'expl'))
        markers.sort()

        def zone_of(y, rect=None):
            for c, r in info['opt_boxes']:
                if rect is not None:
                    if r.x0 - 2 <= rect.x0 and rect.x1 <= r.x1 + 2 and r.y0 - 2 <= rect.y0 and rect.y1 <= r.y1 + 2:
                        return c
                elif r.y0 - 1 <= y <= r.y1 + 1:
                    return c
            z = zone
            for my, mk in markers:
                if y >= my - 1:
                    z = {'opt': 'opts', 'spr': 'spr', 'answer': 'answer', 'expl': 'expl'}[mk]
            return z

        for t in info['tokens']:
            z = zone_of((t.top + t.bottom) / 2)
            if z in parts:
                parts[z].append(('tok', t, pno))
        for b in info['blocks']:
            z = zone_of(b['rect'].y0, b['rect'])
            if z in parts:
                parts[z].append(('blk', b, pno))
        if markers:
            zone = {'opt': 'opts', 'spr': 'spr', 'answer': 'answer', 'expl': 'expl'}[markers[-1][1]]
            if zone in ('opts', 'spr'):
                zone = 'opts'
    return assemble(parts, answer, section, q)


def zone_blocks(items, right=540):
    """items: [('tok', Token, pno) | ('blk', block, pno)] -> list of blocks: {'kind': 'p'|'math'|'table'|'image'|'li', 'text':..., 'semi':bool}"""
    out = []
    pages = sorted({p for _, _, p in items})
    for pno in pages:
        toks = [t for k, t, p in items if k == 'tok' and p == pno]
        blks = [b for k, b, p in items if k == 'blk' and p == pno]
        lines = make_lines(toks)
        paras = paragraphs(lines)
        seq = []
        for para in paras:
            seq.append((para[0]['top'], 'para', para))
        for b in blks:
            seq.append((b['rect'].y0, 'blk', b))
        seq.sort(key=lambda s: s[0])
        for _, kind, obj in seq:
            if kind == 'blk':
                if obj['kind'] == 'table':
                    out.append({'kind': 'table', 'text': obj['md']})
                else:
                    out.append({'kind': 'image', 'file': obj['file'], 'vector': obj.get('vector', False)})
                continue
            para = obj
            texts = render_lines(para)
            if all(l['math_only'] for l in para):
                for t in texts:
                    if t:
                        out.append({'kind': 'math', 'text': t})
                continue
            txt = join_lines(texts, para, right)
            first = para[0]['t'][0]
            if first.kind == 'text' and first.text in '•●':
                out.append({'kind': 'li', 'text': txt.lstrip('•● ').strip()})
            else:
                out.append({'kind': 'p', 'text': txt, 'semi': para[0]['semi'], 'bold_start': para[0]['t'][0].bold})
    return out


def blocks_to_md(blocks, img_base):
    parts = []
    lis = []
    for b in blocks:
        if b['kind'] == 'li':
            lis.append('- ' + b['text'])
            continue
        if lis:
            parts.append('\n'.join(lis))
            lis = []
        if b['kind'] == 'image':
            parts.append(f'![figure]({img_base}{b["file"]})')
        else:
            parts.append(b['text'])
    if lis:
        parts.append('\n'.join(lis))
    return '\n\n'.join(p for p in parts if p)


def assemble(parts, answer, section, q, img_base='/q/'):
    stem = zone_blocks(parts['stem'])
    opts = []
    for c in 'ABCD':
        if parts[c]:
            ob = zone_blocks(parts[c], right=530)
            opts.append(blocks_to_md(ob, img_base))
    expl_b = zone_blocks(parts['expl'])
    # explanation: paragraphs on their own lines; images dropped (not supported in explanations)
    expl_lines = []
    for b in expl_b:
        if b['kind'] == 'image':
            continue
        if b['kind'] == 'table':
            expl_lines.append(b['text'])
        elif b['kind'] == 'li':
            expl_lines.append('• ' + b['text'])
        else:
            expl_lines.append(b['text'])
    explanation = '\n'.join(expl_lines).strip()
    explanation = re.sub(r'^\*\*Explanation\*\*\s*', '', explanation)

    # passage / prompt split
    prompt_idx = [i for i, b in enumerate(stem) if b['kind'] == 'p' and b.get('semi')]
    if section == 'Reading & Writing':
        if prompt_idx:
            k = prompt_idx[0]
            passage_b = stem[:k] + [b for b in stem[k:] if not (b['kind'] == 'p' and b.get('semi'))]
            prompt = ' '.join(b['text'] for b in stem if b['kind'] == 'p' and b.get('semi'))
        else:
            passage_b = stem[:-1]
            prompt = stem[-1]['text'] if stem else ''
        passage = blocks_to_md(passage_b, img_base)
    else:
        visual = any(b['kind'] in ('table', 'image', 'li') for b in stem)
        if visual:
            last_p = max((i for i, b in enumerate(stem) if b['kind'] == 'p'), default=None)
            if last_p is not None and last_p > max(i for i, b in enumerate(stem) if b['kind'] in ('table', 'image', 'li')):
                passage = blocks_to_md(stem[:last_p] + stem[last_p + 1:], img_base)
                prompt = stem[last_p]['text']
            else:
                passage = blocks_to_md(stem, img_base)
                prompt = ''
        else:
            passage = ''
            prompt = '\n'.join(b['text'] for b in stem)
    # answer
    m = re.match(r'Correct answer:\s*(.+)$', (answer or '').strip())
    ans = m.group(1).strip() if m else None
    note = None
    if not ans:
        pat = r'\*\*Choice ([ABCD]) is correct\.?\*\*' if opts else r'\*\*The correct answer is (.+?)\.?\*\*'
        m2 = re.search(pat, explanation)
        if m2:
            ans = m2.group(1).replace('$', '').strip()
            note = 'answer taken from explanation'
    rec = {'skill': q['skill'], 'pages': [p + 1 for p in q['pages']], 'passage': passage, 'prompt': prompt, 'options': opts,
           'explanation': explanation, 'answer_raw': ans, 'note': note}
    if opts:
        rec['correct_index'] = 'ABCD'.index(ans) if ans in ('A', 'B', 'C', 'D') else None
    else:
        vals = [v.strip() for v in re.split(r'\s*(?:,\s+|;|\bor\b)\s*', ans or '') if v.strip()]
        rec['correct_answers'] = [v.replace('−', '-') for v in vals]
    return rec


def main(pdf, out_dir):
    D = Doc(pdf)
    base = os.path.splitext(os.path.basename(pdf))[0]
    m = re.match(r'peaklytest (\w{3}) (\d{2})$', base)
    slug = f'{m.group(1).lower()}{m.group(2)}'
    img_dir = os.path.join(out_dir, 'img', slug)
    os.makedirs(img_dir, exist_ok=True)
    counter = [0]
    modules = split_questions(D)
    out = {'source': os.path.basename(pdf), 'slug': slug, 'month': m.group(1), 'year': 2000 + int(m.group(2)), 'modules': []}
    for mod in modules:
        qs = []
        for q in mod['questions']:
            try:
                qs.append(build_question(D, q, img_dir, slug, counter, mod['section']))
            except Exception as e:  # keep going, report
                import traceback
                traceback.print_exc()
                qs.append({'error': repr(e), 'pages': [p + 1 for p in q['pages']]})
        out['modules'].append({'section': mod['section'], 'module': mod['module'], 'questions': qs})
    with open(os.path.join(out_dir, slug + '.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(slug, [(m['section'], m['module'], len(m['questions'])) for m in out['modules']])


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
