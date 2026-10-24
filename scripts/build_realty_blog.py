#!/usr/bin/env python3
"""realty.asendify.co blog: static build (2026-10-24, Manthan "yes all" to digest Y3: realty articles 404ed).

Source: Supabase shop_articles rows with product = 'realty' and status = 'published', read through the
read-only RPC public.realty_articles() (publishable key; it returns only published realty rows).
Run by scripts/realty_blog_ci.sh (GitHub Actions, .github/workflows/realty-blog.yml) or by hand:
    python3 scripts/build_realty_blog.py rows.json
Writes, in the site's own design (assets/css/style.css, same header and footer as the other pages):
  blog/<slug>/index.html for every published article, blog/index.html, blog-sitemap.xml,
  a <url> per article in sitemap.xml, a line per article in llms.txt and blog/_articles.json (manifest).
Prints one JSON line: {"total": n, "changed": [...], "skipped": [...], "indexnow_urls": [...]}.

Safety rules (built in, not left to the agent):
- Markdown is HTML-escaped first; only http(s), mailto and site-relative links survive. No raw HTML.
- Never overwrites a page this script didn't make (REALTY_MARK, or a slug from the old service-blog manifest).
- At most MAX_NEW new pages per run (spam brake); slugs must be kebab-case, max 80 chars.
"""
import datetime
import html
import json
import os
import re
import sys

SITE = 'https://realty.asendify.co'
MARK = '<!-- realty-article: built by scripts/build_realty_blog.py from shop_articles (product=realty) -->'
MANIFEST = 'blog/_articles.json'
COUNTER = 'scripts/visit_counter.html'
OG = f'{SITE}/blog/og.png'
MAX_NEW = 12
SLUG_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
LLMS_HEAD = '## Articles'


def esc(s):
    return html.escape(str(s or ''), quote=True)


# ---------- markdown (small, safe subset) ----------
def norm_url(u):
    # own blog links without the trailing slash would 301 on GitHub Pages
    m = re.match(r'^(https://realty\.asendify\.co)?(/blog/[a-z0-9-]+)$', u)
    return u + '/' if m else u


def safe_href(u):
    u = norm_url(html.unescape(u.strip()))
    if re.match(r'^(https?://|mailto:)', u, re.I) or (u.startswith('/') and not u.startswith('//')) or u.startswith('#'):
        return esc(u)
    return None


def is_ext(href):
    return href.startswith('http') and not re.match(r'^https?://([a-z0-9-]+\.)*asendify\.co(/|$)', html.unescape(href), re.I)


def inline(t):
    t = esc(t)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)

    def link(m):
        href = safe_href(m.group(2))
        if not href:
            return m.group(1)
        return f'<a href="{href}"' + (' rel="noopener"' if is_ext(href) else '') + f'>{m.group(1)}</a>'
    t = re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)', link, t)

    def auto(m):
        u = m.group(0).rstrip('.,;:)')
        rest = m.group(0)[len(u):]
        return f'<a href="{u}"' + (' rel="noopener"' if is_ext(u) else '') + f'>{u}</a>{rest}'
    t = re.sub(r'(?<![="\'>/\w])https?://[^\s<"]+', auto, t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![\w*])\*([^*\n]+)\*(?![\w*])', r'<em>\1</em>', t)
    return t


def md_to_html(md):
    lines = md.replace('\r\n', '\n').split('\n')
    out, para, i = [], [], 0

    def flush():
        if para:
            out.append('<p>' + inline(' '.join(x.strip() for x in para)) + '</p>')
            para.clear()
    while i < len(lines):
        s = lines[i].strip()
        if not s:
            flush(); i += 1; continue
        m = re.match(r'^(#{2,4})\s+(.*)$', s)
        if m:
            flush(); lvl = len(m.group(1))
            out.append(f'<h{lvl}>{inline(m.group(2).strip())}</h{lvl}>'); i += 1; continue
        if re.match(r'^#\s+', s):  # the page already has the H1
            flush(); i += 1; continue
        if re.match(r'^[-*]\s+', s) or re.match(r'^\d+[.)]\s+', s):
            flush(); ordered = bool(re.match(r'^\d', s)); items = []
            while i < len(lines) and (re.match(r'^\s*[-*]\s+', lines[i]) or re.match(r'^\s*\d+[.)]\s+', lines[i])):
                items.append(re.sub(r'^\s*(?:[-*]|\d+[.)])\s+', '', lines[i])); i += 1
            tag = 'ol' if ordered else 'ul'
            out.append(f'<{tag}>' + ''.join(f'<li>{inline(x)}</li>' for x in items) + f'</{tag}>'); continue
        if s.startswith('>'):
            flush(); q = []
            while i < len(lines) and lines[i].strip().startswith('>'):
                q.append(lines[i].strip()[1:].strip()); i += 1
            out.append('<blockquote><p>' + inline(' '.join(q)) + '</p></blockquote>'); continue
        if s.startswith('|') and i + 1 < len(lines) and re.match(r'^\s*\|?\s*:?-{3,}', lines[i + 1]):
            flush()
            head = [c.strip() for c in s.strip('|').split('|')]; i += 2; rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')]); i += 1
            t = '<div class="table-wrap"><table><thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in head) + '</tr></thead><tbody>'
            t += ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in rows) + '</tbody></table></div>'
            out.append(t); continue
        para.append(s); i += 1
    flush()
    return '\n'.join(out)


def faq_pairs(md):
    """### questions under a '## FAQ' / '## Frequently asked questions' heading."""
    m = re.search(r'^##\s+(?:FAQs?|Frequently asked questions)\b.*$', md, re.I | re.M)
    if not m:
        return []
    rest = md[m.end():]
    nxt = re.search(r'^##\s+', rest, re.M)
    if nxt:
        rest = rest[:nxt.start()]
    pairs = []
    for blk in re.split(r'^###\s+', rest, flags=re.M)[1:]:
        q, _, a = blk.partition('\n')
        a = re.split(r'\n\s*More guides on other topics:', a)[0]
        a = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', a)
        a = re.sub(r'[*_`>#]', '', ' '.join(x.strip() for x in a.strip().split('\n') if x.strip()))
        if q.strip() and a:
            pairs.append((q.strip(), a[:1000]))
    return pairs


def fmt_date(iso):
    d = datetime.datetime.fromisoformat(str(iso).replace('Z', '+00:00').replace(' ', 'T', 1))
    return d, f'{d.day} {d.strftime("%B %Y")}'


# ---------- shared shell (same header/footer as the calculator and area pages) ----------
CSS = ('<style>'
       '.post{padding:44px 0 30px}.post .wrap{max-width:780px}'
       '.crumbs{font-family:var(--font-mono);font-size:12.5px;color:var(--stone);margin:0 0 18px}.crumbs a{color:var(--brass)}'
       '.eyebrow{display:inline-block;font-family:var(--font-mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--brass);margin-bottom:12px}'
       '.post h1{font-family:var(--font-display);font-size:clamp(30px,5.4vw,44px);line-height:1.12;margin:0 0 14px}'
       '.updated{font-family:var(--font-mono);font-size:12.5px;color:var(--stone);margin:0 0 30px}'
       '.post-body{font-size:17px;line-height:1.75}.post-body p,.post-body li{color:#e2dccd}.post-body li{margin:0 0 8px}'
       '.post-body h2{font-family:var(--font-display);font-size:27px;line-height:1.25;margin:40px 0 12px}'
       '.post-body h3{font-size:19px;line-height:1.4;margin:28px 0 8px}'
       '.post-body a,.related a,.blog-list a h2{color:var(--brass-light)}.post-body a{text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}'
       '.post-body blockquote{margin:18px 0;padding:6px 16px;border-left:3px solid var(--brass);color:var(--stone)}'
       '.table-wrap{overflow-x:auto}.post-body table{width:100%;border-collapse:collapse;margin:18px 0;font-size:.95em}'
       '.post-body th,.post-body td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}'
       '.post-cta{border:1px solid rgba(212,175,55,.4);background:var(--paper-dim);padding:24px;margin:40px 0 10px}'
       '.post-cta h2{font-family:var(--font-display);font-size:24px;margin:0 0 8px}.post-cta p{color:var(--stone);margin:0 0 16px}'
       '.post-cta .btns{display:flex;gap:12px;flex-wrap:wrap}.post-cta .areas{margin:16px 0 0;font-size:14.5px}.post-cta .areas a{color:var(--brass-light)}'
       '.related{margin:34px 0 0;padding:22px 0 0;border-top:1px solid var(--line)}.related h2{font-family:var(--font-display);font-size:21px;margin:0 0 10px}'
       '.related li{margin:0 0 8px}'
       '.blog-list{list-style:none;padding:0;margin:10px 0 0}.blog-list li{border-top:1px solid var(--line);padding:20px 0}'
       '.blog-list a{display:block}.blog-list h2{font-family:var(--font-display);font-size:23px;line-height:1.3;margin:0 0 6px}'
       '.blog-list p{color:var(--stone);margin:0 0 6px}.blog-list .m{font-family:var(--font-mono);font-size:12px;color:var(--stone)}'
       '@media (max-width:600px){.post .wrap,.site-header .wrap,footer .wrap{padding:0 16px}.post{padding-top:30px}.site-header .btn{padding:9px 14px}}'
       '</style>')


def head(title, desc, url, kind, ld):
    t, d = esc(title), esc(desc)
    return ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
            f'<title>{t} | Asendify Realty</title>\n<meta name="description" content="{d}">\n'
            f'<link rel="canonical" href="{url}">\n<meta property="og:type" content="{kind}">\n'
            '<meta property="og:site_name" content="Asendify Realty">\n'
            f'<meta property="og:title" content="{t}">\n<meta property="og:description" content="{d}">\n'
            f'<meta property="og:url" content="{url}">\n<meta property="og:image" content="{OG}">\n'
            '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">\n'
            f'<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="{t}">\n'
            f'<meta name="twitter:description" content="{d}">\n<meta name="twitter:image" content="{OG}">\n'
            '<link rel="stylesheet" href="/assets/css/style.css?v=2">\n' + CSS + '\n'
            '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False).replace('</', '<\\/') + '</script>\n'
            '</head>\n<body>\n')


def header(camp):
    return ('<header class="site-header">\n  <div class="wrap">\n    <a href="/" class="brand">Asendify <span class="sub">Realty</span></a>\n'
            '    <nav class="nav-links">\n      <a href="/koregaon-park.html">Koregaon Park</a>\n'
            '      <a href="/kalyani-nagar.html">Kalyani Nagar</a>\n      <a href="/viman-nagar.html">Viman Nagar</a>\n'
            '      <a href="/listings.html">All Listings</a>\n      <a href="/blog/">Guides</a>\n'
            '    <a class="asd-books-nav" href="https://www.asendify.co/books/?utm_source=realty&amp;utm_medium=nav">Books</a></nav>\n'
            f'    <a class="btn btn-primary" href="/listings.html?utm_source=blog&amp;utm_medium=header&amp;utm_campaign={esc(camp)}">Browse listings</a>\n'
            '  </div>\n</header>\n')


FOOTER = ('<footer>\n  <div class="wrap">\n    <div>\n      <a href="/" class="brand">Asendify <span class="sub" style="color:var(--brass-light);">Realty</span></a>\n'
          '      <p>Rentals and resale in Koregaon Park, Kalyani Nagar and Viman Nagar, Pune. Message us on WhatsApp from any listing to get started.</p>\n'
          '    </div>\n    <div>\n      <p style="color:var(--ink);font-weight:600;margin-bottom:8px;">Browse</p>\n'
          '      <p><a href="/listings.html?type=rent">Properties for rent</a></p>\n'
          '      <p><a href="/listings.html?type=buy">Properties for sale</a></p>\n'
          '      <p><a href="/pune-rent-affordability-calculator/">Free rent affordability calculator</a></p>\n'
          '      <p><a href="/blog/">Pune renting guides</a></p>\n    </div>\n  </div>\n'
          '  <div class="wrap fine">&copy; 2026 Asendify Realty. Pune, Maharashtra. Guides are general information, not legal or financial advice.</div>\n'
          '<div class="asd-books-line" style="text-align:center;padding:14px 16px 4px;font-size:14px"><a class="asd-books-foot" href="https://www.asendify.co/books/?utm_source=realty&amp;utm_medium=footer" style="color:#d4af37;text-decoration:none;font-weight:600">Asendify Books: practical playbooks &rarr;</a></div></footer>\n'
          '<script src="/assets/js/blossom.js?v=5" defer></script>\n<script src="/asd-booksbar.js" data-src="realty" defer></script>\n')


def tail():
    c = open(COUNTER, encoding='utf-8').read().rstrip() if os.path.exists(COUNTER) else ''
    return FOOTER + c + '\n</body>\n</html>\n'


def minutes(h):
    return max(3, round(len(re.sub(r'<[^>]+>', ' ', h).split()) / 230))


# ---------- pages ----------
def article(r, others):
    slug, title, desc = r['slug'], r['title'].strip(), (r.get('description') or '').strip()
    url = f'{SITE}/blog/{slug}/'
    md = r.get('body_md') or ''
    body = md_to_html(md)
    mins = minutes(body)
    pub_d, pub = fmt_date(r['published_at'])
    upd_d, upd = fmt_date(r.get('updated_at') or r['published_at'])
    org = {'@type': 'Organization', 'name': 'Asendify Realty', 'url': f'{SITE}/'}
    graph = [{'@type': 'Article', 'headline': title[:110], 'description': desc,
              'datePublished': pub_d.isoformat(), 'dateModified': upd_d.isoformat(), 'image': OG,
              'mainEntityOfPage': url, 'inLanguage': 'en-IN', 'author': org,
              'publisher': {'@type': 'Organization', 'name': 'Asendify', 'url': 'https://www.asendify.co/'}}]
    faqs = faq_pairs(md)
    if faqs:
        graph.append({'@type': 'FAQPage', 'mainEntity': [
            {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faqs]})
    graph.append({'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'Asendify Realty', 'item': f'{SITE}/'},
        {'@type': 'ListItem', 'position': 2, 'name': 'Guides', 'item': f'{SITE}/blog/'},
        {'@type': 'ListItem', 'position': 3, 'name': title, 'item': url}]})
    rel = ''
    if others:
        rel = ('<aside class="related"><h2>More Pune renting guides</h2><ul>' +
               ''.join(f'<li><a href="/blog/{esc(o["slug"])}/">{esc(o["title"].strip())}</a></li>' for o in others[:5]) +
               '</ul><p><a href="/blog/">All guides</a></p></aside>\n')
    u = f'utm_source=blog&amp;utm_medium=article&amp;utm_campaign={esc(slug)}'
    main = (f'<main>\n{MARK}\n<article class="post"><div class="wrap">\n'
            '  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Asendify Realty</a> / <a href="/blog/">Guides</a></nav>\n'
            '  <span class="eyebrow">Guide · Pune</span>\n'
            f'  <h1>{esc(title)}</h1>\n'
            f'  <p class="updated">Published <time datetime="{pub_d.date().isoformat()}">{pub}</time> · '
            f'Last updated: <time datetime="{upd_d.date().isoformat()}">{upd}</time> · {mins} min read</p>\n'
            f'  <div class="post-body">\n{body}\n  </div>\n'
            '  <div class="post-cta">\n    <h2>Looking for a flat in Pune?</h2>\n'
            '    <p>Asendify Realty lists homes to rent and buy in Koregaon Park, Kalyani Nagar and Viman Nagar, with the rent or price and brokerage on every listing. Enquire on WhatsApp.</p>\n'
            f'    <div class="btns"><a class="btn btn-primary" href="/listings.html?type=rent&amp;{u}">Flats for rent</a>'
            f'<a class="btn btn-outline" href="/listings.html?{u}">All listings</a></div>\n'
            '    <p class="areas">By area: <a href="/koregaon-park.html">Koregaon Park</a> · <a href="/kalyani-nagar.html">Kalyani Nagar</a> · '
            '<a href="/viman-nagar.html">Viman Nagar</a> · <a href="/pune-rent-affordability-calculator/">Rent affordability calculator</a> · '
            '<a href="/">Asendify Realty home</a></p>\n  </div>\n'
            + rel + '</div></article>\n</main>\n')
    return head(title, desc, url, 'article', {'@context': 'https://schema.org', '@graph': graph}) + header(slug) + main + tail()


def index_page(rows):
    url = f'{SITE}/blog/'
    title = 'Pune renting guides: Koregaon Park, Kalyani Nagar and Viman Nagar'
    desc = 'Free, practical guides from Asendify Realty on renting and buying a home in Pune: finding a flat, leave and licence agreements, deposits, brokerage and more.'
    items = []
    for r in rows:
        _, upd = fmt_date(r.get('updated_at') or r['published_at'])
        items.append(f'<li><a href="/blog/{esc(r["slug"])}/"><h2>{esc(r["title"].strip())}</h2></a>'
                     f'<p>{esc((r.get("description") or "").strip())}</p><span class="m">Last updated {upd}</span></li>')
    dates = [fmt_date(r.get('updated_at') or r['published_at'])[0] for r in rows]
    newest = max(dates) if dates else datetime.datetime.now(datetime.timezone.utc)
    ld = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'CollectionPage', 'name': title, 'description': desc, 'url': url, 'inLanguage': 'en-IN',
         'isPartOf': {'@type': 'WebSite', 'name': 'Asendify Realty', 'url': f'{SITE}/'},
         'mainEntity': {'@type': 'ItemList', 'itemListElement': [
             {'@type': 'ListItem', 'position': i + 1, 'url': f'{SITE}/blog/{r["slug"]}/', 'name': r['title'].strip()} for i, r in enumerate(rows)]}},
        {'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Asendify Realty', 'item': f'{SITE}/'},
            {'@type': 'ListItem', 'position': 2, 'name': 'Guides', 'item': url}]}]}
    main = (f'<main>\n{MARK}\n<section class="post"><div class="wrap">\n'
            '  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Asendify Realty</a> / Guides</nav>\n'
            '  <span class="eyebrow">Guides · Pune</span>\n  <h1>Pune renting guides</h1>\n'
            f'  <p class="updated">Last updated: <time datetime="{newest.date().isoformat()}">{newest.day} {newest.strftime("%B %Y")}</time> · {len(rows)} guides</p>\n'
            '  <p class="post-body">Practical, plain-English guides to renting and buying a home in Koregaon Park, Kalyani Nagar and Viman Nagar. '
            'Ready to look? <a href="/listings.html?utm_source=blog&amp;utm_medium=index">See the listings</a>.</p>\n'
            '  <ul class="blog-list">' + ''.join(items) + '</ul>\n'
            '  <div class="post-cta">\n    <h2>Find your next home</h2>\n'
            '    <p>Homes to rent and buy in Koregaon Park, Kalyani Nagar and Viman Nagar, with the price and brokerage on every listing.</p>\n'
            '    <div class="btns"><a class="btn btn-primary" href="/listings.html?type=rent&amp;utm_source=blog&amp;utm_medium=index">Flats for rent</a>'
            '<a class="btn btn-outline" href="/">Asendify Realty home</a></div>\n  </div>\n'
            '</div></section>\n</main>\n')
    return head(title, desc, url, 'website', ld) + header('blog-index') + main + tail()


# ---------- sitemaps, llms ----------
def lastmod(r):
    return fmt_date(r.get('updated_at') or r['published_at'])[0].date().isoformat()


def blog_sitemap(rows):
    newest = max((lastmod(r) for r in rows), default=datetime.date.today().isoformat())
    u = [f'  <url><loc>{SITE}/blog/</loc><lastmod>{newest}</lastmod><priority>0.8</priority></url>']
    u += [f'  <url><loc>{SITE}/blog/{r["slug"]}/</loc><lastmod>{lastmod(r)}</lastmod><priority>0.7</priority></url>' for r in rows]
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(u) + '\n</urlset>\n'


def sitemap(url, mod, prio):
    p = 'sitemap.xml'
    t = open(p, encoding='utf-8').read()
    loc = f'<loc>{url}</loc>'
    if loc in t:
        t2 = re.sub(re.escape(loc) + r'\s*<lastmod>[^<]*</lastmod>', f'{loc}\n    <lastmod>{mod}</lastmod>', t, count=1)
    else:
        t2 = t.replace('</urlset>', f'  <url>\n    {loc}\n    <lastmod>{mod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>{prio}</priority>\n  </url>\n</urlset>', 1)
    if t2 != t:
        open(p, 'w', encoding='utf-8').write(t2)


def llms(url, title, desc):
    p = 'llms.txt'
    if not os.path.exists(p):
        return
    t = open(p, encoding='utf-8').read()
    if f']({url})' in t:
        return
    line = f'- [{title}]({url}): {desc}'.replace('\n', ' ')
    if ('\n' + LLMS_HEAD + '\n') in t:
        a = t.index('\n' + LLMS_HEAD + '\n') + len(LLMS_HEAD) + 2
        nxt = t.find('\n## ', a)
        if nxt < 0:
            t = t.rstrip('\n') + '\n' + line + '\n'
        else:
            t = t[:nxt].rstrip('\n') + '\n' + line + '\n' + t[nxt:]
    else:
        t = t.rstrip('\n') + f'\n\n{LLMS_HEAD}\n- [Articles]({SITE}/blog/): practical guides, new ones published regularly.\n{line}\n'
    open(p, 'w', encoding='utf-8').write(t)


def write_if_changed(p, s):
    old = open(p, encoding='utf-8').read() if os.path.exists(p) else None
    if old != s:
        os.makedirs(os.path.dirname(p) or '.', exist_ok=True)
        open(p, 'w', encoding='utf-8').write(s)
        return True
    return False


def main():
    rows_in = json.load(open(sys.argv[1], encoding='utf-8'))
    if not isinstance(rows_in, list):
        raise SystemExit('rows file is not a list')
    legacy = set()
    if os.path.exists(MANIFEST):
        try:
            legacy = {x.get('slug') for x in json.load(open(MANIFEST, encoding='utf-8'))}
        except Exception:
            pass
    rows, skipped = [], []
    for r in rows_in:
        slug = str(r.get('slug') or '')
        if (not SLUG_RE.match(slug) or len(slug) > 80 or not (r.get('title') or '').strip()
                or not (r.get('body_md') or '').strip() or not r.get('published_at')):
            skipped.append(f'{slug}: invalid row'); continue
        rows.append(r)
    rows.sort(key=lambda x: str(x.get('published_at')), reverse=True)
    changed, built, new_count = [], [], 0
    for r in sorted(rows, key=lambda x: str(x.get('published_at'))):
        slug = r['slug']
        out = f'blog/{slug}/index.html'
        old = open(out, encoding='utf-8').read() if os.path.exists(out) else None
        if old is not None and MARK not in old and slug not in legacy:
            skipped.append(f'{slug}: a hand-made page already uses this slug'); continue
        if old is None and new_count >= MAX_NEW:
            skipped.append(f'{slug}: over the {MAX_NEW}-new-pages-per-run brake, next run'); continue
        if old is None:
            new_count += 1
        built.append(r)
    built.sort(key=lambda x: str(x.get('published_at')), reverse=True)
    for r in built:
        slug = r['slug']
        out = f'blog/{slug}/index.html'
        if write_if_changed(out, article(r, [o for o in built if o['slug'] != slug])):
            changed.append(slug)
    idx_changed = write_if_changed('blog/index.html', index_page(built))
    write_if_changed('blog-sitemap.xml', blog_sitemap(built))
    if built:
        sitemap(f'{SITE}/blog/', max(lastmod(r) for r in built), '0.8')
    for r in sorted(built, key=lambda x: str(x.get('published_at'))):
        url = f'{SITE}/blog/{r["slug"]}/'
        sitemap(url, lastmod(r), '0.7')
        llms(url, r['title'].strip(), (r.get('description') or '').strip())
    man = [{k: r.get(k) for k in ('slug', 'title', 'description', 'keyword', 'body_md', 'published_at', 'updated_at')} for r in built]
    write_if_changed(MANIFEST, json.dumps(man, ensure_ascii=False, indent=1) + '\n')
    urls = [f'{SITE}/blog/{s}/' for s in changed]
    print(json.dumps({'total': len(rows_in), 'built': len(built), 'changed': changed, 'index_changed': idx_changed,
                      'skipped': skipped, 'indexnow_urls': urls + ([f'{SITE}/blog/', f'{SITE}/sitemap.xml'] if urls else [])}))


if __name__ == '__main__':
    main()
