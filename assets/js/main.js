/* Asendify Realty — shared front-end logic
   No build step: fetches data/properties.json and renders plain DOM. */

const DATA_URL = 'data/properties.json';
const BUSINESS_WHATSAPP = '919096082894'; // General enquiries — country code, no + or spaces

function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
}

function priceLabel(p) {
  if (p.priceUnit === 'month') {
    return `<span class="price">&#8377;${formatINR(p.price)}<span class="unit"> /month</span></span>`;
  }
  return `<span class="price">&#8377;${formatINR(p.price)}<span class="unit"> total</span></span>`;
}

function whatsappLink(p) {
  const msg = `Hi Asendify Realty, I'm interested in "${p.title}" (${p.locality}, ${p.type === 'rent' ? 'for rent' : 'for sale'}). Could you share more details?`;
  return `https://wa.me/${p.whatsappNumber}?text=${encodeURIComponent(msg)}`;
}

function cardHTML(p) {
  const cover = (p.images && p.images[0]) || '';
  return `
    <a class="pcard" href="property.html?id=${encodeURIComponent(p.id)}">
      <div class="photo">
        <span class="badge ${p.type === 'buy' ? 'buy' : ''}">${p.type === 'buy' ? 'For Sale' : 'For Rent'}</span>
        <img src="${cover}" alt="${p.title}" loading="lazy">
      </div>
      <div class="body">
        <span class="punch"></span>
        <span class="locality">${p.locality}</span>
        <h3>${p.title}</h3>
        <span class="specs">${p.bedrooms} BHK &middot; ${p.areaSqft} sqft &middot; ${p.furnishing}</span>
        <div class="price-row">
          ${priceLabel(p)}
          <span class="view-link">View details &rarr;</span>
        </div>
      </div>
    </a>`;
}

async function loadProperties() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('Could not load properties.json');
  return res.json();
}

function renderGrid(container, properties) {
  if (!properties.length) {
    container.innerHTML = `<div class="empty-state">No listings match right now — check back soon, or message us on WhatsApp and we'll find something for you.</div>`;
    return;
  }
  container.innerHTML = properties.map(cardHTML).join('');
}

// ---- Home page: featured listings ----
async function initHome() {
  const el = document.getElementById('featured-grid');
  if (!el) return;
  try {
    const all = await loadProperties();
    const featured = all.filter(p => p.status === 'available' && p.featured).slice(0, 6);
    renderGrid(el, featured.length ? featured : all.filter(p => p.status === 'available').slice(0, 6));
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Listings are loading — refresh in a moment.</div>`;
    console.error(e);
  }
}

// ---- Listings page: full grid with filters ----
async function initListings() {
  const grid = document.getElementById('listings-grid');
  if (!grid) return;
  const countEl = document.getElementById('results-count');
  const typeSel = document.getElementById('filter-type');
  const bhkSel = document.getElementById('filter-bhk');
  const localitySel = document.getElementById('filter-locality');
  const sortSel = document.getElementById('filter-sort');

  let all = [];
  try {
    all = (await loadProperties()).filter(p => p.status === 'available');
  } catch (e) {
    grid.innerHTML = `<div class="empty-state">Couldn't load listings — refresh in a moment.</div>`;
    console.error(e);
    return;
  }

  // Populate locality options
  const localities = [...new Set(all.map(p => p.locality))].sort();
  localitySel.innerHTML = '<option value="">All localities</option>' +
    localities.map(l => `<option value="${l}">${l}</option>`).join('');

  // Preselect type/locality from ?type=rent|buy and ?locality=... in URL
  const params = new URLSearchParams(location.search);
  if (params.get('type')) typeSel.value = params.get('type');
  if (params.get('locality') && localities.includes(params.get('locality'))) {
    localitySel.value = params.get('locality');
  }

  function applyFilters() {
    let list = [...all];
    if (typeSel.value) list = list.filter(p => p.type === typeSel.value);
    if (bhkSel.value) list = list.filter(p => String(p.bedrooms) === bhkSel.value);
    if (localitySel.value) list = list.filter(p => p.locality === localitySel.value);

    if (sortSel.value === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (sortSel.value === 'price-desc') list.sort((a, b) => b.price - a.price);
    if (sortSel.value === 'newest') list.sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate));

    countEl.textContent = `${list.length} propert${list.length === 1 ? 'y' : 'ies'}`;
    renderGrid(grid, list);
  }

  [typeSel, bhkSel, localitySel, sortSel].forEach(el => el.addEventListener('change', applyFilters));
  applyFilters();
}

// ---- Property detail page ----
async function initDetail() {
  const root = document.getElementById('detail-root');
  if (!root) return;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  let all = [];
  try {
    all = await loadProperties();
  } catch (e) {
    root.innerHTML = `<div class="empty-state">Couldn't load this listing — refresh in a moment.</div>`;
    console.error(e);
    return;
  }

  const p = all.find(x => x.id === id);
  if (!p) {
    root.innerHTML = `<div class="empty-state">We couldn't find that listing. <a class="btn-ghost" href="listings.html">Back to all listings</a></div>`;
    return;
  }

  document.title = `${p.title} — Asendify Realty`;
  const metaDesc = document.querySelector('meta[name="description"]');
  const descText = `${p.title} — ${p.bedrooms} BHK ${p.propertyType.toLowerCase()} in ${p.locality}, Pune. ${p.areaSqft} sqft, ${p.furnishing.toLowerCase()}. ${p.type === 'rent' ? 'Available for rent' : 'Available for sale'} via Asendify Realty.`;
  if (metaDesc) metaDesc.setAttribute('content', descText);

  const ldJson = document.createElement('script');
  ldJson.type = 'application/ld+json';
  ldJson.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Residence',
    name: p.title,
    description: descText,
    address: { '@type': 'PostalAddress', addressLocality: p.locality, addressRegion: 'Maharashtra', addressCountry: 'IN' },
    numberOfRooms: p.bedrooms,
    floorSize: { '@type': 'QuantitativeValue', value: p.areaSqft, unitCode: 'FTK' },
  });
  document.head.appendChild(ldJson);

  const images = p.images && p.images.length ? p.images : [];
  const thumbs = images.map((src, i) =>
    `<img src="${src}" data-src="${src}" class="${i === 0 ? 'active' : ''}" alt="${p.title} photo ${i + 1}">`
  ).join('');

  root.innerHTML = `
    <div class="detail-grid">
      <div>
        <div class="gallery-main"><img id="gallery-main-img" src="${images[0] || ''}" alt="${p.title}"></div>
        <div class="gallery-thumbs">${thumbs}</div>
        <div class="detail-desc">
          <h2 style="font-size:20px;margin-bottom:10px;">About this property</h2>
          <p>${p.description}</p>
          ${p.amenities && p.amenities.length ? `
            <h2 style="font-size:16px;margin:22px 0 4px;">Amenities</h2>
            <div class="amenity-list">${p.amenities.map(a => `<span>${a}</span>`).join('')}</div>` : ''}
        </div>
      </div>
      <aside class="detail-panel">
        <span class="locality">${p.locality} &middot; ${p.propertyType}</span>
        <h1>${p.title}</h1>
        ${priceLabel(p)}
        <div class="spec-table">
          <div><span>Configuration</span><span>${p.bedrooms} BHK</span></div>
          <div><span>Bathrooms</span><span>${p.bathrooms}</span></div>
          <div><span>Area</span><span>${p.areaSqft} sqft</span></div>
          <div><span>Furnishing</span><span>${p.furnishing}</span></div>
        </div>
        <div class="brokerage-note">Brokerage: ${p.brokerage}. Payable on confirming the deal.</div>
        <a class="whatsapp-btn" target="_blank" rel="noopener" href="${whatsappLink(p)}">
          Message us on WhatsApp
        </a>
      </aside>
    </div>
  `;

  const mainImg = document.getElementById('gallery-main-img');
  root.querySelectorAll('.gallery-thumbs img').forEach(t => {
    t.addEventListener('click', () => {
      mainImg.src = t.dataset.src;
      root.querySelectorAll('.gallery-thumbs img').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
    });
  });
}

// ---- Home page rent/buy toggle -> links to listings ----
function initModeToggle() {
  const toggle = document.querySelector('.mode-toggle');
  if (!toggle) return;
  toggle.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      toggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ---- Locality landing pages (koregaon-park.html, kalyani-nagar.html, viman-nagar.html) ----
async function initLocalityPage() {
  const el = document.getElementById('locality-grid');
  if (!el) return;
  const locality = el.dataset.locality;
  try {
    const all = await loadProperties();
    const matches = all.filter(p => p.status === 'available' && p.locality === locality);
    renderGrid(el, matches);
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Listings are loading — refresh in a moment.</div>`;
    console.error(e);
  }
}

// ---- Floating WhatsApp button (every page) ----
function injectWhatsappFab() {
  if (document.querySelector('.whatsapp-fab')) return;
  const msg = "Hi Asendify Realty, I'd like to know more about your properties in Koregaon Park, Kalyani Nagar, or Viman Nagar.";
  const link = document.createElement('a');
  link.className = 'whatsapp-fab';
  link.href = `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.setAttribute('aria-label', 'Chat with Asendify Realty on WhatsApp');
  link.innerHTML = `
    <svg viewBox="0 0 32 32" width="28" height="28" fill="currentColor" aria-hidden="true">
      <path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.386.697 4.61 1.897 6.48L4 29l7.72-1.865A11.94 11.94 0 0 0 16.001 27C22.629 27 28 21.627 28 15S22.629 3 16.001 3Zm0 21.75a9.7 9.7 0 0 1-4.95-1.356l-.355-.21-4.583 1.107 1.127-4.463-.232-.366A9.71 9.71 0 0 1 5.25 15c0-5.936 4.815-10.75 10.751-10.75S26.75 9.064 26.75 15 21.937 24.75 16.001 24.75Zm5.36-7.53c-.294-.148-1.74-.859-2.01-.957-.27-.099-.466-.148-.663.148-.196.295-.76.957-.932 1.153-.172.196-.343.221-.637.074-.294-.148-1.241-.457-2.364-1.457-.874-.78-1.464-1.744-1.636-2.038-.172-.295-.018-.454.13-.601.133-.133.294-.344.442-.516.147-.172.196-.295.294-.492.098-.196.049-.369-.025-.516-.074-.148-.663-1.596-.909-2.187-.24-.575-.484-.497-.663-.507l-.564-.01c-.196 0-.516.074-.786.369-.27.295-1.03 1.006-1.03 2.454 0 1.448 1.055 2.847 1.202 3.043.147.196 2.077 3.171 5.032 4.446.703.303 1.251.484 1.679.62.705.224 1.347.192 1.855.117.566-.084 1.74-.712 1.985-1.4.245-.688.245-1.278.172-1.4-.074-.123-.27-.196-.564-.344Z"/>
    </svg>`;
  document.body.appendChild(link);
}

document.addEventListener('DOMContentLoaded', () => {
  injectWhatsappFab();
  initModeToggle();
  initHome();
  initListings();
  initDetail();
  initLocalityPage();
});
