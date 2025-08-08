// src/core/stores/checklistStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

const useChecklistStore = create(
  persist(
    immer((set, get) => ({
      // État
      checklists: [],
      activeChecklist: null,

      // Actions
      addChecklist: (checklistData) => set(state => {
        const newChecklist = {
          id: Date.now().toString(),
          ...checklistData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        state.checklists.push(newChecklist);
        state.activeChecklist = newChecklist;
      }),

      updateChecklist: (id, updates) => set(state => {
        const index = state.checklists.findIndex(c => c.id === id);
        if (index !== -1) {
          state.checklists[index] = {
            ...state.checklists[index],
            ...updates,
            updatedAt: new Date().toISOString()
          };
          // Mettre à jour aussi si c'est la checklist active
          if (state.activeChecklist?.id === id) {
            state.activeChecklist = state.checklists[index];
          }
        }
      }),

      deleteChecklist: (id) => set(state => {
        state.checklists = state.checklists.filter(c => c.id !== id);
        if (state.activeChecklist?.id === id) {
          state.activeChecklist = null;
        }
      }),

      duplicateChecklist: (id) => set(state => {
        const checklist = state.checklists.find(c => c.id === id);
        if (checklist) {
          const duplicate = {
            ...checklist,
            id: Date.now().toString(),
            name: `${checklist.name} (copie)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Réinitialiser tous les éléments cochés
            sections: checklist.sections.map(section => ({
              ...section,
              id: Date.now().toString() + Math.random(),
              items: section.items.map(item => ({
                ...item,
                id: Date.now().toString() + Math.random(),
                checked: false
              }))
            }))
          };
          state.checklists.push(duplicate);
        }
      }),

      setActiveChecklist: (id) => set(state => {
        state.activeChecklist = state.checklists.find(c => c.id === id) || null;
      }),

      toggleItem: (checklistId, sectionId, itemId) => set(state => {
        const checklist = state.checklists.find(c => c.id === checklistId);
        if (checklist) {
          const section = checklist.sections.find(s => s.id === sectionId);
          if (section) {
            const item = section.items.find(i => i.id === itemId);
            if (item) {
              item.checked = !item.checked;
              checklist.updatedAt = new Date().toISOString();
              
              // Mettre à jour la checklist active si nécessaire
              if (state.activeChecklist?.id === checklistId) {
                state.activeChecklist = checklist;
              }
            }
          }
        }
      }),

      resetChecklist: (id) => set(state => {
        const checklist = state.checklists.find(c => c.id === id);
        if (checklist) {
          checklist.sections.forEach(section => {
            section.items.forEach(item => {
              item.checked = false;
            });
          });
          checklist.updatedAt = new Date().toISOString();
          
          // Mettre à jour la checklist active si nécessaire
          if (state.activeChecklist?.id === id) {
            state.activeChecklist = checklist;
          }
        }
      }),

      importChecklists: (jsonString) => set(state => {
        try {
          const imported = JSON.parse(jsonString);
          if (Array.isArray(imported)) {
            // Import multiple
            imported.forEach(checklist => {
              const newChecklist = {
                ...checklist,
                id: Date.now().toString() + Math.random(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              state.checklists.push(newChecklist);
            });
          } else if (imported && typeof imported === 'object') {
            // Import unique
            const newChecklist = {
              ...imported,
              id: Date.now().toString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            state.checklists.push(newChecklist);
          }
        } catch (error) {
          throw new Error('Format de fichier invalide');
        }
      }),

      exportChecklists: () => {
        const state = get();
        return JSON.stringify(state.checklists, null, 2);
      },

      // Checklists prédéfinies
      loadDefaultChecklists: () => set(state => {
        const defaults = [
          {
            id: 'default-preflight',
            name: 'Prévol Extérieur',
            description: 'Inspection extérieure de l\'appareil',
            category: 'preflight',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sections: [
              {
                id: 'cabin',
                name: 'Cabine',
                critical: false,
                items: [
                  { id: '1', text: 'Documents de bord complets', note: 'Certificats, carnet de route, manuel de vol', warning: false, checked: false },
                  { id: '2', text: 'Commandes libres', note: '', warning: false, checked: false },
                  { id: '3', text: 'Frein de parc serré', note: '', warning: false, checked: false },
                  { id: '4', text: 'Magnétos OFF', note: '', warning: true, checked: false },
                  { id: '5', text: 'Mixture étouffoir', note: '', warning: false, checked: false }
                ]
              },
              {
                id: 'wings',
                name: 'Ailes',
                critical: true,
                items: [
                  { id: '6', text: 'État général des ailes', note: 'Vérifier l\'absence de dommages', warning: false, checked: false },
                  { id: '7', text: 'Ailerons libres et sécurisés', note: '', warning: false, checked: false },
                  { id: '8', text: 'Feux de navigation', note: 'Vérifier l\'état', warning: false, checked: false },
                  { id: '9', text: 'Pitot non obstrué', note: 'Retirer la protection', warning: true, checked: false },
                  { id: '10', text: 'Prise statique propre', note: '', warning: false, checked: false },
                  { id: '11', text: 'Réservoirs carburant', note: 'Quantité et qualité', warning: true, checked: false }
                ]
              },
              {
                id: 'engine',
                name: 'Moteur',
                critical: true,
                items: [
                  { id: '12', text: 'Niveau d\'huile', note: 'Entre min et max', warning: true, checked: false },
                  { id: '13', text: 'Hélice - état général', note: 'Pas de fissures ou impacts', warning: false, checked: false },
                  { id: '14', text: 'Entrées d\'air dégagées', note: '', warning: false, checked: false },
                  { id: '15', text: 'Échappement - état', note: 'Pas de fissures', warning: false, checked: false },
                  { id: '16', text: 'Capot moteur sécurisé', note: '', warning: false, checked: false }
                ]
              },
              {
                id: 'landing-gear',
                name: 'Train d\'atterrissage',
                critical: false,
                items: [
                  { id: '17', text: 'Pneus - état et pression', note: '', warning: false, checked: false },
                  { id: '18', text: 'Amortisseurs', note: 'Extension correcte', warning: false, checked: false },
                  { id: '19', text: 'Freins - état des disques', note: '', warning: false, checked: false },
                  { id: '20', text: 'Cales retirées', note: '', warning: true, checked: false }
                ]
              }
            ]
          },
          {
            id: 'default-startup',
            name: 'Mise en Route',
            description: 'Procédure de démarrage moteur',
            category: 'startup',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sections: [
              {
                id: 'before-start',
                name: 'Avant mise en route',
                critical: true,
                items: [
                  { id: '1', text: 'Sièges et harnais ajustés', note: '', warning: false, checked: false },
                  { id: '2', text: 'Portes fermées et verrouillées', note: '', warning: false, checked: false },
                  { id: '3', text: 'Circuit électrique ON', note: '', warning: false, checked: false },
                  { id: '4', text: 'Feux anticollision ON', note: '', warning: false, checked: false },
                  { id: '5', text: 'Zone hélice dégagée', note: 'Crier "HELICE"', warning: true, checked: false }
                ]
              },
              {
                id: 'starting',
                name: 'Démarrage',
                critical: true,
                items: [
                  { id: '6', text: 'Pompe électrique ON', note: 'Si équipé', warning: false, checked: false },
                  { id: '7', text: 'Mixture riche', note: '', warning: false, checked: false },
                  { id: '8', text: 'Throttle crack open', note: '1cm environ', warning: false, checked: false },
                  { id: '9', text: 'Démarreur engagé', note: 'Max 10 secondes', warning: true, checked: false },
                  { id: '10', text: 'Pression d\'huile', note: 'Vérifier dans les 30 secondes', warning: true, checked: false }
                ]
              },
              {
                id: 'after-start',
                name: 'Après démarrage',
                critical: false,
                items: [
                  { id: '11', text: 'Régime de chauffe', note: '1000-1200 RPM', warning: false, checked: false },
                  { id: '12', text: 'Radios ON', note: '', warning: false, checked: false },
                  { id: '13', text: 'Transpondeur STANDBY', note: '', warning: false, checked: false },
                  { id: '14', text: 'Instruments vérifiés', note: 'Températures et pressions', warning: false, checked: false },
                  { id: '15', text: 'Altimètre calé', note: 'QNH ou QFE', warning: false, checked: false }
                ]
              }
            ]
          },
          {
            id: 'default-emergency',
            name: 'Panne Moteur en Vol',
            description: 'Procédure d\'urgence en cas de panne moteur',
            category: 'emergency',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sections: [
              {
                id: 'immediate',
                name: 'Actions Immédiates',
                critical: true,
                items: [
                  { id: '1', text: 'Vitesse de plané optimale', note: 'Afficher immédiatement', warning: true, checked: false },
                  { id: '2', text: 'Terrain d\'atterrissage', note: 'Choisir et maintenir en vue', warning: true, checked: false },
                  { id: '3', text: 'Vent', note: 'Évaluer direction et force', warning: false, checked: false }
                ]
              },
              {
                id: 'restart',
                name: 'Tentative de Redémarrage',
                critical: true,
                items: [
                  { id: '4', text: 'Réservoirs carburant', note: 'Sélectionner réservoir plein', warning: false, checked: false },
                  { id: '5', text: 'Pompe électrique ON', note: 'Si équipé', warning: false, checked: false },
                  { id: '6', text: 'Mixture riche', note: '', warning: false, checked: false },
                  { id: '7', text: 'Magnétos BOTH', note: '', warning: false, checked: false },
                  { id: '8', text: 'Démarreur', note: 'Si l\'hélice est arrêtée', warning: false, checked: false }
                ]
              },
              {
                id: 'forced-landing',
                name: 'Atterrissage Forcé',
                critical: true,
                items: [
                  { id: '9', text: 'Mayday x3', note: '121.5 MHz', warning: true, checked: false },
                  { id: '10', text: 'Transpondeur 7700', note: '', warning: true, checked: false },
                  { id: '11', text: 'Mixture étouffoir', note: 'Avant le toucher', warning: false, checked: false },
                  { id: '12', text: 'Magnétos OFF', note: 'Avant le toucher', warning: false, checked: false },
                  { id: '13', text: 'Master OFF', note: 'Avant le toucher', warning: false, checked: false },
                  { id: '14', text: 'Portes déverrouillées', note: 'Avant le toucher', warning: true, checked: false },
                  { id: '15', text: 'Harnais serrés', note: '', warning: true, checked: false }
                ]
              }
            ]
          }
        ];

        // Ajouter seulement si aucune checklist n'existe
        if (state.checklists.length === 0) {
          state.checklists = defaults;
        }
      })
    })),
    {
      name: 'checklist-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
);

// Charger les checklists par défaut au premier lancement
if (typeof window !== 'undefined') {
  const state = useChecklistStore.getState();
  if (state.checklists.length === 0) {
    state.loadDefaultChecklists();
  }
}

export { useChecklistStore };