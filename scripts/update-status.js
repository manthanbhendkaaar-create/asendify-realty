#!/usr/bin/env node
/**
 * Asendify Realty — update or remove a listing from the terminal.
 *
 * Usage:
 *   node scripts/update-status.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'properties.json');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

async function main() {
  const properties = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

  console.log('\nCurrent listings:\n' + '-'.repeat(38));
  properties.forEach((p, i) => {
    console.log(`${i + 1}. [${p.status}] ${p.title} — ${p.locality} (id: ${p.id})`);
  });

  const idxRaw = await ask('\nWhich listing number do you want to update? ');
  const idx = Number(idxRaw) - 1;
  if (!properties[idx]) {
    console.log('Not a valid number.');
    rl.close();
    return;
  }

  const action = (await ask('Set status to [available/rented/sold], or type "delete" to remove it: ')).toLowerCase();

  if (action === 'delete') {
    const confirm = (await ask(`Really delete "${properties[idx].title}"? [y/n]: `)).toLowerCase();
    if (confirm === 'y') {
      properties.splice(idx, 1);
      console.log('Removed.');
    } else {
      console.log('Cancelled.');
      rl.close();
      return;
    }
  } else if (['available', 'rented', 'sold'].includes(action)) {
    properties[idx].status = action;
    console.log(`Marked "${properties[idx].title}" as ${action}.`);
  } else {
    console.log('Not a recognised action — nothing changed.');
    rl.close();
    return;
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(properties, null, 2) + '\n');

  const publish = (await ask('\nCommit and push now? [y/n]: ')).toLowerCase();
  if (publish === 'y') {
    try {
      execSync('git add -A', { cwd: ROOT, stdio: 'inherit' });
      execSync(`git commit -m "Update listing status"`, { cwd: ROOT, stdio: 'inherit' });
      execSync('git push', { cwd: ROOT, stdio: 'inherit' });
      console.log('\n🚀  Pushed.');
    } catch {
      console.log('\n⚠️  git failed — run manually: git add -A && git commit -m "Update listing" && git push');
    }
  } else {
    console.log('\nWhen ready: git add -A && git commit -m "Update listing" && git push');
  }

  rl.close();
}

main();
