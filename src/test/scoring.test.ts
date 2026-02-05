import { describe, it, expect } from 'vitest';

/**
 * Tests for the scoring formulas used in PharmaTrack Performance
 * 
 * Formulas:
 * - raw_points = sum(event_points) + bonus_polyvalence
 * - bonus_polyvalence = max(0, positions_count - 2) * 0.5
 * - score100 = clamp(80 + raw_points, 0, 100)
 * - note20 = round(score100 / 5, 1)
 * 
 * Anti-gaming rules:
 * - Daily bonus cap: max +1.5 per operator per day
 * - No cap on malus (negative points)
 * 
 * Work days rule:
 * - Operators with < 60 work days are flagged (not excluded from ranking, but marked)
 */

// Helper functions that mirror the RPC logic
function calculateBonusPolyvalence(positionsCount: number): number {
  return Math.max(0, positionsCount - 2) * 0.5;
}

function calculateRawPoints(
  eventPoints: number,
  positionsCount: number
): number {
  return eventPoints + calculateBonusPolyvalence(positionsCount);
}

function calculateScore100(rawPoints: number): number {
  return Math.min(100, Math.max(0, 80 + rawPoints));
}

function calculateNote20(score100: number): number {
  return Math.round((score100 / 5) * 10) / 10;
}

function capDailyBonus(bonusPoints: number): number {
  return Math.min(bonusPoints, 1.5);
}

describe('Scoring Formulas', () => {
  describe('Bonus Polyvalence', () => {
    it('should return 0 for 0 positions', () => {
      expect(calculateBonusPolyvalence(0)).toBe(0);
    });

    it('should return 0 for 1 position', () => {
      expect(calculateBonusPolyvalence(1)).toBe(0);
    });

    it('should return 0 for 2 positions', () => {
      expect(calculateBonusPolyvalence(2)).toBe(0);
    });

    it('should return 0.5 for 3 positions', () => {
      expect(calculateBonusPolyvalence(3)).toBe(0.5);
    });

    it('should return 1.0 for 4 positions', () => {
      expect(calculateBonusPolyvalence(4)).toBe(1.0);
    });

    it('should return 2.5 for 7 positions', () => {
      expect(calculateBonusPolyvalence(7)).toBe(2.5);
    });
  });

  describe('Raw Points Calculation', () => {
    it('should calculate raw points with no polyvalence bonus', () => {
      expect(calculateRawPoints(5, 2)).toBe(5);
    });

    it('should add polyvalence bonus correctly', () => {
      expect(calculateRawPoints(5, 4)).toBe(6); // 5 + 1.0
    });

    it('should handle negative event points', () => {
      expect(calculateRawPoints(-3, 3)).toBe(-2.5); // -3 + 0.5
    });

    it('should handle zero event points', () => {
      expect(calculateRawPoints(0, 5)).toBe(1.5); // 0 + 1.5
    });
  });

  describe('Score100 Calculation', () => {
    it('should start at base 80', () => {
      expect(calculateScore100(0)).toBe(80);
    });

    it('should add positive points', () => {
      expect(calculateScore100(10)).toBe(90);
    });

    it('should subtract negative points', () => {
      expect(calculateScore100(-10)).toBe(70);
    });

    it('should clamp at maximum 100', () => {
      expect(calculateScore100(30)).toBe(100);
    });

    it('should clamp at minimum 0', () => {
      expect(calculateScore100(-100)).toBe(0);
    });

    it('should handle edge case at exactly 100', () => {
      expect(calculateScore100(20)).toBe(100);
    });

    it('should handle edge case at exactly 0', () => {
      expect(calculateScore100(-80)).toBe(0);
    });
  });

  describe('Note20 Calculation', () => {
    it('should convert 100/100 to 20/20', () => {
      expect(calculateNote20(100)).toBe(20);
    });

    it('should convert 80/100 to 16/20', () => {
      expect(calculateNote20(80)).toBe(16);
    });

    it('should convert 50/100 to 10/20', () => {
      expect(calculateNote20(50)).toBe(10);
    });

    it('should convert 0/100 to 0/20', () => {
      expect(calculateNote20(0)).toBe(0);
    });

    it('should round to 1 decimal place', () => {
      expect(calculateNote20(83)).toBe(16.6);
    });

    it('should round 87.5 correctly', () => {
      expect(calculateNote20(87)).toBe(17.4);
    });
  });

  describe('Daily Bonus Cap', () => {
    it('should not cap bonus under 1.5', () => {
      expect(capDailyBonus(1.0)).toBe(1.0);
    });

    it('should cap bonus at exactly 1.5', () => {
      expect(capDailyBonus(1.5)).toBe(1.5);
    });

    it('should cap bonus above 1.5', () => {
      expect(capDailyBonus(3.0)).toBe(1.5);
    });

    it('should handle zero bonus', () => {
      expect(capDailyBonus(0)).toBe(0);
    });

    it('should not cap negative values (malus)', () => {
      // Malus should not be capped, so we expect the original value
      // In real implementation, we only cap positive values
      expect(capDailyBonus(-5)).toBe(-5);
    });
  });

  describe('Full Scoring Pipeline', () => {
    it('should calculate correct score for operator with 0 events and 2 positions', () => {
      const rawPoints = calculateRawPoints(0, 2);
      const score100 = calculateScore100(rawPoints);
      const note20 = calculateNote20(score100);

      expect(rawPoints).toBe(0);
      expect(score100).toBe(80);
      expect(note20).toBe(16);
    });

    it('should calculate correct score for operator with +5 points and 4 positions', () => {
      const rawPoints = calculateRawPoints(5, 4);
      const score100 = calculateScore100(rawPoints);
      const note20 = calculateNote20(score100);

      expect(rawPoints).toBe(6); // 5 + 1.0 polyvalence
      expect(score100).toBe(86);
      expect(note20).toBe(17.2);
    });

    it('should calculate correct score for operator with -15 points and 3 positions', () => {
      const rawPoints = calculateRawPoints(-15, 3);
      const score100 = calculateScore100(rawPoints);
      const note20 = calculateNote20(score100);

      expect(rawPoints).toBe(-14.5); // -15 + 0.5 polyvalence
      expect(score100).toBe(65.5);
      expect(note20).toBe(13.1);
    });

    it('should max out at 100/20 for very high performers', () => {
      const rawPoints = calculateRawPoints(25, 6);
      const score100 = calculateScore100(rawPoints);
      const note20 = calculateNote20(score100);

      expect(rawPoints).toBe(27); // 25 + 2.0 polyvalence
      expect(score100).toBe(100); // clamped
      expect(note20).toBe(20);
    });

    it('should bottom out at 0/0 for very low performers', () => {
      const rawPoints = calculateRawPoints(-90, 1);
      const score100 = calculateScore100(rawPoints);
      const note20 = calculateNote20(score100);

      expect(rawPoints).toBe(-90);
      expect(score100).toBe(0); // clamped
      expect(note20).toBe(0);
    });
  });

  describe('Work Days Rule', () => {
    const WORK_DAYS_THRESHOLD = 60;

    it('should flag operator with 59 work days', () => {
      const workDays = 59;
      const isEligible = workDays >= WORK_DAYS_THRESHOLD;
      expect(isEligible).toBe(false);
    });

    it('should not flag operator with 60 work days', () => {
      const workDays = 60;
      const isEligible = workDays >= WORK_DAYS_THRESHOLD;
      expect(isEligible).toBe(true);
    });

    it('should not flag operator with 100 work days', () => {
      const workDays = 100;
      const isEligible = workDays >= WORK_DAYS_THRESHOLD;
      expect(isEligible).toBe(true);
    });
  });
});
