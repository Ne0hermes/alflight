#!/usr/bin/env node
/**
 * ============================================================================
 *  ALFlight — Sonde Supabase (LECTURE SEULE)
 * ============================================================================
 *  Confirme la VÉRITÉ TERRAIN du schéma : quelles tables existent réellement,
 *  combien de lignes. Remplace l'inférence de AUDIT_HARDCODING_GLOBAL.md
 *  (« Statut BDD inféré — MCP Supabase déconnecté au moment de l'audit »).
 *
 *  Usage :
 *    node scripts/verify-supabase-probe.mjs
 *
 *  Lit VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY depuis .env puis .env.local
 *  (.env.local prioritaire, comme Vite). Ne logge JAMAIS la clé.
 *  Requêtes : SELECT count head only — aucune écriture.
 * ============================================================================
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Charge .env puis .env.local (override), parse minimaliste KEY=VALUE. */
function loadEnv() {
  const env = {};
  for (const f of ['.env', '.env.local']) {
    const p = path.join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[m[1]] = v;
    }
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('✗ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY introuvables dans .env(.local).');
  process.exit(2);
}

const projectRef = url.replace(/^https?:\/\//, '').split('.')[0];
console.log(`🛰️  Sonde Supabase (lecture seule) → projet « ${projectRef} » (clé masquée)\n`);

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Tables citées dans les audits : existantes attendues + « à créer » attendues
// (cf. AUDIT_HARDCODING_GLOBAL §3.2 : aeroclubs / regulations / regulation_profiles).
const TABLES = [
  'community_presets',
  'flight_plans',
  'vfr_points',
  'manex_files',
  'validated_flight_pdfs',
  'vac_charts',
  'aeroclubs',
  'regulations',
  'regulation_profiles',
];

const rows = [];
for (const t of TABLES) {
  try {
    // Existence FIABLE via un vrai SELECT : un head-count ne remonte pas le 404
    // (PGRST205) comme une erreur → il donnait de faux « existe » sur des tables absentes.
    const probe = await supabase.from(t).select('*').limit(1);
    if (probe.error) {
      const blob = `${probe.error.message || ''} ${probe.error.code || ''} ${probe.error.hint || ''}`;
      const missing = /does not exist|could not find the table|PGRST205|42P01/i.test(blob);
      rows.push({
        table: t,
        existe: missing ? 'NON' : '??',
        lignes: '—',
        note: missing ? 'ABSENTE → à créer' : (probe.error.code || probe.error.message || '').toString().slice(0, 42),
      });
      continue;
    }
    // Existe et lisible par anon → tenter le comptage exact.
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    rows.push({
      table: t,
      existe: 'OUI',
      lignes: String(count ?? probe.data.length),
      note: count == null ? 'RLS limite le comptage anon' : '',
    });
  } catch (e) {
    rows.push({ table: t, existe: 'ERR', lignes: '—', note: (e?.message || 'exception').slice(0, 42) });
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('TABLE', 26) + pad('EXISTE', 9) + pad('LIGNES', 9) + 'NOTE');
console.log('-'.repeat(72));
for (const r of rows) {
  console.log(pad(r.table, 26) + pad(r.existe, 9) + pad(r.lignes, 9) + r.note);
}
console.log('');

const missing = rows.filter((r) => r.existe === 'NON').map((r) => r.table);
const unknown = rows.filter((r) => r.existe === '??' || r.existe === 'ERR').map((r) => r.table);
if (missing.length) console.log(`➡️  ABSENTES (à créer en base) : ${missing.join(', ')}`);
if (unknown.length) console.log(`⚠️  INDÉTERMINÉES (RLS/réseau ?) : ${unknown.join(', ')}`);
if (!missing.length && !unknown.length) console.log('✓ Toutes les tables sondées existent.');

// ── Détail des tables à peupler/câbler : colonnes + échantillon + lisibilité RLS
//    (clé anon = ce que le CLIENT verra ; si 0 ligne renvoyée → RLS bloque ou table vide).
console.log('\n=== DÉTAIL aeroclubs / regulations / regulation_profiles (SELECT * LIMIT 2, clé anon) ===');
for (const t of ['aeroclubs', 'regulations', 'regulation_profiles']) {
  try {
    const { data, error } = await supabase.from(t).select('*').limit(2);
    if (error) {
      console.log(`• ${t} : ERREUR lecture → ${(error.code || '')} ${(error.message || '').slice(0, 70)}`);
    } else if (!data || data.length === 0) {
      console.log(`• ${t} : LISIBLE par anon mais 0 ligne (table VIDE, ou RLS filtre tout)`);
    } else {
      console.log(`• ${t} : ${data.length} ligne(s) lisibles par anon · colonnes = [${Object.keys(data[0]).join(', ')}]`);
    }
  } catch (e) {
    console.log(`• ${t} : exception ${(e?.message || '').slice(0, 70)}`);
  }
}
process.exit(0);
