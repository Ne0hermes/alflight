// @vitest-environment jsdom
// Tests de l'import automatique des avions de la base d'attache (Lot 11).
// Le risque est dans la déduplication : jamais deux fois le même avion, jamais
// de retour d'un avion supprimé, pas d'import si l'immat existe déjà.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@services/communityService', () => ({
  default: {
    getPresetsByHomeBase: vi.fn(),
    getPresetById: vi.fn()
  }
}));
vi.mock('@core/stores/aircraftStore', () => ({
  useAircraftStore: {
    getState: vi.fn()
  }
}));

import communityService from '@services/communityService';
import { useAircraftStore } from '@core/stores/aircraftStore';
import { syncHomeBaseAircraft } from '../homeBaseAircraftSync';

const addAircraft = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAircraftStore.getState.mockReturnValue({ aircraftList: [], addAircraft });
});

describe('syncHomeBaseAircraft', () => {
  it('importe les avions de la base non présents localement', async () => {
    communityService.getPresetsByHomeBase.mockResolvedValue([
      { id: 'p1', registration: 'F-GABC' },
      { id: 'p2', registration: 'F-GDEF' }
    ]);
    communityService.getPresetById.mockImplementation(async (id) => (
      { registration: id === 'p1' ? 'F-GABC' : 'F-GDEF' }
    ));

    const r = await syncHomeBaseAircraft('lfga');
    expect(r.imported).toEqual(['F-GABC', 'F-GDEF']);
    expect(addAircraft).toHaveBeenCalledTimes(2);
    expect(communityService.getPresetsByHomeBase).toHaveBeenCalledWith('LFGA');
  });

  it('ne duplique pas une immatriculation déjà présente localement', async () => {
    useAircraftStore.getState.mockReturnValue({
      aircraftList: [{ registration: 'F-GABC' }],
      addAircraft
    });
    communityService.getPresetsByHomeBase.mockResolvedValue([
      { id: 'p1', registration: 'F-GABC' }
    ]);

    const r = await syncHomeBaseAircraft('LFGA');
    expect(r.imported).toEqual([]);
    expect(r.skipped).toBe(1);
    expect(communityService.getPresetById).not.toHaveBeenCalled();
  });

  it('un preset déjà traité ne revient JAMAIS (avion supprimé par le pilote)', async () => {
    communityService.getPresetsByHomeBase.mockResolvedValue([
      { id: 'p1', registration: 'F-GABC' }
    ]);
    communityService.getPresetById.mockResolvedValue({ registration: 'F-GABC' });

    await syncHomeBaseAircraft('LFGA');            // 1er passage : importé
    // Le pilote supprime l'avion → liste locale vide au passage suivant
    const r2 = await syncHomeBaseAircraft('LFGA'); // 2e passage
    expect(r2.imported).toEqual([]);               // pas de ré-import
    expect(communityService.getPresetById).toHaveBeenCalledTimes(1);
  });

  it('changement de base A→B→A : un avion supprimé en A ne revient pas', async () => {
    const byBase = {
      LFGA: [{ id: 'p1', registration: 'F-GABC' }],
      LFST: [{ id: 'p9', registration: 'F-GXYZ' }]
    };
    communityService.getPresetsByHomeBase.mockImplementation(async (i) => byBase[i] || []);
    communityService.getPresetById.mockImplementation(async (id) => (
      { registration: id === 'p1' ? 'F-GABC' : 'F-GXYZ' }
    ));

    await syncHomeBaseAircraft('LFGA'); // p1 importé puis supprimé par le pilote
    await syncHomeBaseAircraft('LFST'); // mutation temporaire (le marqueur LFGA doit survivre)
    const r3 = await syncHomeBaseAircraft('LFGA'); // retour à la base d'origine

    expect(r3.imported).toEqual([]); // p1 ne revient JAMAIS
    // 1 seul appel pour p1 (1er passage) + 1 pour p9 : jamais de ré-import
    expect(communityService.getPresetById).toHaveBeenCalledTimes(2);
  });

  it('migre l\'ancien marqueur mono-base {icao, processedIds} sans ré-import', async () => {
    localStorage.setItem('homeBaseAutoImport',
      JSON.stringify({ icao: 'LFGA', processedIds: ['p1'], lastSync: 1 }));
    communityService.getPresetsByHomeBase.mockResolvedValue([
      { id: 'p1', registration: 'F-GABC' }
    ]);

    const r = await syncHomeBaseAircraft('LFGA');
    expect(r.imported).toEqual([]);
    expect(communityService.getPresetById).not.toHaveBeenCalled();
    const marker = JSON.parse(localStorage.getItem('homeBaseAutoImport'));
    expect(marker.bases.LFGA).toEqual(['p1']);
  });

  it('échec d\'import → non marqué traité, retenté au passage suivant', async () => {
    communityService.getPresetsByHomeBase.mockResolvedValue([
      { id: 'p1', registration: 'F-GABC' }
    ]);
    communityService.getPresetById.mockRejectedValueOnce(new Error('réseau'));
    const r1 = await syncHomeBaseAircraft('LFGA');
    expect(r1.imported).toEqual([]);

    communityService.getPresetById.mockResolvedValue({ registration: 'F-GABC' });
    const r2 = await syncHomeBaseAircraft('LFGA');
    expect(r2.imported).toEqual(['F-GABC']);
  });

  it('fail-closed : ICAO invalide → aucun appel réseau', async () => {
    const r = await syncHomeBaseAircraft('XY');
    expect(r.imported).toEqual([]);
    expect(communityService.getPresetsByHomeBase).not.toHaveBeenCalled();
  });
});
