export const goalStatuses = Object.freeze({
  ACTIVE: 'ACTIVE',
  ACHIEVED: 'ACHIEVED',
  ARCHIVED: 'ARCHIVED'
});

export const chartTypes = Object.freeze({
  LINE: 'LINE',
  BAR: 'BAR',
  SCATTER: 'SCATTER'
});

export function minutesBetween(start, end) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  return Math.max(0, (endTime - startTime) / 60000);
}

export function calcBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm) {
    return 0;
  }

  const heightMeters = heightCm / 100;
  return Number((weightKg / (heightMeters * heightMeters)).toFixed(2));
}

export function calcMacroRatio({ calories, proteinGrams, carbohydratesGrams, fatGrams }) {
  const proteinCalories = proteinGrams * 4;
  const carbohydrateCalories = carbohydratesGrams * 4;
  const fatCalories = fatGrams * 9;
  const totalMacroCalories = proteinCalories + carbohydrateCalories + fatCalories;
  const baseline = calories || totalMacroCalories || 1;

  return {
    protein: Number(((proteinCalories / baseline) * 100).toFixed(1)),
    carbohydrates: Number(((carbohydrateCalories / baseline) * 100).toFixed(1)),
    fat: Number(((fatCalories / baseline) * 100).toFixed(1))
  };
}

export function calcMET({ activityType, durationMinutes, intensity = 'moderate' }) {
  const activityMap = {
    running: 9.8,
    cycling: 7.5,
    strength: 6.0,
    yoga: 3.0,
    walking: 3.5,
    swimming: 8.0
  };

  const intensityModifier = {
    low: 0.8,
    moderate: 1,
    high: 1.25
  };

  const base = activityMap[activityType?.toLowerCase()] ?? 5.0;
  const modifier = intensityModifier[intensity] ?? 1;
  return Number((base * modifier * (durationMinutes / 60)).toFixed(2));
}

export function calcSleepEfficiency(bedtime, wakeTime, sleepHours) {
  const timeInBedHours = Math.max(minutesBetween(bedtime, wakeTime) / 60, sleepHours);
  if (timeInBedHours === 0) {
    return 0;
  }

  return Number(((sleepHours / timeInBedHours) * 100).toFixed(1));
}

export function pearsonCorrelation(pointsX, pointsY) {
  const length = Math.min(pointsX.length, pointsY.length);
  if (length < 2) {
    return 0;
  }

  const xs = pointsX.slice(0, length);
  const ys = pointsY.slice(0, length);
  const meanX = xs.reduce((sum, value) => sum + value, 0) / length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / length;

  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;

  for (let index = 0; index < length; index += 1) {
    const deltaX = xs[index] - meanX;
    const deltaY = ys[index] - meanY;
    numerator += deltaX * deltaY;
    denominatorX += deltaX * deltaX;
    denominatorY += deltaY * deltaY;
  }

  const denominator = Math.sqrt(denominatorX * denominatorY);
  if (!denominator) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(3));
}

export function interpretCorrelation(value) {
  const magnitude = Math.abs(value);
  const direction = value >= 0 ? 'positive' : 'negative';

  if (magnitude < 0.2) {
    return 'very weak';
  }

  if (magnitude < 0.45) {
    return `weak ${direction}`;
  }

  if (magnitude < 0.7) {
    return `moderate ${direction}`;
  }

  return `strong ${direction}`;
}

export function aggregateEntries(entries) {
  return entries.reduce(
    (accumulator, entry) => {
      if (entry.type === 'workout') {
        accumulator.workoutMinutes += entry.durationMinutes ?? 0;
        accumulator.workoutCalories += entry.caloriesBurned ?? 0;
        accumulator.workouts += 1;
      }

      if (entry.type === 'nutrition') {
        accumulator.nutritionCalories += entry.calories ?? 0;
        accumulator.nutritionEntries += 1;
      }

      if (entry.type === 'sleep') {
        accumulator.sleepHours += entry.durationHours ?? 0;
        accumulator.sleepEntries += 1;
      }

      if (entry.type === 'bodyMetrics') {
        accumulator.latestWeightKg = entry.weightKg ?? accumulator.latestWeightKg;
        accumulator.latestBodyFat = entry.bodyFatPercent ?? accumulator.latestBodyFat;
      }

      return accumulator;
    },
    {
      workoutMinutes: 0,
      workoutCalories: 0,
      workouts: 0,
      nutritionCalories: 0,
      nutritionEntries: 0,
      sleepHours: 0,
      sleepEntries: 0,
      latestWeightKg: null,
      latestBodyFat: null
    }
  );
}

export function buildDashboardSummary(entries) {
  const totals = aggregateEntries(entries);
  return {
    totals,
    averages: {
      workoutMinutes: totals.workouts ? Number((totals.workoutMinutes / totals.workouts).toFixed(1)) : 0,
      sleepHours: totals.sleepEntries ? Number((totals.sleepHours / totals.sleepEntries).toFixed(1)) : 0,
      nutritionCalories: totals.nutritionEntries ? Number((totals.nutritionCalories / totals.nutritionEntries).toFixed(1)) : 0
    }
  };
}

export function exportEntriesToCsv(entries) {
  const headers = [
    'entryId',
    'type',
    'loggedAt',
    'createdAt',
    'title',
    'calories',
    'durationMinutes',
    'durationHours',
    'weightKg',
    'bodyFatPercent',
    'bmi',
    'notes'
  ];

  const rows = entries.map((entry) => [
    entry.entryId,
    entry.type,
    entry.loggedAt,
    entry.createdAt,
    entry.title ?? '',
    entry.calories ?? '',
    entry.durationMinutes ?? '',
    entry.durationHours ?? '',
    entry.weightKg ?? '',
    entry.bodyFatPercent ?? '',
    entry.bmi ?? '',
    entry.notes ?? ''
  ]);

  return [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

export function buildMetricSeries(entries, metric) {
  return entries
    .slice()
    .sort((left, right) => new Date(left.loggedAt).getTime() - new Date(right.loggedAt).getTime())
    .map((entry) => {
      let value = 0;

      if (metric === 'workoutMinutes' && entry.type === 'workout') {
        value = entry.durationMinutes ?? 0;
      }

      if (metric === 'workoutCalories' && entry.type === 'workout') {
        value = entry.caloriesBurned ?? 0;
      }

      if (metric === 'nutritionCalories' && entry.type === 'nutrition') {
        value = entry.calories ?? 0;
      }

      if (metric === 'sleepHours' && entry.type === 'sleep') {
        value = entry.durationHours ?? 0;
      }

      if (metric === 'weightKg' && entry.type === 'bodyMetrics') {
        value = entry.weightKg ?? 0;
      }

      return {
        label: new Date(entry.loggedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value
      };
    })
    .filter((point) => point.value !== 0);
}

export function buildScatterData(entries, metricX, metricY) {
  const xSeries = buildMetricSeries(entries, metricX);
  const ySeries = buildMetricSeries(entries, metricY);
  const length = Math.min(xSeries.length, ySeries.length);

  return Array.from({ length }, (_, index) => ({
    x: xSeries[index].value,
    y: ySeries[index].value,
    label: `${xSeries[index].label} / ${ySeries[index].label}`
  }));
}

export function metricValueForGoal(entries, goalMetric) {
  const entriesForMetric = entries.filter((entry) => {
    if (goalMetric === 'workoutMinutes' || goalMetric === 'workoutCalories') {
      return entry.type === 'workout';
    }

    if (goalMetric === 'nutritionCalories') {
      return entry.type === 'nutrition';
    }

    if (goalMetric === 'sleepHours') {
      return entry.type === 'sleep';
    }

    if (goalMetric === 'weightKg' || goalMetric === 'bodyFatPercent') {
      return entry.type === 'bodyMetrics';
    }

    return false;
  });

  if (!entriesForMetric.length) {
    return 0;
  }

  if (goalMetric === 'sleepHours') {
    return entriesForMetric.reduce((sum, entry) => sum + (entry.durationHours ?? 0), 0) / entriesForMetric.length;
  }

  const latest = entriesForMetric[entriesForMetric.length - 1];
  if (goalMetric === 'workoutMinutes') {
    return entriesForMetric.reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0);
  }

  if (goalMetric === 'workoutCalories') {
    return entriesForMetric.reduce((sum, entry) => sum + (entry.caloriesBurned ?? 0), 0);
  }

  if (goalMetric === 'nutritionCalories') {
    return entriesForMetric.reduce((sum, entry) => sum + (entry.calories ?? 0), 0);
  }

  if (goalMetric === 'bodyFatPercent') {
    return latest.bodyFatPercent ?? 0;
  }

  return latest.weightKg ?? 0;
}

export function calcProgress(goal, entries) {
  const target = goal.targetValue || 1;
  const current = metricValueForGoal(entries, goal.metric);
  const ratio = Math.min(1, current / target);
  return Number((ratio * 100).toFixed(1));
}
