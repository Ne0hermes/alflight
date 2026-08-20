// src/abac/curves/core/__tests__/atelierDraftStore.test.js
//
// Lot 0 — SURVIE AU RECHARGEMENT DE L'ATELIER ABAQUES.
//
// Le store dépose l'instantané du tracé (image dataURL de plusieurs Mo,
// cadres, courbes, calibrations…) dans IndexedDB sous une CLÉ UNIQUE
// 'atelier-draft'. Deux invariants verrouillés ici :
//
//   1. FAIL-SAFE ABSOLU : la persistance est un filet, jamais un bloqueur.
//      IndexedDB absent (vieux navigateur, mode privé verrouillé) ou cassé
//      (open qui jette / request en erreur) ⇒ aucune exception ne remonte,
//      get renvoie null, put/delete sont des no-op (console.warn seulement).
//
//   2. SÉMANTIQUE DU BROUILLON UNIQUE : put remplace (jamais deux
//      enregistrements), get relit le payload TEL QUEL, delete efface.
//
// (fake-indexeddb n'est pas dans les devDependencies : un mini-fake local
//  asynchrone suffit — mêmes callbacks onsuccess/onerror que la vraie API.)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  makeAtelierContextKey,
  getAtelierDraft,
  putAtelierDraft,
  deleteAtelierDraft
} from '../atelierDraftStore';

// ─── Mini-fake IndexedDB en mémoire (callbacks asynchrones, comme la vraie) ──
function makeFakeIndexedDB() {
  const data = new Map();
  const stores = new Set();
  const mkReq = (exec) => {
    const req = { onsuccess: null, onerror: null, onupgradeneeded: null, result: undefined, error: null };
    setTimeout(() => {
      try {
        req.result = exec(req);
        if (req.onsuccess) req.onsuccess();
      } catch (e) {
        req.error = e;
        if (req.onerror) req.onerror();
      }
    }, 0);
    return req;
  };
  const objectStore = {
    get: (key) => mkReq(() => data.get(key)),
    put: (value, key) => mkReq(() => { data.set(key, value); return key; }),
    delete: (key) => mkReq(() => { data.delete(key); })
  };
  const db = {
    objectStoreNames: { contains: (name) => stores.has(name) },
    createObjectStore: (name) => { stores.add(name); return objectStore; },
    transaction: () => ({ objectStore: () => objectStore }),
    close: () => {}
  };
  return {
    open: () => mkReq((req) => {
      // Première ouverture : rejouer le chemin onupgradeneeded → createObjectStore.
      req.result = db;
      if (req.onupgradeneeded) req.onupgradeneeded();
      return db;
    }),
    _data: data
  };
}

describe('atelierDraftStore — clé de contexte', () => {
  it('assemble `avion|modèle` avec les valeurs fournies', () => {
    expect(makeAtelierContextKey('DR400-120', 'Distance de décollage')).toBe('DR400-120|Distance de décollage');
  });

  it('replis : avion inconnu → « ? », pas de modèle en édition → « nouveau »', () => {
    expect(makeAtelierContextKey(undefined, undefined)).toBe('?|nouveau');
    expect(makeAtelierContextKey(null, null)).toBe('?|nouveau');
    expect(makeAtelierContextKey('', '')).toBe('?|nouveau');
    expect(makeAtelierContextKey('DA40', null)).toBe('DA40|nouveau');
    expect(makeAtelierContextKey(null, 'Montée')).toBe('?|Montée');
  });

  it('deux contextes ne partagent jamais la même clé (avion OU modèle différent)', () => {
    expect(makeAtelierContextKey('DR400', 'A')).not.toBe(makeAtelierContextKey('DR400', 'B'));
    expect(makeAtelierContextKey('DR400', 'A')).not.toBe(makeAtelierContextKey('DA40', 'A'));
  });
});

describe('atelierDraftStore — fail-safe (la persistance ne bloque JAMAIS)', () => {
  let originalIDB;
  let warnSpy;

  beforeEach(() => {
    originalIDB = globalThis.indexedDB;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalIDB === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = originalIDB;
    vi.restoreAllMocks();
  });

  it('indexedDB ABSENT : get → null, put/delete → no-op, zéro exception', async () => {
    delete globalThis.indexedDB;
    await expect(getAtelierDraft()).resolves.toBeNull();
    await expect(putAtelierDraft({ contextKey: 'x|y', savedAt: 1 })).resolves.toBeUndefined();
    await expect(deleteAtelierDraft()).resolves.toBeUndefined();
    // Un warn par opération avortée — visible en console, invisible au pilote.
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });

  it('indexedDB CASSÉ (open qui jette) : mêmes no-op silencieux', async () => {
    globalThis.indexedDB = { open() { throw new Error('boom'); } };
    await expect(getAtelierDraft()).resolves.toBeNull();
    await expect(putAtelierDraft({ contextKey: 'x|y', savedAt: 1 })).resolves.toBeUndefined();
    await expect(deleteAtelierDraft()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });

  it('requête en ERREUR (onerror) : get → null, sans exception', async () => {
    const req = { onsuccess: null, onerror: null, error: new Error('quota') };
    globalThis.indexedDB = {
      open: () => {
        setTimeout(() => { if (req.onerror) req.onerror(); }, 0);
        return req;
      }
    };
    await expect(getAtelierDraft()).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('atelierDraftStore — brouillon unique (put remplace, get relit, delete efface)', () => {
  let originalIDB;
  let fake;

  beforeEach(() => {
    originalIDB = globalThis.indexedDB;
    fake = makeFakeIndexedDB();
    globalThis.indexedDB = fake;
  });

  afterEach(() => {
    if (originalIDB === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = originalIDB;
  });

  it('round-trip : le payload est relu TEL QUEL sous la clé unique', async () => {
    const draft = {
      contextKey: 'DR400-120|nouveau',
      savedAt: 1234567890,
      marker: 'nouveau',
      workshop: { image: 'data:image/png;base64,AAAA', sharedY: { min: 0, max: 100, unit: 'm', title: '' }, frames: [] },
      graphs: [{ id: 'g1', name: 'Graphique 1', curves: [] }],
      referenceCases: [],
      bezierSession: null,
      systemType: 'takeoff_ground_roll',
      currentStep: 'points',
      subStepGraphIndex: 0
    };
    await putAtelierDraft(draft);
    expect(fake._data.size).toBe(1);
    expect(fake._data.has('atelier-draft')).toBe(true);
    await expect(getAtelierDraft()).resolves.toEqual(draft);
  });

  it('un second put REMPLACE (jamais deux tracés en attente)', async () => {
    await putAtelierDraft({ contextKey: 'a|b', savedAt: 1 });
    await putAtelierDraft({ contextKey: 'a|b', savedAt: 2 });
    expect(fake._data.size).toBe(1);
    const back = await getAtelierDraft();
    expect(back.savedAt).toBe(2);
  });

  it('delete efface, get renvoie alors null (et jamais undefined)', async () => {
    await putAtelierDraft({ contextKey: 'a|b', savedAt: 1 });
    await deleteAtelierDraft();
    expect(fake._data.size).toBe(0);
    await expect(getAtelierDraft()).resolves.toBeNull();
  });
});
