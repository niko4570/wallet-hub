import { formatPercentChange } from '../format';

describe('formatPercentChange utility', () => {
  describe('Positive values', () => {
    it('should format positive values with + sign and two decimal places', () => {
      expect(formatPercentChange(5.1234)).toBe('+5.12%');
      expect(formatPercentChange(10.9876)).toBe('+10.99%');
      expect(formatPercentChange(0.5)).toBe('+0.50%');
      expect(formatPercentChange(100)).toBe('+100.00%');
    });
  });

  describe('Negative values', () => {
    it('should format negative values with - sign and two decimal places', () => {
      expect(formatPercentChange(-5.1234)).toBe('-5.12%');
      expect(formatPercentChange(-10.9876)).toBe('-10.99%');
      expect(formatPercentChange(-0.5)).toBe('-0.50%');
      expect(formatPercentChange(-100)).toBe('-100.00%');
    });
  });

  describe('Zero values', () => {
    it('should format zero as 0.00%', () => {
      expect(formatPercentChange(0)).toBe('0.00%');
      expect(formatPercentChange(-0)).toBe('0.00%');
    });
  });

  describe('Edge cases', () => {
    it('should handle very small positive values', () => {
      expect(formatPercentChange(0.001)).toBe('+0.00%');
      expect(formatPercentChange(0.005)).toBe('+0.01%');
    });

    it('should handle very small negative values', () => {
      expect(formatPercentChange(-0.001)).toBe('-0.00%');
      expect(formatPercentChange(-0.005)).toBe('-0.01%');
    });

    it('should handle large values', () => {
      expect(formatPercentChange(1000.1234)).toBe('+1000.12%');
      expect(formatPercentChange(-1000.9876)).toBe('-1000.99%');
    });
  });

  describe('Invalid inputs', () => {
    it('should handle null input', () => {
      expect(formatPercentChange(null as any)).toBe('0.00%');
    });

    it('should handle undefined input', () => {
      expect(formatPercentChange(undefined as any)).toBe('0.00%');
    });

    it('should handle NaN input', () => {
      expect(formatPercentChange(NaN)).toBe('0.00%');
    });

    it('should handle Infinity input', () => {
      expect(formatPercentChange(Infinity)).toBe('0.00%');
      expect(formatPercentChange(-Infinity)).toBe('0.00%');
    });
  });

  describe('Rounding behavior', () => {
    it('should round up when decimal is 5 or more', () => {
      expect(formatPercentChange(5.125)).toBe('+5.13%');
      expect(formatPercentChange(-5.125)).toBe('-5.13%');
    });

    it('should round down when decimal is less than 5', () => {
      expect(formatPercentChange(5.124)).toBe('+5.12%');
      expect(formatPercentChange(-5.124)).toBe('-5.12%');
    });

    it('should maintain two decimal places even when zero', () => {
      expect(formatPercentChange(5)).toBe('+5.00%');
      expect(formatPercentChange(-5)).toBe('-5.00%');
    });
  });
});
