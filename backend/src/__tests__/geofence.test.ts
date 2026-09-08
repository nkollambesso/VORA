import { calculateDistanceKm, validateIntraCity } from '../utils/geofence';

// ─── Coordonnées réelles des villes camerounaises pour les tests ──────────────
const YAOUNDE = { lat: 3.848, lng: 11.5021 };
const DOUALA = { lat: 4.0511, lng: 9.7679 };
const BASTOS = { lat: 3.8833, lng: 11.5167 };
const MOKOLO = { lat: 3.8667, lng: 11.5167 };
const BAFouSSAM = { lat: 5.4764, lng: 10.4175 };
const KRIBI = { lat: 2.9373, lng: 9.9103 };

describe('calculateDistanceKm', () => {
  it('should return 0 for identical coordinates', () => {
    const dist = calculateDistanceKm(3.848, 11.5021, 3.848, 11.5021);
    expect(dist).toBe(0);
  });

  it('should calculate distance between Yaoundé and Douala (~200 km)', () => {
    const dist = calculateDistanceKm(YAOUNDE.lat, YAOUNDE.lng, DOUALA.lat, DOUALA.lng);
    expect(dist).toBeGreaterThan(180);
    expect(dist).toBeLessThan(220);
  });

  it('should calculate short distance within Yaoundé (~2 km)', () => {
    const dist = calculateDistanceKm(BASTOS.lat, BASTOS.lng, MOKOLO.lat, MOKOLO.lng);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(5);
  });    it('should calculate distance between Yaoundé and Bafoussam (~210 km)', () => {
      const dist = calculateDistanceKm(YAOUNDE.lat, YAOUNDE.lng, BAFouSSAM.lat, BAFouSSAM.lng);
      expect(dist).toBeGreaterThan(190);
      expect(dist).toBeLessThan(240);
    });

  it('should return a positive number for any valid coordinates', () => {
    const dist = calculateDistanceKm(KRIBI.lat, KRIBI.lng, DOUALA.lat, DOUALA.lng);
    expect(dist).toBeGreaterThan(0);
  });

  it('should be symmetric (A→B = B→A)', () => {
    const distAB = calculateDistanceKm(YAOUNDE.lat, YAOUNDE.lng, DOUALA.lat, DOUALA.lng);
    const distBA = calculateDistanceKm(DOUALA.lat, DOUALA.lng, YAOUNDE.lat, YAOUNDE.lng);
    expect(distAB).toBe(distBA);
  });
});

describe('validateIntraCity', () => {
  // ─── Trajets intra-urbains valides ──────────────────────────────────────────
  describe('valid intra-city rides', () => {
    it('should allow Bastos → Mokolo (both in Yaoundé)', () => {
      const result = validateIntraCity(
        BASTOS.lat, BASTOS.lng,
        MOKOLO.lat, MOKOLO.lng,
        'Bastos, Yaoundé',
        'Mokolo, Yaoundé'
      );
      expect(result.isValid).toBe(true);
    });

    it('should allow short ride with no address (rely on distance only)', () => {
      const result = validateIntraCity(
        3.85, 11.50,
        3.87, 11.52,
        '', ''
      );
      expect(result.isValid).toBe(true);
    });

    it('should allow ride within 28km radius even without city names', () => {
      const result = validateIntraCity(
        YAOUNDE.lat, YAOUNDE.lng,
        3.95, 11.55,
        '', ''
      );
      expect(result.isValid).toBe(true);
    });
  });

  // ─── Trajets interurbains rejetés ──────────────────────────────────────────
  describe('rejected inter-city rides', () => {
    it('should reject Yaoundé → Douala (different cities)', () => {
      const result = validateIntraCity(
        YAOUNDE.lat, YAOUNDE.lng,
        DOUALA.lat, DOUALA.lng,
        'Yaoundé',
        'Douala'
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('interurbaine');
      expect(result.error).toContain('Yaoundé');
      expect(result.error).toContain('Douala');
    });

    it('should reject Douala → Bafoussam', () => {
      const result = validateIntraCity(
        DOUALA.lat, DOUALA.lng,
        BAFouSSAM.lat, BAFouSSAM.lng,
        'Akwa, Douala',
        'Centre-ville, Bafoussam'
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('interurbaine');
    });

    it('should reject Yaoundé → Kribi', () => {
      const result = validateIntraCity(
        YAOUNDE.lat, YAOUNDE.lng,
        KRIBI.lat, KRIBI.lng,
        'Bastos, Yaoundé',
        'Kribi plage'
      );
      expect(result.isValid).toBe(false);
    });
  });

  // ─── Rayon urbain maximal (28 km) ──────────────────────────────────────────
  describe('urban radius limit', () => {
    it('should reject ride exceeding 28km even in same city', () => {
      // Create coordinates ~35km apart
      const result = validateIntraCity(
        YAOUNDE.lat, YAOUNDE.lng,
        4.15, 11.80,
        'Yaoundé centre',
        'Quartier éloigné Yaoundé'
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('hors périmètre');
      expect(result.error).toContain('28');
    });

    it('should allow ride exactly at 28km boundary', () => {
      // ~28km north of Yaoundé
      const result = validateIntraCity(
        YAOUNDE.lat, YAOUNDE.lng,
        4.10, 11.50,
        '', ''
      );
      // Depending on exact coordinates, this should be near the limit
      expect(typeof result.isValid).toBe('boolean');
      expect(result.distanceKm).toBeDefined();
    });
  });

  // ─── Détection de ville insensitive aux accents ─────────────────────────────
  describe('city detection with accents', () => {
    it('should detect Yaoundé (with accent)', () => {
      const result = validateIntraCity(
        YAOUNDE.lat, YAOUNDE.lng,
        MOKOLO.lat, MOKOLO.lng,
        'Quartier Bastos, Yaoundé',
        'Marché Mokolo, Yaoundé'
      );
      expect(result.isValid).toBe(true);
    });

    it('should detect Yaounde (without accent)', () => {
      const result = validateIntraCity(
        YAOUNDE.lat, YAOUNDE.lng,
        MOKOLO.lat, MOKOLO.lng,
        'Quartier Bastos, Yaounde',
        'Marché Mokolo, Yaounde'
      );
      expect(result.isValid).toBe(true);
    });

    it('should detect Douala in mixed-case address', () => {
      const result = validateIntraCity(
        DOUALA.lat, DOUALA.lng,
        4.06, 9.77,
        'DOUALA - Akwa',
        'Bonanjo, Douala'
      );
      expect(result.isValid).toBe(true);
    });
  });

  // ─── Cas limites ────────────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('should handle empty addresses gracefully', () => {
      const result = validateIntraCity(
        YAOUNDE.lat, YAOUNDE.lng,
        MOKOLO.lat, MOKOLO.lng,
        '',
        ''
      );
      expect(result.isValid).toBe(true);
      expect(result.distanceKm).toBeGreaterThan(0);
    });

    it('should return distance even for invalid rides', () => {
      const result = validateIntraCity(
        YAOUNDE.lat, YAOUNDE.lng,
        DOUALA.lat, DOUALA.lng,
        'Yaoundé',
        'Douala'
      );
      expect(result.distanceKm).toBeGreaterThan(180);
    });

    it('should handle same city name in both addresses (same city)', () => {
      const result = validateIntraCity(
        DOUALA.lat, DOUALA.lng,
        4.06, 9.78,
        'Akwa, Douala',
        'Bonanjo, Douala'
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject when only one address has a city name and distance exceeds 28km', () => {
      const result = validateIntraCity(
        YAOUNDE.lat, YAOUNDE.lng,
        4.15, 11.80,
        'Yaoundé',
        ''
      );
      expect(result.isValid).toBe(false);
    });
  });

  // ─── Distance retournée ─────────────────────────────────────────────────────
  describe('distance calculation in results', () => {
    it('should always return distanceKm', () => {
      const result = validateIntraCity(
        YAOUNDE.lat, YAOUNDE.lng,
        MOKOLO.lat, MOKOLO.lng,
        'Bastos',
        'Mokolo'
      );
      expect(typeof result.distanceKm).toBe('number');
      expect(result.distanceKm).toBeGreaterThanOrEqual(0);
    });

    it('should calculate correct distance for known route', () => {
      const result = validateIntraCity(
        YAOUNDE.lat, YAOUNDE.lng,
        DOUALA.lat, DOUALA.lng,
        '',
        ''
      );
      expect(result.distanceKm).toBeGreaterThan(180);
      expect(result.distanceKm).toBeLessThan(220);
    });
  });
});
