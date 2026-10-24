#!/usr/bin/env python3
"""Service-blog static build for the GitHub Pages sites (2026-10-17).
The nightly agent writes articles into Supabase shop_articles (product = agency | realty). It then saves the
new/changed rows (slug,title,description,keyword,body_md,status,published_at,updated_at) as a JSON list and runs:
  python3 scripts/build_service_blog.py <svc> <template|shell> <rows.json>
This merges them into blog/_articles.json, renders each page with the same code as
playbook.asendify.co/api/blog?svc=<svc> (via ../asendify-shop/scripts/render_static.mjs), writes
blog/<slug>/index.html, the blog index and blog-sitemap.xml. Then: git add -A blog blog-sitemap.xml, commit, push,
and IndexNow for the new URLs.
"""
import json, re, sys, os, html, subprocess, datetime, tempfile

svc, mode, rows_file = sys.argv[1], sys.argv[2], sys.argv[3]
if svc == 'realty':  # 2026-10-24: realty.asendify.co/blog is built by scripts/build_realty_blog.py (nightly workflow)
    raise SystemExit('realty: use scripts/build_realty_blog.py (Realty blog workflow), not this script')
SHOP = os.environ.get('SHOP_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'asendify-shop'))
TEMPLATE = 'blog/how-to-get-more-watch-time-on-youtube/index.html'
MANIFEST = 'blog/_articles.json'
_ALL = None
COUNTER = 'scripts/visit_counter.html'  # 2026-10-22: real-visit counter snippet (shell mode); template mode pages already load it

def add_counter(page):
    if not os.path.exists(COUNTER) or 'api/ref' in page: return page
    return page.replace('</body>', open(COUNTER, encoding='utf-8').read().rstrip() + '\n</body>', 1)

def get(qs, raw=False):
    r = subprocess.run(['node', os.path.join(SHOP, 'scripts', 'render_static.mjs'), _ALL, f'svc={svc}&{qs}'], capture_output=True, text=True, timeout=120)
    if r.returncode: raise SystemExit(f'render failed for {qs}: {r.stderr[-500:]}')
    return r.stdout if raw else json.loads(r.stdout)

def esc(s): return html.escape(str(s or ''), quote=True)

def strip_cta(h): return re.sub(r'<div class="cta(?: big)?"><div>.*?</div><a class="btn"[^>]*>.*?</a></div>', '', h, flags=re.S)

def minutes(h): return max(3, round(len(re.sub('<[^>]+>', ' ', h).split()) / 230))

def from_template(f):
    t = open(TEMPLATE, encoding='utf-8').read()
    title, desc, canon = esc(f['title']), esc(f['description']), esc(f['canonical'])
    body = strip_cta(f['html'])
    d = datetime.datetime.fromisoformat(f['published_at'].replace('Z', '+00:00'))
    date = f"{d.day} {d.strftime('%B %Y')}"
    reps = [
        (r'<title>.*?</title>', f'<title>{title}</title>'),
        (r'<meta name="description" content="[^"]*"', f'<meta name="description" content="{desc}"'),
        (r'<link rel="canonical" href="[^"]*"', f'<link rel="canonical" href="{canon}"'),
        (r'<meta property="og:title" content="[^"]*"', f'<meta property="og:title" content="{title}"'),
        (r'<meta property="og:description" content="[^"]*"', f'<meta property="og:description" content="{desc}"'),
        (r'<meta property="og:url" content="[^"]*"', f'<meta property="og:url" content="{canon}"'),
        (r'<meta name="twitter:title" content="[^"]*"', f'<meta name="twitter:title" content="{title}"'),
        (r'<meta name="twitter:description" content="[^"]*"', f'<meta name="twitter:description" content="{desc}"'),
        (r'<h1 class="post-title">.*?</h1>', f'<h1 class="post-title">{title}</h1>'),
        (r'<p class="post-meta">.*?</p>', f'<p class="post-meta">By <a href="../../founder">Manthan Bhendkar</a> · {minutes(body)} min read · Published {date}</p>'),
    ]
    for pat, rep in reps:
        t, n = re.subn(pat, lambda m: rep, t, count=1, flags=re.S)
        if not n: raise SystemExit(f'template piece missing: {pat}')
    # JSON-LD: replace every ld+json block with the article's own
    t = re.sub(r'<script type="application/ld\+json">.*?</script>', '', t, flags=re.S)
    ld = json.dumps(f['jsonld']).replace('</', '<\\/')
    t = t.replace('</head>', '<script type="application/ld+json">' + ld + '</script>\n</head>', 1)
    start = t.index('<div class="svc-copy post-body">') + len('<div class="svc-copy post-body">')
    end = t.index('<div class="post-cta">', start)
    end = t.rindex('</div>', start, end)
    return t[:start] + '\n' + body + '\n\n                ' + t[end:]

def add_card(f, mins):
    p = 'blog/index.html'
    t = open(p, encoding='utf-8').read()
    href = f'{f["slug"]}/'
    if f'href="{href}"' in t: return
    card = (f'\n                <a class="post-card" href="{href}">\n                    <span class="section-tag">Guide</span>\n'
            f'                    <h2>{esc(f["title"])}</h2>\n                    <p>{esc(f["description"])}</p>\n'
            f'                    <span class="post-card-more">Read article ({mins} min) →</span>\n                </a>')
    t = t.replace('<div class="post-grid">', '<div class="post-grid">' + card, 1)
    open(p, 'w', encoding='utf-8').write(t)

def main():
    global _ALL
    new = json.load(open(rows_file, encoding='utf-8'))
    man = json.load(open(MANIFEST, encoding='utf-8')) if os.path.exists(MANIFEST) else []
    by = {r['slug']: r for r in man}
    for r in new:
        r['slug'] = re.sub(r'[^a-z0-9-]', '', r['slug'].lower())
        by[r['slug']] = {k: r.get(k) for k in ('slug', 'title', 'description', 'keyword', 'body_md', 'status', 'published_at', 'updated_at')}
    rows = sorted(by.values(), key=lambda r: r['published_at'] or '', reverse=True)
    os.makedirs('blog', exist_ok=True)
    json.dump(rows, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    tf = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8'); json.dump(rows, tf); tf.close(); _ALL = tf.name
    live = {a['slug'] for a in get('export=1')['articles']}
    changed = []
    for slug in [r['slug'] for r in new]:
        if slug not in live: print('not live yet (status/published_at):', slug); continue
        out = f'blog/{slug}/index.html'
        if mode == 'template':
            f = get(f'slug={slug}&fragment=1'); page = from_template(f)
        else:
            page = add_counter(get(f'slug={slug}', raw=True))
        old = open(out, encoding='utf-8').read() if os.path.exists(out) else None
        if old != page:
            os.makedirs(os.path.dirname(out), exist_ok=True)
            open(out, 'w', encoding='utf-8').write(page); changed.append(slug)
        if mode == 'template': add_card(f, minutes(f['html']))
    if mode == 'shell':
        open('blog/index.html', 'w', encoding='utf-8').write(add_counter(get('', raw=True)))
    open('blog-sitemap.xml', 'w', encoding='utf-8').write(get('sitemap=1', raw=True))
    os.unlink(_ALL)
    site = 'https://www.asendify.co' if svc == 'agency' else 'https://realty.asendify.co'
    print(json.dumps({'svc': svc, 'total': len(rows), 'changed': changed, 'indexnow_urls': [f'{site}/blog/{s}/' for s in changed] + ([f'{site}/blog/'] if changed else [])}))

main()
