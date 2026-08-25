// src/core/stores/aircraftUpdatesStore.js
//
// 📣 MISES À JOUR DES AVIONS IMPORTÉS (demande pilote, 25/08/2026).
// Les copies locales (IndexedDB) ne se resynchronisent pas au démarrage : quand
// l'admin met à jour une fiche communautaire, l'utilisateur ne le voyait JAMAIS.
// Ce mini-store porte la liste des copies locales EN RETARD sur la base ; la
// bannière du module Avions la consomme (« F-GUVV mis à jour (v2 → v4) »).
//
// Volontairement séparé d'aircraftStore (non persisté, zéro risque sur le store
// principal) ; rempli par AircraftProvider une fois la liste locale chargée.
import { create } from 'zustand';

// « Ignorer » mémorise la version écartée : la bannière reviendra à la version
// suivante, pas avant. (Par navigateur — même logique que les coches.)
const DISMISS_KEY = 'alflight-maj-ignorees-v1';
const lireIgnorees = () => {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}'); } catch { return {}; }
};

export const useAircraftUpdatesStore = create((set, get) => ({
  // [{ id, registration, localVersion, remoteVersion }]
  updatesAvailable: [],
  checked: false, // une vérification a eu lieu (évite de re-vérifier à chaque montage)

  setUpdates: (updates) => {
    const ignorees = lireIgnorees();
    set({
      updatesAvailable: (updates || []).filter((u) => (ignorees[u.id] || 0) < u.remoteVersion),
      checked: true,
    });
  },

  dismiss: (id) => {
    const u = get().updatesAvailable.find((x) => x.id === id);
    if (u) {
      const ignorees = lireIgnorees();
      ignorees[id] = u.remoteVersion;
      try { localStorage.setItem(DISMISS_KEY, JSON.stringify(ignorees)); } catch { /* stockage indisponible */ }
    }
    set({ updatesAvailable: get().updatesAvailable.filter((x) => x.id !== id) });
  },

  remove: (id) => set({ updatesAvailable: get().updatesAvailable.filter((x) => x.id !== id) }),
}));
