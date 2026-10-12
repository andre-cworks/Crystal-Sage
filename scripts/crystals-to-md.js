// Build crystals.md from data/crystals.js.
// Usage: node scripts/crystals-to-md.js data/crystals.js crystals.md
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const window = {};
new Function('window', src)(window);
const C = window.CRYSTALS;
const skip = k => k.endsWith('_filter') || k === 'emoji' || k === 'color';
const label = k => k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
const out = [`# Crystal Sage: crystal database`, ``,
  `${C.length} crystals, generated from data/crystals.js. Filter fields, emoji and colors are left out.`, ``,
  `## Contents`, ``, ...C.map((c, i) => `${i + 1}. ${c.name} (\`${c.id}\`)`), ``];
for (const c of C) {
  out.push(`---`, ``, `## ${c.name}`, ``);
  for (const [k, v] of Object.entries(c)) {
    if (skip(k) || k === 'name') continue;
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
      out.push(`**${label(k)}:**`, ...v.map(o => `- ${o.crystal} (\`${o.id}\`): ${o.rationale || o.reason}`), ``);
    } else if (Array.isArray(v) && ['emotional','mental','spiritual','physical','safe_cleansing','unsafe_cleansing','charging_methods'].includes(k)) {
      out.push(`**${label(k)}:**`, ...(v.length ? v.map(x => `- ${x}`) : ['- none']), ``);
    } else if (Array.isArray(v)) {
      out.push(`**${label(k)}:** ${v.length ? v.join(', ') : 'none'}`, ``);
    } else {
      out.push(`**${label(k)}:** ${k === 'id' ? '`' + v + '`' : v}`, ``);
    }
  }
}
fs.writeFileSync(process.argv[3], out.join('\n'));
console.log(C.length, 'crystals');
