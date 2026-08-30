/* Asendify Realty — shared front-end logic
   No build step: fetches data/properties.json and renders plain DOM. */

const DATA_URL = 'data/properties.json';

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

  // Preselect type from ?type=rent|buy in URL
  const params = new URLSearchParams(location.search);
  if (params.get('type')) typeSel.value = params.get('type');

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

document.addEventListener('DOMContentLoaded', () => {
  initModeToggle();
  initHome();
  initListings();
  initDetail();
});
