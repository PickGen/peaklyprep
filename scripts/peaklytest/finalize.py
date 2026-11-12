"""Merge answer keys and fixes into extracted JSON and normalise text.

Usage: python -I finalize.py <in_dir> <out_dir> [keys.tsv] [patches.tsv]
keys.tsv:    slug  module_index  question_no  answer(s, '|'-separated for typed answers)  explanation
patches.tsv: slug  module_index  question_no  old_text  new_text
"""
import glob
import json
import os
import re
import shutil
import sys

in_dir, out_dir = sys.argv[1], sys.argv[2]
keys_f = sys.argv[3] if len(sys.argv) > 3 else None
patches_f = sys.argv[4] if len(sys.argv) > 4 else None


def read_tsv(path, n):
    rows = []
    if path and os.path.exists(path):
        for line in open(path, encoding='utf-8'):
            line = line.rstrip('\n')
            if line.strip():
                parts = line.split('\t')
                assert len(parts) == n, (path, line)
                rows.append(parts)
    return rows


keys = {(s, int(m), int(q)): (a, e) for s, m, q, a, e in read_tsv(keys_f, 5)}
patches = {}
for s, m, q, old, new in read_tsv(patches_f, 5):
    patches.setdefault((s, int(m), int(q)), []).append((old, new))

SPLIT = re.compile(r'(?<!\\)\$\$')  # "$a$$b$" -> "$ab$" (two formulas that touch)


def unbold(par):
    # a paragraph that is bold from start to end (apart from math) is just the source's styling
    rest = re.sub(r'\*\*[^*]*\*\*|\$[^$]*\$|[\s.,;:?!()]', '', par)
    if par.count('**') >= 2 and not rest:
        return par.replace('**', '')
    return par


ROOT = re.compile(r'\\sqrt\{\^\{(\d)\}\s*')  # cube root "\sqrt{^{3} 27}" -> "^{3}\sqrt{27}"


SUPS = re.compile(r'\^\{([^{}]*)\}\^\{')  # "^{x+}^{\frac{1}{4}}" -> "^{x+\frac{1}{4}}"


def math_fix(text):
    text = ROOT.sub(lambda m: '^{' + m.group(1) + '}\\sqrt{', SPLIT.sub('', text))
    return SUPS.sub(lambda m: '^{' + m.group(1), text)


def clean(text, para_sep, min_len=0):
    text = math_fix(text)
    return para_sep.join(unbold(p) if len(p) >= min_len else p for p in text.split(para_sep))


os.makedirs(out_dir, exist_ok=True)
used_keys, used_patches = set(), set()
for jf in sorted(glob.glob(os.path.join(in_dir, '*.json'))):
    d = json.load(open(jf, encoding='utf-8'))
    for mi, m in enumerate(d['modules']):
        for qi, q in enumerate(m['questions']):
            k = (d['slug'], mi, qi + 1)
            for old, new in patches.get(k, []):
                hit = False
                for f in ('passage', 'prompt', 'explanation'):
                    if old in q[f]:
                        q[f] = q[f].replace(old, new)
                        hit = True
                for i, o in enumerate(q['options']):
                    if old in o:
                        q['options'][i] = o.replace(old, new)
                        hit = True
                assert hit, ('patch not applied', k, old)
                used_patches.add(k)
            q['passage'] = clean(q['passage'], '\n\n', 120)  # short bold lines (Text 1, table titles) are real headings
            q['prompt'] = clean(q['prompt'], '\n')
            q['options'] = [math_fix(o) for o in q['options']]
            q['explanation'] = math_fix(q['explanation'])
            if k in keys:
                ans, expl = keys[k]
                used_keys.add(k)
                if q['options']:
                    assert ans in 'ABCD' and len(ans) == 1, (k, ans)
                    q['correct_index'] = 'ABCD'.index(ans)
                else:
                    q['correct_answers'] = ans.split('|')
                q['explanation'] = expl
                q['note'] = 'answer key written by PeaklyPrep'
    json.dump(d, open(os.path.join(out_dir, os.path.basename(jf)), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
assert used_keys == set(keys), ('unused keys', set(keys) - used_keys)
img = os.path.join(in_dir, 'img')
if os.path.isdir(img):
    shutil.copytree(img, os.path.join(out_dir, 'img'), dirs_exist_ok=True)
print('ok', len(used_keys), 'keys,', len(used_patches), 'patched questions')
