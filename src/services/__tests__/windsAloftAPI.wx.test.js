// Tests de sampleWx (Lot 6-C — « TEMSI chiffrée ») : lecture des phénomènes
// significatifs au point/heure depuis un profil Open-Meteo en cache.
import { describe, it, expect } from 'vitest';
import { sampleWx } from '../windsAloftAPI';

const WX_10H = {
  freezingLevelFt: 9800,
  cloudCoverLowPct: 20,
  cloudCoverMidPct: 50,
  cloudCoverHighPct: 80,
  visibilityM: 40000,
  capeJkg: 120
};

const WX_11H = {
  freezingLevelFt: 9500,
  cloudCoverLowPct: 90,
  cloudCoverMidPct: 100,
  cloudCoverHighPct: 100,
  visibilityM: 3000,
  capeJkg: 1500
};

const PROFILE = {
  latitude: 45.0,
  longitude: 5.0,
  source: 'open-meteo',
  fetchedAt: 0,
  hours: [
    { timeISO: '2026-08-07T10:00', levels: [], wx: WX_10H },
    { timeISO: '2026-08-07T11:00', levels: [], wx: WX_11H }
  ]
};

describe('sampleWx', () => {
  it('retourne le wx de l\'heure la plus proche avec source et timeISO', () => {
    const wx = sampleWx(PROFILE, new Date('2026-08-07T10:10:00Z'));
    expect(wx).toMatchObject(WX_10H);
    expect(wx.source).toBe('open-meteo');
    expect(wx.timeISO).toBe('2026-08-07T10:00');
  });

  it('bascule sur l\'heure suivante après la demi-heure', () => {
    const wx = sampleWx(PROFILE, new Date('2026-08-07T10:45:00Z'));
    expect(wx.visibilityM).toBe(3000);
    expect(wx.capeJkg).toBe(1500);
  });

  it('fail-closed : profil vide → null', () => {
    expect(sampleWx(null)).toBeNull();
    expect(sampleWx({ hours: [] })).toBeNull();
  });

  it('fail-closed : heure sans bloc wx (profil pré-6-C en cache) → null', () => {
    const old = { ...PROFILE, hours: [{ timeISO: '2026-08-07T10:00', levels: [] }] };
    expect(sampleWx(old, new Date('2026-08-07T10:00:00Z'))).toBeNull();
  });

  it('hors horizon (> 3 h de la meilleure heure) → null, pas de wx périmé', () => {
    expect(sampleWx(PROFILE, new Date('2026-08-12T10:00:00Z'))).toBeNull();
  });
});
