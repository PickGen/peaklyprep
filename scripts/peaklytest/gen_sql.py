"""Turn extracted JSON files into Supabase migrations (one per practice test) and copy figures into public/q/.

Usage: python -I gen_sql.py <json_dir> <repo_dir> <first_migration_number>
"""
import glob
import json
import os
import shutil
import sys
import uuid

json_dir, repo, first_no = sys.argv[1], sys.argv[2], int(sys.argv[3])
NS = uuid.UUID('7b0c6a52-5d2e-4c4e-9a59-2f1c8e0d7a11')  # fixed namespace -> stable ids, safe to re-run
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
FULL = {'Mar': 'March', 'May': 'May', 'Jun': 'June', 'Aug': 'August', 'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'}


def q(s):
    return "'" + s.replace("'", "''") + "'"


def arr(xs):
    return 'array[' + ', '.join(q(x) for x in xs) + ']::text[]'


tests = []
for jf in glob.glob(os.path.join(json_dir, '*.json')):
    tests.append(json.load(open(jf, encoding='utf-8')))
tests.sort(key=lambda t: (t['year'], MONTHS.index(t['month'])))

mig_dir = os.path.join(repo, 'supabase', 'migrations')
img_root = os.path.join(repo, 'public', 'q')
summary = []
n_tests = len(tests)
for k, t in enumerate(tests):
    no = first_no + k
    name = f"PeaklyTest {t['month']} {t['year']}"
    slug = t['slug']
    rank = n_tests - 1 - k  # newest test first
    lines = [
        f"-- PeaklyPrep: {name} — full practice test from the PeaklyTest library ({FULL.get(t['month'], t['month'])} {t['year']} form) --------",
        "-- Generated from the PeaklyTest PDF: questions, answer choices, answer keys and explanations.",
        "-- Figures live in public/q/" + slug + "/. Ids are fixed, so running this file again updates the test instead of copying it.",
    ]
    if any(q.get('note') == 'answer key written by PeaklyPrep' for m in t['modules'] for q in m['questions']):
        lines.append("-- The source PDF has no answers: the answer keys and short explanations were written by PeaklyPrep.")
    lines.append('')
    counts = []
    for mi, m in enumerate(t['modules']):
        sec = m['section']
        form = f"{name} · {sec}"
        title = f"{form} · Module {m['module']}"
        tid = uuid.uuid5(NS, f"{slug}/{sec}/{m['module']}")
        dur = 32 if sec == 'Reading & Writing' else 35
        nq = len(m['questions'])
        pos = 100 + rank * 10 + mi
        desc = f"{sec}, Module {m['module']} of the {t['month']} {t['year']} PeaklyTest · {nq} questions · {dur} minutes"
        lines.append(f"-- {title}")
        lines.append(
            "insert into public.tests (id, title, section, description, duration_min, position, published, form_title, module_no)\n"
            f"values ({q(str(tid))}, {q(title)}, {q(sec)}, {q(desc)}, {dur}, {pos}, true, {q(form)}, {m['module']})\n"
            "on conflict (id) do update set title = excluded.title, section = excluded.section, description = excluded.description,\n"
            "  duration_min = excluded.duration_min, position = excluded.position, form_title = excluded.form_title, module_no = excluded.module_no;"
        )
        qrows = []
        krows = []
        for i, qq in enumerate(m['questions']):
            qid = uuid.uuid5(NS, f"{slug}/{sec}/{m['module']}/{i + 1}")
            passage = qq['passage'].strip()
            opts = json.dumps(qq['options'], ensure_ascii=False)
            qrows.append(f"  ({q(str(qid))}, {q(str(tid))}, {q(qq['prompt'].strip())}, {q(opts)}::jsonb, {i + 1}, {q(passage) if passage else 'null'})")
            if qq['options']:
                ci = qq['correct_index']
                assert ci is not None, (slug, sec, m['module'], i + 1)
                krows.append(f"  ({q(str(qid))}, {ci}, null, {q(qq['explanation'])})")
            else:
                assert qq['correct_answers'], (slug, sec, m['module'], i + 1)
                krows.append(f"  ({q(str(qid))}, null, {arr(qq['correct_answers'])}, {q(qq['explanation'])})")
        lines.append(
            "insert into public.questions (id, test_id, prompt, options, position, passage) values\n" + ',\n'.join(qrows) +
            "\non conflict (id) do update set test_id = excluded.test_id, prompt = excluded.prompt, options = excluded.options,\n"
            "  position = excluded.position, passage = excluded.passage;"
        )
        lines.append(
            "insert into public.question_keys (question_id, correct_index, correct_answers, explanation) values\n" + ',\n'.join(krows) +
            "\non conflict (question_id) do update set correct_index = excluded.correct_index, correct_answers = excluded.correct_answers,\n"
            "  explanation = excluded.explanation;"
        )
        lines.append('')
        counts.append(f"{sec[:4]} M{m['module']}: {nq}")
    fname = f"20260101{no:06d}_peaklytest_{t['year']}_{MONTHS.index(t['month']) + 1:02d}.sql"
    with open(os.path.join(mig_dir, fname), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))
    src = os.path.join(json_dir, 'img', slug)
    if os.path.isdir(src) and os.listdir(src):
        dst = os.path.join(img_root, slug)
        if os.path.isdir(dst):
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
    summary.append((fname, name, counts))
for s in summary:
    print(*s)
