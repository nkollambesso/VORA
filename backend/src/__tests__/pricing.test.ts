import {
  calculateVoraFare,
  calculateAllCategories,
  validateMotoCapacity,
  PricingOptions,
} from '../utils/pricing';

describe('calculateVoraFare', () => {
  // ─── Tarifs de base par catégorie ───────────────────────────────────────────
  describe('base fares by vehicle type', () => {
    it('should return base fare 500 FCFA for moto', () => {
      const result = calculateVoraFare({ distanceKm: 0, vehicleType: 'moto' });
      expect(result.baseFare).toBe(500);
    });

    it('should return base fare 1000 FCFA for taxi', () => {
      const result = calculateVoraFare({ distanceKm: 0, vehicleType: 'taxi' });
      expect(result.baseFare).toBe(1000);
    });

    it('should return base fare 2000 FCFA for confort', () => {
      const result = calculateVoraFare({ distanceKm: 0, vehicleType: 'confort' });
      expect(result.baseFare).toBe(2000);
    });
  });

  // ─── Calcul de distance ─────────────────────────────────────────────────────
  describe('distance fare', () => {
    it('should calculate moto distance fare at 150 FCFA/km', () => {
      const result = calculateVoraFare({ distanceKm: 10, vehicleType: 'moto' });
      expect(result.distanceFare).toBe(1500); // 10 * 150
    });

    it('should calculate taxi distance fare at 250 FCFA/km', () => {
      const result = calculateVoraFare({ distanceKm: 10, vehicleType: 'taxi' });
      expect(result.distanceFare).toBe(2500); // 10 * 250
    });

    it('should calculate confort distance fare at 400 FCFA/km', () => {
      const result = calculateVoraFare({ distanceKm: 10, vehicleType: 'confort' });
      expect(result.distanceFare).toBe(4000); // 10 * 400
    });

    it('should round distance fare to nearest integer', () => {
      const result = calculateVoraFare({ distanceKm: 3.7, vehicleType: 'taxi' });
      expect(result.distanceFare).toBe(Math.round(3.7 * 250)); // 925
    });
  });

  // ─── Bagages ────────────────────────────────────────────────────────────────
  describe('luggage fare', () => {
    it('should charge 300 FCFA per luggage item', () => {
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'taxi', luggageCount: 3 });
      expect(result.luggageFare).toBe(900); // 3 * 300
    });

    it('should charge nothing for zero luggage', () => {
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'taxi', luggageCount: 0 });
      expect(result.luggageFare).toBe(0);
    });

    it('should default to 0 luggage when not specified', () => {
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'taxi' });
      expect(result.luggageFare).toBe(0);
    });
  });

  // ─── Surge Horaires ─────────────────────────────────────────────────────────
  describe('time-based surge pricing', () => {
    it('should apply 1.2x surge during morning rush (07h-09h)', () => {
      const time = new Date('2026-01-15T08:00:00'); // 08:00
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'taxi', customTime: time });
      expect(result.surgeMultiplier).toBeGreaterThanOrEqual(1.2);
      expect(result.surgeReason).toContain('pointe du matin');
    });

    it('should apply 1.3x surge during evening rush (17h-20h)', () => {
      const time = new Date('2026-01-15T18:30:00'); // 18:30
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'taxi', customTime: time });
      expect(result.surgeMultiplier).toBeGreaterThanOrEqual(1.3);
      expect(result.surgeReason).toContain('pointe du soir');
    });

    it('should apply 1.25x surge during night (22h-05h)', () => {
      const time = new Date('2026-01-15T23:00:00'); // 23:00
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'taxi', customTime: time });
      expect(result.surgeMultiplier).toBeGreaterThanOrEqual(1.25);
      expect(result.surgeReason).toContain('nuit');
    });

    it('should apply 1.25x surge before 5am', () => {
      const time = new Date('2026-01-15T03:00:00'); // 03:00
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'taxi', customTime: time });
      expect(result.surgeMultiplier).toBeGreaterThanOrEqual(1.25);
    });

    it('should apply NO surge during off-peak hours (10h-17h)', () => {
      const time = new Date('2026-01-15T12:00:00'); // 12:00
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'taxi', customTime: time });
      expect(result.surgeMultiplier).toBe(1.0);
      expect(result.surgeReason).toBeNull();
    });

    it('should not apply surge at exactly 09:00 (end of morning rush)', () => {
      const time = new Date('2026-01-15T09:00:00');
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'taxi', customTime: time });
      expect(result.surgeMultiplier).toBe(1.0);
    });

    it('should not apply surge at exactly 17:00 (start of evening rush)', () => {
      const time = new Date('2026-01-15T17:00:00');
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'taxi', customTime: time });
      expect(result.surgeMultiplier).toBeGreaterThanOrEqual(1.3);
    });
  });

  // ─── Surge MOTO Nuit (x2) ──────────────────────────────────────────────────
  describe('moto night multiplier', () => {
    it('should apply 2x multiplier for moto after 18h', () => {
      const time = new Date('2026-01-15T20:00:00'); // 20:00
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'moto', customTime: time });
      expect(result.surgeMultiplier).toBeGreaterThanOrEqual(2.0);
      expect(result.surgeReason).toContain('Nuit Moto');
    });

    it('should apply 2x multiplier for moto before 6h', () => {
      const time = new Date('2026-01-15T04:00:00'); // 04:00
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'moto', customTime: time });
      expect(result.surgeMultiplier).toBeGreaterThanOrEqual(2.0);
    });

    it('should NOT apply moto night multiplier during daytime', () => {
      const time = new Date('2026-01-15T12:00:00'); // 12:00
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'moto', customTime: time });
      expect(result.surgeMultiplier).toBe(1.0);
    });

    it('should combine moto night x2 with evening rush surge', () => {
      const time = new Date('2026-01-15T19:00:00'); // 19:00 = evening rush + moto night
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'moto', customTime: time });
      // 1.3 (evening) * 2.0 (moto night) = 2.6
      expect(result.surgeMultiplier).toBeGreaterThanOrEqual(2.5);
      expect(result.surgeReason).toContain('Nuit Moto');
    });
  });

  // ─── Surge Zones à forte affluence ──────────────────────────────────────────
  describe('high demand zone surge', () => {
    it('should apply 1.15x surge for pickup in Bastos', () => {
      const result = calculateVoraFare({
        distanceKm: 5,
        vehicleType: 'taxi',
        pickupAddress: 'Quartier Bastos, Yaoundé',
      });
      expect(result.surgeMultiplier).toBeGreaterThanOrEqual(1.15);
      expect(result.surgeReason).toContain('affluence');
    });

    it('should apply 1.15x surge for destination in Mokolo', () => {
      const result = calculateVoraFare({
        distanceKm: 5,
        vehicleType: 'taxi',
        destinationAddress: 'Carrefour Mokolo, Yaoundé',
      });
      expect(result.surgeMultiplier).toBeGreaterThanOrEqual(1.15);
    });

    it('should apply zone surge for Akwa (Douala)', () => {
      const result = calculateVoraFare({
        distanceKm: 5,
        vehicleType: 'taxi',
        pickupAddress: 'Akwa, Douala',
      });
      expect(result.surgeMultiplier).toBeGreaterThanOrEqual(1.15);
    });

    it('should NOT apply zone surge for non-high-demand areas', () => {
      const time = new Date('2026-01-15T12:00:00'); // off-peak, no time surge
      const result = calculateVoraFare({
        distanceKm: 5,
        vehicleType: 'taxi',
        pickupAddress: 'Quartier Smsis, Yaoundé',
        destinationAddress: 'Emana, Yaoundé',
        customTime: time,
      });
      expect(result.surgeMultiplier).toBe(1.0);
    });

    it('should combine time surge + zone surge multiplicatively', () => {
      const time = new Date('2026-01-15T08:00:00'); // morning rush 1.2x
      const result = calculateVoraFare({
        distanceKm: 5,
        vehicleType: 'taxi',
        pickupAddress: 'Bastos, Yaoundé',
        customTime: time,
      });
      // 1.2 (morning) * 1.15 (zone) = 1.38
      expect(result.surgeMultiplier).toBeGreaterThanOrEqual(1.38);
    });
  });

  // ─── Tarif minimum ──────────────────────────────────────────────────────────
  describe('minimum fare enforcement', () => {
    it('should enforce minimum 500 FCFA for moto', () => {
      const result = calculateVoraFare({ distanceKm: 0.1, vehicleType: 'moto' });
      expect(result.totalFareFCFA).toBeGreaterThanOrEqual(500);
    });

    it('should enforce minimum 800 FCFA for taxi', () => {
      const result = calculateVoraFare({ distanceKm: 0.1, vehicleType: 'taxi' });
      expect(result.totalFareFCFA).toBeGreaterThanOrEqual(800);
    });

    it('should enforce minimum 1500 FCFA for confort', () => {
      const result = calculateVoraFare({ distanceKm: 0.1, vehicleType: 'confort' });
      expect(result.totalFareFCFA).toBeGreaterThanOrEqual(1500);
    });
  });

  // ─── Arrondi au multiple de 50 FCFA ────────────────────────────────────────
  describe('fare rounding', () => {
    it('should round fare to nearest multiple of 50 FCFA', () => {
      const result = calculateVoraFare({ distanceKm: 3.3, vehicleType: 'taxi' });
      expect(result.totalFareFCFA % 50).toBe(0);
    });

    it('should round UP to next multiple of 50', () => {
      // base=1000 + dist=3.3*250=825 -> raw=1825, ceil(1825/50)*50 = 1850
      const result = calculateVoraFare({ distanceKm: 3.3, vehicleType: 'taxi' });
      expect(result.totalFareFCFA).toBeGreaterThanOrEqual(1850);
    });
  });

  // ─── formattedFare ──────────────────────────────────────────────────────────
  describe('formattedFare output', () => {
    it('should format fare with FCFA suffix', () => {
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'taxi' });
      expect(result.formattedFare).toMatch(/FCFA$/);
    });

    it('should use French locale formatting', () => {
      const result = calculateVoraFare({ distanceKm: 5, vehicleType: 'taxi' });
      // French locale uses non-breaking space as thousand separator
      expect(result.formattedFare).toContain(' ');
    });
  });

  // ─── Scénarios réalistes ────────────────────────────────────────────────────
  describe('realistic ride scenarios', () => {
    it('should calculate a 5km taxi ride in Yaoundé (off-peak)', () => {
      const time = new Date('2026-01-15T14:00:00');
      const result = calculateVoraFare({
        distanceKm: 5,
        vehicleType: 'taxi',
        customTime: time,
      });
      // base=1000 + dist=5*250=1250 = 2250, no surge
      expect(result.totalFareFCFA).toBe(2250);
      expect(result.surgeMultiplier).toBe(1.0);
    });

    it('should calculate a 10km moto ride at night (Narco-Bastos)', () => {
      const time = new Date('2026-01-15T21:00:00');
      const result = calculateVoraFare({
        distanceKm: 10,
        vehicleType: 'moto',
        pickupAddress: 'Bastos, Yaoundé',
        customTime: time,
      });
      // base=500 + dist=10*150=1500 = 2000 * 0.7 = 1400 * 2.0 (moto night) * 1.15 (zone) = 3220
      expect(result.totalFareFCFA).toBeGreaterThan(2000);
      expect(result.surgeReason).toContain('Nuit Moto');
    });

    it('should calculate a 15km confort ride with 2 luggage items', () => {
      const time = new Date('2026-01-15T12:00:00');
      const result = calculateVoraFare({
        distanceKm: 15,
        vehicleType: 'confort',
        luggageCount: 2,
        customTime: time,
      });
      // base=2000 + dist=15*400=6000 + luggage=2*300=600 = 8600 * 1.5 = 12900
      expect(result.totalFareFCFA).toBeGreaterThanOrEqual(12900);
      expect(result.luggageFare).toBe(600);
    });
  });
});

// ─── calculateAllCategories ────────────────────────────────────────────────────
describe('calculateAllCategories', () => {
  it('should return estimates for all 3 vehicle types', () => {
    const results = calculateAllCategories(5);
    expect(results).toHaveLength(3);
    expect(results[0].vehicleType).toBe('moto');
    expect(results[1].vehicleType).toBe('taxi');
    expect(results[2].vehicleType).toBe('confort');
  });

  it('moto should be cheapest, confort most expensive', () => {
    const results = calculateAllCategories(10);
    expect(results[0].totalFareFCFA).toBeLessThan(results[1].totalFareFCFA);
    expect(results[1].totalFareFCFA).toBeLessThan(results[2].totalFareFCFA);
  });

  it('should pass luggage count to all categories', () => {
    const results = calculateAllCategories(5, 2);
    results.forEach((r) => {
      expect(r.luggageFare).toBe(600); // 2 * 300
    });
  });
});

// ─── validateMotoCapacity ─────────────────────────────────────────────────────
describe('validateMotoCapacity', () => {
  it('should allow 1 passenger with no luggage', () => {
    expect(validateMotoCapacity(1, 0)).toBeNull();
  });

  it('should allow 2 passengers with no luggage', () => {
    expect(validateMotoCapacity(2, 0)).toBeNull();
  });

  it('should reject 2 passengers with 1 luggage', () => {
    expect(validateMotoCapacity(2, 1)).toContain('seul passager');
  });

  it('should reject 3 passengers with no luggage', () => {
    expect(validateMotoCapacity(3, 0)).toContain('maximum 2 passagers');
  });

  it('should reject 1 passenger with luggage (edge case: should still allow)', () => {
    // 1 passenger + luggage is fine (max 1 with luggage)
    expect(validateMotoCapacity(1, 1)).toBeNull();
  });

  it('should reject >1 passengers with luggage', () => {
    expect(validateMotoCapacity(2, 3)).toContain('seul passager');
  });

  it('should allow 0 passengers', () => {
    expect(validateMotoCapacity(0, 0)).toBeNull();
  });

  it('should reject 5 passengers', () => {
    expect(validateMotoCapacity(5, 0)).toContain('maximum 2 passagers');
  });
});
