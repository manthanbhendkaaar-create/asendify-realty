#!/usr/bin/env node
/**
 * Asendify Realty — add a property from the terminal.
 *
 * Usage:
 *   node scripts/add-property.js
 *
 * Walks you through the listing fields, optionally copies photos from a
 * local folder into images/properties/<id>/, appends the new property to
 * data/properties.json, and (if you say yes) commits and pushes so the
 * live site updates.
 *
 * No npm install needed — this only uses Node's built-in modules.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'properties.json');
const IMAGES_DIR = path.join(ROOT, 'images', 'properties');
const CONFIG_PATH = path.join(__dirname, 'config.json');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
}

function slugify(str) {
  return str.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('\n📋  Asendify Realty — Add a Property\n' + '-'.repeat(38));

  const config = loadConfig();

  const title = await ask('Listing title (e.g. "Sunlit 2BHK Apartment"): ');
  let type = (await ask('Rent or Buy? [rent/buy]: ')).toLowerCase();
  while (!['rent', 'buy'].includes(type)) {
    type = (await ask('Please type "rent" or "buy": ')).toLowerCase();
  }
  const propertyType = await ask('Property type (Apartment/Villa/Studio/Office/Plot): ');
  const locality = await ask('Locality (e.g. "Koregaon Park"): ');
  const priceRaw = await ask(type === 'rent' ? 'Monthly rent (numbers only, e.g. 45000): ' : 'Sale price (numbers only, e.g. 12500000): ');
  const price = Number(priceRaw.replace(/[,\s]/g, ''));
  const priceUnit = type === 'rent' ? 'month' : 'total';
  const brokerage = await ask(`Brokerage terms [default: ${type === 'rent' ? "3 months' rent (from both landlord and tenant)" : '2% of deal value (from both parties)'}]: `)
    || (type === 'rent' ? "3 months' rent (from both landlord and tenant)" : '2% of deal value (from both parties)');
  const bedrooms = Number(await ask('Bedrooms (e.g. 2): ')) || 0;
  const bathrooms = Number(await ask('Bathrooms (e.g. 2): ')) || 0;
  const areaSqft = Number(await ask('Area in sqft (e.g. 1100): ')) || 0;
  const furnishing = await ask('Furnishing (Unfurnished/Semi-furnished/Fully-furnished): ');
  const description = await ask('Short description: ');
  const amenitiesRaw = await ask('Amenities, comma separated (e.g. Parking, Lift, Gym): ');
  const amenities = amenitiesRaw ? amenitiesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  let whatsappNumber = config.whatsappNumber;
  if (!whatsappNumber) {
    whatsappNumber = await ask('WhatsApp number for leads, with country code, no + or spaces (e.g. 919999999999): ');
    const save = (await ask('Save this as the default WhatsApp number for future listings? [y/n]: ')).toLowerCase();
    if (save === 'y') { config.whatsappNumber = whatsappNumber; saveConfig(config); }
  } else {
    const useDefault = (await ask(`Use saved WhatsApp number ${whatsappNumber}? [y/n]: `)).toLowerCase();
    if (useDefault !== 'y') whatsappNumber = await ask('WhatsApp number for leads: ');
  }

  const suggestedId = slugify(`${locality}-${bedrooms}bhk-${propertyType}`) || slugify(title);
  let id = await ask(`Listing ID / folder name [${suggestedId}]: `);
  if (!id) id = suggestedId;

  const properties = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  if (properties.some(p => p.id === id)) {
    console.log(`\n⚠️  A listing with id "${id}" already exists. Add a suffix, e.g. "${id}-2".`);
    id = await ask('New ID: ');
  }

  // Images
  const imgFolderPath = path.join(IMAGES_DIR, id);
  fs.mkdirSync(imgFolderPath, { recursive: true });
  const sourceFolder = await ask('Path to a local folder of photos for this listing (leave blank to skip for now): ');
  let images = [];
  if (sourceFolder && fs.existsSync(sourceFolder)) {
    const files = fs.readdirSync(sourceFolder).filter(f => /\.(jpe?g|png|webp|svg)$/i.test(f)).sort();
    files.forEach((f, i) => {
      const ext = path.extname(f);
      const destName = `${i + 1}${ext}`;
      fs.copyFileSync(path.join(sourceFolder, f), path.join(imgFolderPath, destName));
      images.push(`images/properties/${id}/${destName}`);
    });
    console.log(`✔  Copied ${images.length} photo(s).`);
  } else {
    console.log('   No photos copied — drop image files into ' + path.relative(ROOT, imgFolderPath) + '/ later and re-run with that folder, or edit data/properties.json directly.');
  }

  const featuredAns = (await ask('Feature this on the homepage? [y/n]: ')).toLowerCase();

  const newProperty = {
    id,
    title,
    type,
    propertyType,
    locality,
    price,
    priceUnit,
    brokerage,
    bedrooms,
    bathrooms,
    areaSqft,
    furnishing,
    description,
    amenities,
    images,
    whatsappNumber,
    status: 'available',
    featured: featuredAns === 'y',
    postedDate: new Date().toISOString().slice(0, 10),
  };

  properties.unshift(newProperty);
  fs.writeFileSync(DATA_PATH, JSON.stringify(properties, null, 2) + '\n');
  console.log(`\n✅  Added "${title}" to data/properties.json (id: ${id}).`);

  const publish = (await ask('\nCommit and push now so the live site updates? [y/n]: ')).toLowerCase();
  if (publish === 'y') {
    try {
      execSync('git add -A', { cwd: ROOT, stdio: 'inherit' });
      execSync(`git commit -m "Add listing: ${title} (${id})"`, { cwd: ROOT, stdio: 'inherit' });
      execSync('git push', { cwd: ROOT, stdio: 'inherit' });
      console.log('\n🚀  Pushed. GitHub Pages will rebuild in a minute or two.');
    } catch (err) {
      console.log('\n⚠️  git command failed — run these manually from the project folder:');
      console.log('   git add -A');
      console.log(`   git commit -m "Add listing: ${title} (${id})"`);
      console.log('   git push');
    }
  } else {
    console.log('\nWhen ready, publish with:');
    console.log('   git add -A');
    console.log(`   git commit -m "Add listing: ${title} (${id})"`);
    console.log('   git push');
  }

  rl.close();
}

main();
