# Asendify Realty

A plain HTML/CSS/JS site for listing Pune rental and resale properties, built to sit on GitHub Pages at **realty.asendify.co** and be updated from the terminal.

## How it's built
- No framework, no build step — `index.html`, `listings.html`, `property.html` plus `assets/css/style.css` and `assets/js/main.js`.
- All listings live in one file: `data/properties.json`. The pages fetch it and render cards/detail pages client-side.
- Photos live in `images/properties/<listing-id>/`.
- Leads go straight to WhatsApp — no backend, no database, no server to maintain.

## Adding a property (terminal)
```
node scripts/add-property.js
```
Walks you through title, rent/buy, price, specs, description, amenities, and (optionally) copies photos from a folder on your Mac into the right place. At the end it offers to `git commit` + `git push` for you.

## Updating or removing a property
```
node scripts/update-status.js
```
Mark something rented/sold, or delete it entirely.

## Editing by hand
Everything is also just JSON — you can open `data/properties.json` in any editor and add/edit an object directly if you prefer. Each property looks like:
```json
{
  "id": "kp-2bhk-001",
  "title": "Sunlit 2BHK Apartment",
  "type": "rent",
  "propertyType": "Apartment",
  "locality": "Koregaon Park",
  "price": 55000,
  "priceUnit": "month",
  "brokerage": "1 month's rent",
  "bedrooms": 2,
  "bathrooms": 2,
  "areaSqft": 1150,
  "furnishing": "Semi-furnished",
  "description": "...",
  "amenities": ["Covered Parking", "Lift"],
  "images": ["images/properties/kp-2bhk-001/1.jpg"],
  "whatsappNumber": "919999999999",
  "status": "available",
  "featured": true,
  "postedDate": "2026-08-30"
}
```

## Going live — GitHub Pages + subdomain

**1. Create the GitHub repo** (adjust the username if it's not `manthanbhendkaaar-create`):
```
cd asendify-realty
git init
git add -A
git commit -m "Initial Asendify Realty site"
gh repo create manthanbhendkaaar-create/asendify-realty --public --source=. --push
```
If you don't have `gh` set up, create the repo on github.com first, then:
```
git remote add origin https://github.com/manthanbhendkaaar-create/asendify-realty.git
git branch -M main
git push -u origin main
```

**2. Turn on GitHub Pages**
- Repo → Settings → Pages
- Source: "Deploy from a branch" → Branch: `main`, folder: `/ (root)`
- Save. GitHub will build it at `https://manthanbhendkaaar-create.github.io/asendify-realty/` first — that's expected before the custom domain kicks in.

**3. Point the subdomain**
The repo already includes a `CNAME` file containing `realty.asendify.co`. In whatever DNS provider manages `asendify.co` (the same one your main site's DNS is in), add:
```
Type:  CNAME
Host:  realty
Value: manthanbhendkaaar-create.github.io.
```
(Some providers want just `manthanbhendkaaar-create.github.io` without the trailing dot — either works.)

Back in GitHub → Settings → Pages, enter `realty.asendify.co` as the custom domain and wait for the DNS check to go green, then tick **Enforce HTTPS**.

DNS usually resolves within a few minutes to a few hours.

## Publishing new listings after launch
Every time you run `add-property.js` or `update-status.js` and say yes to "commit and push", GitHub Pages rebuilds automatically — no redeploy step needed.

## Terms & Fees gate
First-time visitors see a blocking "Terms & Fees" popup (`assets/js/terms.js`) before they can use the site — it covers brokerage (3 months' rent for renting, 1% of sale value for buying/selling), token/booking amounts, security deposits, documentation charges, cancellation/refund policy, and a no-hidden-fees clause. They must tick the checkbox and click "I Agree" to continue; their acceptance is remembered in the browser (`localStorage`) so they won't see it again on that device. Anyone can re-read it anytime via the "Terms & Fees" link in the footer, which reopens the same content without the lock.

To edit the wording or fees, just change the `TERMS_HTML` template string at the top of `assets/js/terms.js` — it's plain HTML, no build step needed.

## What this doesn't do (by design, for now)
- No online payments — brokerage is collected offline (bank transfer/UPI) once a deal closes; the site just states the terms and sends the lead to WhatsApp.
- No admin login or CMS — you're the only "backend" via the terminal scripts.
- No image resizing — keep photos reasonably sized (under ~500KB each) before adding them, so the site stays fast.
