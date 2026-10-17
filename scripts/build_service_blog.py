#!/usr/bin/env python3
"""Nightly service-blog build for the GitHub Pages sites (2026-10-17).
Articles are written into Supabase shop_articles by the nightly agent and rendered by
https://playbook.asendify.co/api/blog?svc=<key>. This copies them into static files:
  blog/<slug>/index.html, blog index cards, blog-sitemap.xml, then pings IndexNow.
Usage: python3 scripts/build_service_blog.py <svc> <mode>   (mode: template | shell)
"""
import json, re, sys, os, html, urllib.request, datetime

API = 'https://playbook.asendify.co/api/blog'
svc, mode = sys.argv[1], sys.argv[2]
TEMPLATE = 'blog/how-to-get-more-watch-time-on-youtube/index.html'

def get(qs, raw=False):
    req = urllib.request.Request(f'{API}?svc={svc}&{qs}', headers={'User-Agent': 'asendify-blog-build'})
    with urllib.request.urlopen(req, timeout=60) as r:
        b = r.read().decode('utf-8')
    return b if raw else json.loads(b)

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
    exp = get('export=1')
    new = []
    for a in exp['articles']:
        slug = re.sub(r'[^a-z0-9-]', '', a['slug'].lower())
        out = f'blog/{slug}/index.html'
        if mode == 'template':
            f = get(f'slug={slug}&fragment=1')
            page = from_template(f)
        else:
            page = get(f'slug={slug}', raw=True)
        old = open(out, encoding='utf-8').read() if os.path.exists(out) else None
        if old != page:
            os.makedirs(os.path.dirname(out), exist_ok=True)
            open(out, 'w', encoding='utf-8').write(page)
            new.append(slug)
        if mode == 'template':
            add_card(f, minutes(f['html']))
    if mode == 'shell':
        idx = get('', raw=True)
        os.makedirs('blog', exist_ok=True)
        if not os.path.exists('blog/index.html') or open('blog/index.html', encoding='utf-8').read() != idx:
            open('blog/index.html', 'w', encoding='utf-8').write(idx)
    sm = get('sitemap=1', raw=True)
    open('blog-sitemap.xml', 'w', encoding='utf-8').write(sm)
    print(json.dumps({'svc': svc, 'articles': len(exp['articles']), 'changed': new}))
    with open(os.environ.get('GITHUB_OUTPUT', os.devnull), 'a') as o:
        o.write(f'changed={len(new)}\n')

main()
