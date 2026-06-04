import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import {
  buildDashboardSummary,
  buildMetricSeries,
  buildScatterData,
  calcBMI,
  calcMET,
  calcMacroRatio,
  calcProgress,
  calcSleepEfficiency,
  exportEntriesToCsv,
  goalStatuses,
  interpretCorrelation,
  pearsonCorrelation
} from './domain.js';

const JWT_SECRET = 'fitpulse-development-secret';
const DEFAULT_USER = {
  email: 'admin@fitpulse.dev',
  password: 'admin123'
};

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortNewestFirst(items) {
  return items.slice().sort((left, right) => new Date(right.loggedAt ?? right.createdAt).getTime() - new Date(left.loggedAt ?? left.createdAt).getTime());
}

export class FitPulseStore {
  constructor() {
    this.users = [];
    this.entries = [];
    this.goals = [];
    this.notifications = [];
    this.tokens = new Set();

    this.seed();
  }

  seed() {
    const userId = uuid();
    const passwordHash = bcrypt.hashSync(DEFAULT_USER.password, 12);

    this.users.push({
      userId,
      fullName: 'Admin User',
      email: DEFAULT_USER.email,
      passwordHash,
      createdAt: now(),
      updatedAt: now()
    });

    const start = daysAgo(14);
    const workouts = [34, 42, 29, 55, 37, 48, 31, 44].map((minutes, index) => ({
      type: 'workout',
      title: `Workout ${index + 1}`,
      activityType: index % 2 === 0 ? 'running' : 'cycling',
      durationMinutes: minutes,
      caloriesBurned: 240 + index * 28,
      intensity: index % 3 === 0 ? 'high' : 'moderate',
      averageHeartRate: 142 + index,
      notes: 'Seeded workout data.'
    }));

    const sleepLogs = [6.9, 7.2, 7.5, 6.8, 7.8, 7.1, 7.4, 7.6].map((hours, index) => ({
      type: 'sleep',
      title: `Sleep ${index + 1}`,
      bedtime: daysAgo(13 - index),
      wakeTime: now(),
      durationHours: hours,
      qualityRating: index % 5 + 1,
      deepSleepHours: Number((hours * 0.24).toFixed(1)),
      notes: 'Seeded sleep data.'
    }));

    const nutritionLogs = [520, 610, 580, 640, 570, 600, 625, 590].map((calories, index) => ({
      type: 'nutrition',
      title: `Meal ${index + 1}`,
      calories,
      proteinGrams: 30 + index,
      carbohydratesGrams: 45 + index * 2,
      fatGrams: 15 + (index % 3),
      notes: 'Seeded nutrition data.'
    }));

    const bodyMetricsLogs = [71.6, 71.4, 71.2].map((weightKg, index) => ({
      type: 'bodyMetrics',
      title: `Check-in ${index + 1}`,
      weightKg,
      bodyFatPercent: 16.8 - index * 0.2,
      heightCm: 178,
      muscleMassKg: 56.3 + index * 0.1,
      notes: 'Seeded body metrics.'
    }));

    [...workouts, ...sleepLogs, ...nutritionLogs, ...bodyMetricsLogs].forEach((entry, index) => {
      this.entries.push(this.normalizeEntry({
        ...entry,
        userId,
        loggedAt: new Date(new Date(start).getTime() + index * 43200000).toISOString()
      }));
    });

    this.entries.push(this.normalizeEntry({
      userId,
      type: 'workout',
      title: 'Recent finish',
      activityType: 'running',
      durationMinutes: 46,
      caloriesBurned: 390,
      intensity: 'high',
      averageHeartRate: 156,
      notes: 'Added to ensure recent dashboard coverage.',
      loggedAt: daysAgo(1)
    }));

    this.goals.push({
      goalId: uuid(),
      userId,
      metric: 'workoutMinutes',
      targetValue: 180,
      deadline: daysAgo(-7),
      status: goalStatuses.ACTIVE,
      createdAt: now(),
      updatedAt: now()
    });
  }

  ensureUserExists(userId) {
    const user = this.users.find((candidate) => candidate.userId === userId);
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  registerUser({ fullName, email, password }) {
    if (this.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Email already registered');
    }

    const user = {
      userId: uuid(),
      fullName,
      email,
      passwordHash: bcrypt.hashSync(password, 12),
      createdAt: now(),
      updatedAt: now()
    };

    this.users.push(user);
    return this.sanitizeUser(user);
  }

  loginUser({ email, password }) {
    const user = this.users.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign({ userId: user.userId, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    this.tokens.add(token);
    return { token, user: this.sanitizeUser(user) };
  }

  verifyToken(token) {
    if (!token || !this.tokens.has(token)) {
      throw new Error('Invalid token');
    }

    const payload = jwt.verify(token, JWT_SECRET);
    return this.ensureUserExists(payload.userId);
  }

  sanitizeUser(user) {
    return {
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  normalizeEntry(entry) {
    const base = {
      entryId: entry.entryId ?? uuid(),
      userId: entry.userId,
      loggedAt: entry.loggedAt ?? now(),
      createdAt: entry.createdAt ?? now(),
      updatedAt: entry.updatedAt ?? now(),
      notes: entry.notes ?? ''
    };

    if (entry.type === 'workout') {
      return {
        ...base,
        type: 'workout',
        title: entry.title ?? 'Workout',
        activityType: entry.activityType,
        durationMinutes: Number(entry.durationMinutes),
        caloriesBurned: Number(entry.caloriesBurned),
        intensity: entry.intensity ?? 'moderate',
        averageHeartRate: entry.averageHeartRate ? Number(entry.averageHeartRate) : null,
        met: calcMET(entry)
      };
    }

    if (entry.type === 'nutrition') {
      return {
        ...base,
        type: 'nutrition',
        title: entry.title ?? 'Meal',
        calories: Number(entry.calories),
        proteinGrams: Number(entry.proteinGrams),
        carbohydratesGrams: Number(entry.carbohydratesGrams),
        fatGrams: Number(entry.fatGrams),
        macroRatio: calcMacroRatio(entry)
      };
    }

    if (entry.type === 'sleep') {
      const durationHours = Number(entry.durationHours ?? 0);
      return {
        ...base,
        type: 'sleep',
        title: entry.title ?? 'Sleep session',
        bedtime: entry.bedtime,
        wakeTime: entry.wakeTime,
        durationHours,
        qualityRating: Number(entry.qualityRating),
        deepSleepHours: Number(entry.deepSleepHours ?? 0),
        efficiency: calcSleepEfficiency(entry.bedtime, entry.wakeTime, durationHours)
      };
    }

    if (entry.type === 'bodyMetrics') {
      return {
        ...base,
        type: 'bodyMetrics',
        title: entry.title ?? 'Body metrics',
        weightKg: Number(entry.weightKg),
        bodyFatPercent: Number(entry.bodyFatPercent),
        heightCm: Number(entry.heightCm),
        muscleMassKg: Number(entry.muscleMassKg ?? 0),
        bmi: entry.bmi ? Number(entry.bmi) : calcBMI(Number(entry.weightKg), Number(entry.heightCm))
      };
    }

    throw new Error('Unsupported entry type');
  }

  addEntry(userId, entry) {
    this.ensureUserExists(userId);
    const normalized = this.normalizeEntry({ ...entry, userId });
    this.entries.push(normalized);
    return clone(normalized);
  }

  updateEntry(userId, entryId, updates) {
    const index = this.entries.findIndex((entry) => entry.entryId === entryId && entry.userId === userId);
    if (index === -1) {
      throw new Error('Entry not found');
    }

    const merged = this.normalizeEntry({
      ...this.entries[index],
      ...updates,
      entryId,
      userId,
      updatedAt: now()
    });

    this.entries[index] = merged;
    return clone(merged);
  }

  deleteEntry(userId, entryId) {
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => !(entry.entryId === entryId && entry.userId === userId));
    if (before === this.entries.length) {
      throw new Error('Entry not found');
    }
  }

  listEntries(userId, filters = {}) {
    return sortNewestFirst(
      this.entries.filter((entry) => {
        if (entry.userId !== userId) {
          return false;
        }

        if (filters.type && entry.type !== filters.type) {
          return false;
        }

        if (filters.from && new Date(entry.loggedAt) < new Date(filters.from)) {
          return false;
        }

        if (filters.to && new Date(entry.loggedAt) > new Date(filters.to)) {
          return false;
        }

        if (filters.query) {
          const haystack = JSON.stringify(entry).toLowerCase();
          if (!haystack.includes(String(filters.query).toLowerCase())) {
            return false;
          }
        }

        return true;
      })
    );
  }

  getDashboard(userId, range = '7d') {
    const days = range === '30d' ? 30 : range === 'custom' ? 365 : 7;
    const from = new Date();
    from.setDate(from.getDate() - days);
    const entries = this.listEntries(userId, { from: from.toISOString() });
    const summary = buildDashboardSummary(entries);

    return {
      range,
      summary,
      charts: {
        workoutMinutes: buildMetricSeries(entries, 'workoutMinutes'),
        nutritionCalories: buildMetricSeries(entries, 'nutritionCalories'),
        sleepHours: buildMetricSeries(entries, 'sleepHours')
      },
      entries
    };
  }

  createGoal(userId, goal) {
    this.ensureUserExists(userId);
    const normalized = {
      goalId: uuid(),
      userId,
      metric: goal.metric,
      targetValue: Number(goal.targetValue),
      deadline: goal.deadline,
      status: goalStatuses.ACTIVE,
      createdAt: now(),
      updatedAt: now()
    };

    this.goals.push(normalized);
    return clone(normalized);
  }

  updateGoal(userId, goalId, updates) {
    const index = this.goals.findIndex((goal) => goal.goalId === goalId && goal.userId === userId);
    if (index === -1) {
      throw new Error('Goal not found');
    }

    this.goals[index] = {
      ...this.goals[index],
      ...updates,
      targetValue: updates.targetValue ? Number(updates.targetValue) : this.goals[index].targetValue,
      updatedAt: now()
    };

    return clone(this.goals[index]);
  }

  deleteGoal(userId, goalId) {
    const before = this.goals.length;
    this.goals = this.goals.filter((goal) => !(goal.goalId === goalId && goal.userId === userId));
    if (before === this.goals.length) {
      throw new Error('Goal not found');
    }
  }

  listGoals(userId) {
    const entries = this.listEntries(userId);
    return this.goals
      .filter((goal) => goal.userId === userId)
      .map((goal) => {
        const progress = calcProgress(goal, entries);
        const status = progress >= 100 ? goalStatuses.ACHIEVED : new Date(goal.deadline) < new Date() ? goalStatuses.ARCHIVED : goalStatuses.ACTIVE;
        return {
          ...goal,
          progress,
          status
        };
      });
  }

  recalculateGoals(userId) {
    const entries = this.listEntries(userId);
    this.goals = this.goals.map((goal) => {
      if (goal.userId !== userId) {
        return goal;
      }

      const progress = calcProgress(goal, entries);
      let status = goalStatuses.ACTIVE;

      if (progress >= 100) {
        status = goalStatuses.ACHIEVED;
        this.notifications.push({
          notificationId: uuid(),
          userId,
          goalId: goal.goalId,
          message: `Goal achieved: ${goal.metric}`,
          isRead: false,
          createdAt: now()
        });
      } else if (new Date(goal.deadline) < new Date()) {
        status = goalStatuses.ARCHIVED;
      }

      return {
        ...goal,
        status,
        updatedAt: now()
      };
    });
  }

  getNotifications(userId) {
    return this.notifications.filter((notification) => notification.userId === userId);
  }

  buildInsights(userId, metricX, metricY) {
    const entries = this.listEntries(userId);
    const xSeries = buildMetricSeries(entries, metricX).map((point) => point.value);
    const ySeries = buildMetricSeries(entries, metricY).map((point) => point.value);

    if (xSeries.length < 7 || ySeries.length < 7) {
      return {
        ready: false,
        message: 'Need at least 7 data points for both metrics before correlation can be calculated.'
      };
    }

    const points = buildScatterData(entries, metricX, metricY);
    const correlation = pearsonCorrelation(xSeries, ySeries);

    return {
      ready: true,
      correlation,
      interpretation: interpretCorrelation(correlation),
      points
    };
  }

  exportCsv(userId, filters = {}) {
    return exportEntriesToCsv(this.listEntries(userId, filters));
  }
}

export function createStore() {
  return new FitPulseStore();
}
