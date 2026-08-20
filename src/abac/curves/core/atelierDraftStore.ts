// ─── Lot 0 — SURVIE AU RECHARGEMENT : instantané IndexedDB de l'atelier ─────
// La session d'atelier (AbacBuilder ↔ abacSessionRef du wizard avion) vit dans
// un useRef : elle survit aux changements d'étape mais PAS à un F5 (douleur
// pilote n°1 : image MANEX, cadres, calibrations, courbes perdus). Ce module
// dépose le MÊME payload dans IndexedDB — jamais localStorage : l'image en
// dataURL pèse plusieurs Mo et le quota (~5 Mo) est déjà occupé par les
// brouillons du wizard.
//
// FAIL-SAFE PARTOUT : la persistance est un filet de sécurité, jamais un
// bloqueur — toute erreur IndexedDB (API absente, quota, base corrompue) est
// avalée en console.warn et l'appelant reçoit null / undefined.

const DB_NAME = 'alflight-abac-atelier';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
/** Enregistrement UNIQUE : un seul tracé en cours à la fois (dernier gagne). */
const DRAFT_KEY = 'atelier-draft';

export interface AtelierDraft {
  /** `${aircraftModel || '?'}|${modelName || 'nouveau'}` — voir makeAtelierContextKey. */
  contextKey: string;
  /** Horodatage du dépôt (Date.now()). */
  savedAt: number;
  /** Payload de session (workshop, graphs, referenceCases…) — mêmes champs que sessionRef.atelier. */
  [field: string]: any;
}

/** Clé de contexte du brouillon : un snapshot n'est restauré QUE dans le
 *  contexte (avion + modèle en édition) où il a été tracé. */
export function makeAtelierContextKey(aircraftModel?: string | null, modelName?: string | null): string {
  return `${aircraftModel || '?'}|${modelName || 'nouveau'}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const idb: IDBFactory | undefined = (globalThis as any).indexedDB;
    if (!idb) { reject(new Error('IndexedDB indisponible')); return; }
    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => new Promise<T>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, mode);
      const req = run(tx.objectStore(STORE_NAME));
      req.onsuccess = () => { resolve(req.result as T); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    } catch (e) {
      db.close();
      reject(e);
    }
  }));
}

/** Lit le brouillon unique. null si absent OU si IndexedDB échoue (no-op). */
export async function getAtelierDraft(): Promise<AtelierDraft | null> {
  try {
    return (await withStore<AtelierDraft | undefined>('readonly', s => s.get(DRAFT_KEY))) ?? null;
  } catch (e) {
    console.warn('[atelierDraftStore] lecture du brouillon impossible (ignorée) :', e);
    return null;
  }
}

/** Dépose (remplace) le brouillon unique. Échec IndexedDB = no-op silencieux. */
export async function putAtelierDraft(draft: AtelierDraft): Promise<void> {
  try {
    await withStore('readwrite', s => s.put(draft, DRAFT_KEY));
  } catch (e) {
    console.warn('[atelierDraftStore] écriture du brouillon impossible (ignorée) :', e);
  }
}

/** Supprime le brouillon unique (enregistrement final ou abandon explicite). */
export async function deleteAtelierDraft(): Promise<void> {
  try {
    await withStore('readwrite', s => s.delete(DRAFT_KEY));
  } catch (e) {
    console.warn('[atelierDraftStore] suppression du brouillon impossible (ignorée) :', e);
  }
}
