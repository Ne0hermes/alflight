// Service de gestion des versions d'avions
// En production, ce service communiquera avec l'API backend

class AircraftVersioningService {
  constructor() {
    // Mock database pour le développement
    this.versions = new Map();
    this.initMockData();
  }

  initMockData() {
    // Exemple de versioning pour F-GBYU
    this.versions.set('F-GBYU', {
      current: {
        id: 'v1',
        version: 1,
        registration: 'F-GBYU',
        model: 'Diamond DA40 NG',
        manufacturer: 'Diamond Aircraft',
        type: 'DA40 NG',
        addedBy: 'Pilot123',
        dateAdded: '2024-03-15',
        lastUpdated: '2024-03-15',
        votes: { up: 42, down: 2 },
        verified: true,
        data: {
          // Données complètes de l'avion
          cruiseSpeed: 127,
          maxSpeed: 154,
          stallSpeed: 49,
          serviceCeiling: 16400,
          fuelCapacity: 148,
          emptyWeight: 795,
          maxTakeoffWeight: 1280
        }
      },
      history: [
        {
          id: 'v0',
          version: 0,
          updatedBy: 'Pilot123',
          updateDate: '2024-03-15',
          updateReason: 'Configuration initiale',
          changes: []
        }
      ]
    });
  }

  // Vérifier si une immatriculation existe
  async checkExists(registration) {
    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 300));

    return this.versions.has(registration.toUpperCase());
  }

  // Récupérer les informations d'un avion
  async getAircraft(registration) {
    await new Promise(resolve => setTimeout(resolve, 300));

    const versionData = this.versions.get(registration.toUpperCase());
    return versionData ? versionData.current : null;
  }

  // Créer une nouvelle version
  async createUpdate(registration, updateData) {
    const existing = this.versions.get(registration.toUpperCase());

    if (!existing) {
      throw new Error('Aircraft not found');
    }

    const newVersion = {
      id: `v${existing.current.version + 1}`,
      version: existing.current.version + 1,
      registration: registration.toUpperCase(),
      ...existing.current,
      ...updateData.data,
      updatedBy: updateData.updatedBy,
      lastUpdated: new Date().toISOString(),
      updateReason: updateData.reason,
      previousVersion: existing.current.id,
      needsReview: true,
      votes: { up: 0, down: 0 },
      verified: false,
      changes: this.calculateChanges(existing.current.data, updateData.data)
    };

    // Ajouter à l'historique
    existing.history.push({
      ...existing.current,
      archivedDate: new Date().toISOString()
    });

    // Mettre à jour la version courante (en attente de validation)
    existing.pending = newVersion;

    return newVersion;
  }

  // Calculer les différences entre deux versions
  calculateChanges(oldData, newData) {
    const changes = [];

    for (const key in newData) {
      if (oldData[key] !== newData[key]) {
        changes.push({
          field: key,
          oldValue: oldData[key],
          newValue: newData[key],
          changeType: oldData[key] === undefined ? 'added' : 'modified'
        });
      }
    }

    for (const key in oldData) {
      if (!(key in newData)) {
        changes.push({
          field: key,
          oldValue: oldData[key],
          newValue: undefined,
          changeType: 'removed'
        });
      }
    }

    return changes;
  }

  // Valider une mise à jour (après votes communautaires)
  async approveUpdate(registration, versionId) {
    const existing = this.versions.get(registration.toUpperCase());

    if (!existing || !existing.pending || existing.pending.id !== versionId) {
      throw new Error('Update not found or already processed');
    }

    // Archiver la version actuelle
    existing.history.push({
      ...existing.current,
      archivedDate: new Date().toISOString()
    });

    // Promouvoir la version en attente
    existing.current = {
      ...existing.pending,
      verified: true,
      needsReview: false
    };

    delete existing.pending;

    return existing.current;
  }

  // Rejeter une mise à jour
  async rejectUpdate(registration, versionId, reason) {
    const existing = this.versions.get(registration.toUpperCase());

    if (!existing || !existing.pending || existing.pending.id !== versionId) {
      throw new Error('Update not found or already processed');
    }

    const rejected = {
      ...existing.pending,
      rejectedDate: new Date().toISOString(),
      rejectionReason: reason
    };

    existing.history.push(rejected);
    delete existing.pending;

    return rejected;
  }

  // Obtenir l'historique des versions
  async getVersionHistory(registration) {
    await new Promise(resolve => setTimeout(resolve, 300));

    const versionData = this.versions.get(registration.toUpperCase());
    if (!versionData) return [];

    return [
      versionData.current,
      ...versionData.history
    ].sort((a, b) => b.version - a.version);
  }

  // Comparer deux versions
  async compareVersions(registration, versionId1, versionId2) {
    const history = await this.getVersionHistory(registration);

    const v1 = history.find(v => v.id === versionId1);
    const v2 = history.find(v => v.id === versionId2);

    if (!v1 || !v2) {
      throw new Error('Version not found');
    }

    return {
      version1: v1,
      version2: v2,
      changes: this.calculateChanges(v1.data, v2.data)
    };
  }

  // Voter pour une mise à jour
  async voteForUpdate(registration, versionId, vote) {
    const existing = this.versions.get(registration.toUpperCase());

    if (!existing || !existing.pending || existing.pending.id !== versionId) {
      throw new Error('Update not found');
    }

    if (vote === 'up') {
      existing.pending.votes.up++;
    } else if (vote === 'down') {
      existing.pending.votes.down++;
    }

    // Auto-approuver si 10 votes positifs nets
    const netVotes = existing.pending.votes.up - existing.pending.votes.down;
    if (netVotes >= 10) {
      return await this.approveUpdate(registration, versionId);
    }

    return existing.pending;
  }
}

// Singleton
const aircraftVersioningService = new AircraftVersioningService();

export default aircraftVersioningService;

// Exemples d'utilisation en production :
//
// // Vérifier si un avion existe
// const exists = await aircraftVersioningService.checkExists('F-GBYU');
//
// // Créer une mise à jour
// const update = await aircraftVersioningService.createUpdate('F-GBYU', {
//   updatedBy: 'CurrentUser',
//   reason: 'Mise à jour des performances après maintenance',
//   data: {
//     cruiseSpeed: 130,
//     fuelCapacity: 150
//   }
// });
//
// // Voter pour une mise à jour
// await aircraftVersioningService.voteForUpdate('F-GBYU', 'v2', 'up');
//
// // Obtenir l'historique
// const history = await aircraftVersioningService.getVersionHistory('F-GBYU');