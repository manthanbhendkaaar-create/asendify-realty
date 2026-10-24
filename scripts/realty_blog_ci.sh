#!/usr/bin/env bash
# realty_blog_ci.sh (2026-10-24): run by .github/workflows/realty-blog.yml on GitHub's servers.
# Reads published realty.asendify.co articles (Supabase shop_articles, product='realty') through the read-only
# RPC public.realty_articles(), renders them with scripts/build_realty_blog.py and commits only blog/,
# sitemap.xml, blog-sitemap.xml and llms.txt to main. No secrets needed: the publishable key below only reaches
# that RPC (same key and pattern as asendify's hub_publish_ci.sh).
set -euo pipefail
SUPA=https://capsmeqrpeholfjewwwj.supabase.co
ANON=sb_publishable_yow9WLNOTbvm_Y2oXWUTvQ_FpT-f5FJ
OUT_FILE=${OUT_FILE:-/tmp/realty_out.json}
ROWS=/tmp/realty_rows.json

curl -fsS --retry 3 --max-time 60 -X POST "$SUPA/rest/v1/rpc/realty_articles" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H 'Content-Type: application/json' -d '{}' -o "$ROWS"
python3 -c "import json,sys; d=json.load(open('$ROWS')); assert isinstance(d, list); print(len(d), 'published realty rows')"

python3 -B scripts/build_realty_blog.py "$ROWS" > "$OUT_FILE"
cat "$OUT_FILE"

if [ -z "$(git status --porcelain)" ]; then echo "up to date"; echo "changed=0" >> "${GITHUB_OUTPUT:-/dev/null}"; exit 0; fi
BAD=$(git status --porcelain --untracked-files=all | awk '{print $2}' | grep -v -E '^(blog/|sitemap\.xml$|blog-sitemap\.xml$|llms\.txt$)' || true)
if [ -n "$BAD" ]; then echo "unexpected files changed, not pushing: $BAD"; exit 1; fi

CHANGED=$(python3 -c "import json; print(', '.join(json.load(open('$OUT_FILE'))['changed']))")
git config user.name "Manthan Bhendkar"
git config user.email "manthanbhendkaaar@gmail.com"
git add -A blog sitemap.xml blog-sitemap.xml llms.txt
git commit -q -m "Realty blog: ${CHANGED:-index/sitemap refresh}" -m "Built by the Realty blog workflow from Supabase shop_articles (product=realty)."
for t in 1 2 3; do
  if git push -q origin HEAD:main; then echo "changed=1" >> "${GITHUB_OUTPUT:-/dev/null}"; echo "pushed: $CHANGED"; exit 0; fi
  git pull -q --rebase origin main || true; sleep 5
done
echo "push rejected 3 times"; exit 1
