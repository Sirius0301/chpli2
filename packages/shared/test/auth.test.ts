import { describe, expect, it } from 'vitest';
import {
  detectIdentifierType,
  normalizeEmail,
  normalizePhone,
} from '../src/auth.js';

describe('identifier helpers (M0 增强)', () => {
  it('normalizes emails to lowercase', () => {
    expect(normalizeEmail('  Sirius@Example.COM ')).toBe('sirius@example.com');
  });

  it('normalizes phones by stripping separators', () => {
    expect(normalizePhone('138 0011-2233')).toBe('13800112233');
    expect(normalizePhone('+86 138-0011-2233')).toBe('+8613800112233');
    expect(normalizePhone('1234')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('+abc')).toBeNull();
  });

  it('detects identifier types (D6)', () => {
    expect(detectIdentifierType('alice')).toBe('username');
    expect(detectIdentifierType('a.b-c_d')).toBe('username');
    expect(detectIdentifierType('alice@example.com')).toBe('email');
    expect(detectIdentifierType('13800112233')).toBe('phone');
    expect(detectIdentifierType('+8613800112233')).toBe('phone');
    expect(detectIdentifierType('010-1234-5678')).toBe('phone');
  });
});
