import { generatePublicId, formatDisplayName, maskPhoneNumber } from '../utils/anonymize';

// ─── generatePublicId ────────────────────────────────────────────────────────
describe('generatePublicId', () => {
  it('should return format VORA-XXXXXX', () => {
    const id = generatePublicId();
    expect(id).toMatch(/^VORA-[A-Z2-9]{6}$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generatePublicId());
    }
    // With 32^6 = ~1 billion combinations, 100 should all be unique
    expect(ids.size).toBe(100);
  });

  it('should only use unambiguous characters (no 0, O, 1, I)', () => {
    const id = generatePublicId();
    const code = id.replace('VORA-', '');
    expect(code).not.toMatch(/[01IO]/);
  });

  it('should always start with VORA-', () => {
    for (let i = 0; i < 20; i++) {
      expect(generatePublicId()).toMatch(/^VORA-/);
    }
  });

  it('should have exactly 6 characters after VORA-', () => {
    for (let i = 0; i < 20; i++) {
      const id = generatePublicId();
      const code = id.replace('VORA-', '');
      expect(code.length).toBe(6);
    }
  });
});

// ─── formatDisplayName ───────────────────────────────────────────────────────
describe('formatDisplayName', () => {
  it('should format "Jean-Paul Tchouamo" → "Jean-Paul T."', () => {
    expect(formatDisplayName('Jean-Paul Tchouamo')).toBe('Jean-Paul T.');
  });

  it('should format "Patrick Assako" → "Patrick A."', () => {
    expect(formatDisplayName('Patrick Assako')).toBe('Patrick A.');
  });

  it('should format single name "Grace" → "Grace"', () => {
    expect(formatDisplayName('Grace')).toBe('Grace');
  });

  it('should format "Legrand Fils Onana" → "Legrand Fils O."', () => {
    expect(formatDisplayName('Legrand Fils Onana')).toBe('Legrand Fils O.');
  });

  it('should return "Utilisateur VORA" for undefined', () => {
    expect(formatDisplayName(undefined)).toBe('Utilisateur VORA');
  });

  it('should return "Utilisateur VORA" for empty string', () => {
    expect(formatDisplayName('')).toBe('Utilisateur VORA');
  });

  it('should return "Utilisateur VORA" for whitespace only', () => {
    expect(formatDisplayName('   ')).toBe('Utilisateur VORA');
  });

  it('should uppercase the last initial', () => {
    expect(formatDisplayName('jean dupont')).toBe('jean D.');
  });

  it('should handle leading/trailing spaces', () => {
    expect(formatDisplayName('  Patrick Assako  ')).toBe('Patrick A.');
  });

  it('should handle multiple spaces between names (normalized by split)', () => {
    expect(formatDisplayName('Jean  Paul  Tchouamo')).toBe('Jean Paul T.');
  });

  it('should handle names with hyphens', () => {
    expect(formatDisplayName('Marie-Claire Ouango')).toBe('Marie-Claire O.');
  });

  it('should handle single character last name', () => {
    expect(formatDisplayName('Jean K')).toBe('Jean K.');
  });

  it('should handle two-part first name + last name', () => {
    expect(formatDisplayName('Jean Paul Kamga')).toBe('Jean Paul K.');
  });
});

// ─── maskPhoneNumber ────────────────────────────────────────────────────────
describe('maskPhoneNumber', () => {
  it('should mask Cameroon phone number correctly', () => {
    const masked = maskPhoneNumber('+237699112233');
    // substring(0,7) = '+237699', last 2 = '33'
    expect(masked).toBe('+237699 ** ** 33');
  });

  it('should mask short number correctly', () => {
    const masked = maskPhoneNumber('699112233');
    expect(masked).toBe('6991122 ** ** 33');
  });

  it('should return "Masqué" for undefined', () => {
    expect(maskPhoneNumber(undefined)).toBe('Masqué');
  });

  it('should return "Masqué" for empty string', () => {
    expect(maskPhoneNumber('')).toBe('Masqué');
  });

  it('should return "Masqué" for very short number (< 6 chars)', () => {
    expect(maskPhoneNumber('12345')).toBe('Masqué');
  });

  it('should handle number with spaces', () => {
    const masked = maskPhoneNumber('+237 699 112 233');
    expect(masked).toContain('**');
    expect(masked).toContain('33');
  });

  it('should always show first 7 characters', () => {
    const masked = maskPhoneNumber('+237699112233');
    expect(masked.startsWith('+237699')).toBe(true);
  });

  it('should always show last 2 characters', () => {
    const masked = maskPhoneNumber('+237699112233');
    expect(masked.endsWith('33')).toBe(true);
  });

  it('should handle exactly 6 characters (minimum valid)', () => {
    const masked = maskPhoneNumber('123456');
    expect(masked).toBe('123456 ** ** 56');
  });

  it('should handle long international number', () => {
    const masked = maskPhoneNumber('+33612345678');
    expect(masked).toBe('+336123 ** ** 78');
  });
});

// ─── Tests d'intégration (combinaison de fonctions) ──────────────────────────
describe('anonymization pipeline', () => {
  it('should generate ID and format name independently', () => {
    const id = generatePublicId();
    const name = formatDisplayName('Jean-Paul Tchouamo');
    expect(id).toMatch(/^VORA-[A-Z2-9]{6}$/);
    expect(name).toBe('Jean-Paul T.');
  });

  it('should mask phone and format name for privacy', () => {
    const displayName = formatDisplayName('Patrick Assako');
    const maskedPhone = maskPhoneNumber('+237699112233');
    expect(displayName).not.toContain('Assako');
    expect(maskedPhone).not.toContain('69911');
  });

  it('public IDs should not contain lowercase or ambiguous chars', () => {
    for (let i = 0; i < 50; i++) {
      const id = generatePublicId();
      const code = id.replace('VORA-', '');
      // No lowercase letters
      expect(code).not.toMatch(/[a-z]/);
      // No ambiguous chars (0, O, 1, I)
      expect(code).not.toMatch(/[0OI1]/);
    }
  });
});
