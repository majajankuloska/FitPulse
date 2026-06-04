import { describe, expect, it } from 'vitest';
import {
  buildDashboardSummary,
  buildScatterData,
  calcBMI,
  calcMacroRatio,
  calcProgress,
  exportEntriesToCsv,
  interpretCorrelation,
  pearsonCorrelation
} from '../server/domain.js';

describe('FitPulse domain logic', () => {
  it('calculates BMI from weight and height', () => {
    expect(calcBMI(72, 180)).toBe(22.22);
  });

  it('builds macro calorie percentages', () => {
    const ratio = calcMacroRatio({ calories: 500, proteinGrams: 25, carbohydratesGrams: 50, fatGrams: 10 });
    expect(ratio.protein).toBeGreaterThan(0);
    expect(ratio.carbohydrates).toBeGreaterThan(ratio.fat);
  });

  it('computes correlation and interpretation', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(1, 2);
    expect(interpretCorrelation(0.63)).toContain('moderate positive');
  });

  it('builds dashboard summaries and CSV output', () => {
    const entries = [
      { type: 'workout', loggedAt: '2025-05-01T10:00:00.000Z', durationMinutes: 30, caloriesBurned: 250 },
      { type: 'nutrition', loggedAt: '2025-05-01T12:00:00.000Z', calories: 600 },
      { type: 'sleep', loggedAt: '2025-05-02T08:00:00.000Z', durationHours: 7.5 }
    ];

    const summary = buildDashboardSummary(entries);
    expect(summary.totals.workoutMinutes).toBe(30);
    expect(summary.totals.nutritionCalories).toBe(600);
    expect(exportEntriesToCsv(entries)).toContain('workout');
  });

  it('creates scatter data and goal progress', () => {
    const entries = Array.from({ length: 7 }, (_, index) => ({
      type: 'workout',
      loggedAt: `2025-05-0${index + 1}T08:00:00.000Z`,
      durationMinutes: 20 + index * 5,
      caloriesBurned: 200 + index * 20
    }));

    expect(buildScatterData(entries, 'workoutMinutes', 'workoutCalories')).toHaveLength(7);
    expect(calcProgress({ metric: 'workoutMinutes', targetValue: 100 }, entries)).toBe(100);
  });
});
