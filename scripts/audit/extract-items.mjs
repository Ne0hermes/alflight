// Extrait les items d'un avion depuis checklist-source.html → JSON (sans le générateur d'origine).
import fs from 'node:fs';
const reg = process.argv[2];
const html = fs.readFileSync(new URL('./checklist-source.html', import.meta.url), 'utf8');
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const field = (b, lbl) => { const i = b.indexOf('<dt>' + lbl); if (i < 0) return ''; const j = b.indexOf('<dd', i); const k = b.indexOf('>', j); return strip(b.slice(k + 1, b.indexOf('</dd>', k))); };
const items = html.split('<div class="it ').slice(1).filter(b => b.includes(`data-itid="${reg}-`)).map(b => ({
  itid: /data-itid="([^"]+)"/.exec(b)[1], sev: /^(critique|majeur|mineur)/.exec(b)?.[1], regle: /^[^"]*regle/.test(b),
  champ: strip(/data-champ="([^"]*)"/.exec(b)?.[1] || ''), trouve: field(b, 'Trouv'), attendu: field(b, 'Attendu'), action: field(b, 'Action')
}));
fs.writeFileSync(new URL(`./items-${reg}.json`, import.meta.url), JSON.stringify(items, null, 1));
for (const o of items) console.log(`[${o.itid}] (${o.sev}${o.regle ? ', déjà réglé' : ''}) ${o.champ}\n   T: ${o.trouve.slice(0, 240)}\n   A: ${o.attendu.slice(0, 160)}`);
