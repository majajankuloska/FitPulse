import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { createStore } from './store.js';

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const registerSchema = authSchema.extend({
  fullName: z.string().min(2)
});

const workoutSchema = z.object({
  type: z.literal('workout'),
  title: z.string().min(2),
  activityType: z.string().min(2),
  durationMinutes: z.number().positive(),
  caloriesBurned: z.number().nonnegative(),
  intensity: z.enum(['low', 'moderate', 'high']).default('moderate'),
  averageHeartRate: z.number().nonnegative().optional(),
  notes: z.string().optional()
});

const nutritionSchema = z.object({
  type: z.literal('nutrition'),
  title: z.string().min(2),
  calories: z.number().nonnegative(),
  proteinGrams: z.number().nonnegative(),
  carbohydratesGrams: z.number().nonnegative(),
  fatGrams: z.number().nonnegative(),
  notes: z.string().optional()
});

const sleepSchema = z.object({
  type: z.literal('sleep'),
  title: z.string().min(2),
  bedtime: z.string().datetime(),
  wakeTime: z.string().datetime(),
  durationHours: z.number().positive(),
  qualityRating: z.number().int().min(1).max(5),
  deepSleepHours: z.number().nonnegative().optional(),
  notes: z.string().optional()
});

const bodyMetricsSchema = z.object({
  type: z.literal('bodyMetrics'),
  title: z.string().min(2),
  weightKg: z.number().positive(),
  bodyFatPercent: z.number().nonnegative(),
  heightCm: z.number().positive(),
  muscleMassKg: z.number().nonnegative().optional(),
  bmi: z.number().positive().optional(),
  notes: z.string().optional()
});

const goalSchema = z.object({
  metric: z.enum(['workoutMinutes', 'workoutCalories', 'nutritionCalories', 'sleepHours', 'weightKg', 'bodyFatPercent']),
  targetValue: z.number().positive(),
  deadline: z.string().datetime()
});

const updateGoalSchema = goalSchema.partial();

const entrySchema = z.discriminatedUnion('type', [workoutSchema, nutritionSchema, sleepSchema, bodyMetricsSchema]);

const updateEntrySchema = z.object({
  type: z.enum(['workout', 'nutrition', 'sleep', 'bodyMetrics']).optional(),
  title: z.string().min(2).optional(),
  activityType: z.string().min(2).optional(),
  durationMinutes: z.number().positive().optional(),
  caloriesBurned: z.number().nonnegative().optional(),
  intensity: z.enum(['low', 'moderate', 'high']).optional(),
  averageHeartRate: z.number().nonnegative().optional(),
  calories: z.number().nonnegative().optional(),
  proteinGrams: z.number().nonnegative().optional(),
  carbohydratesGrams: z.number().nonnegative().optional(),
  fatGrams: z.number().nonnegative().optional(),
  bedtime: z.string().datetime().optional(),
  wakeTime: z.string().datetime().optional(),
  durationHours: z.number().positive().optional(),
  qualityRating: z.number().int().min(1).max(5).optional(),
  deepSleepHours: z.number().nonnegative().optional(),
  weightKg: z.number().positive().optional(),
  bodyFatPercent: z.number().nonnegative().optional(),
  heightCm: z.number().positive().optional(),
  muscleMassKg: z.number().nonnegative().optional(),
  bmi: z.number().positive().optional(),
  notes: z.string().optional()
});

export function createApp(store = createStore()) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  function getToken(req) {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');
    return token;
  }

  function authenticate(req, res, next) {
    try {
      const user = store.verifyToken(getToken(req));
      req.user = user;
      next();
    } catch (_error) {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'fitpulse-api' });
  });

  app.post('/api/auth/register', (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    try {
      const user = store.registerUser(parsed.data);
      return res.status(201).json({ user });
    } catch (error) {
      return res.status(409).json({ error: error.message });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const parsed = authSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    try {
      const result = store.loginUser(parsed.data);
      return res.json(result);
    } catch (error) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
  });

  app.post('/api/auth/logout', authenticate, (req, res) => {
    const token = getToken(req);
    store.tokens.delete(token);
    res.json({ ok: true });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const parsed = authSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const userExists = store.users.some((user) => user.email.toLowerCase() === parsed.data.email.toLowerCase());
    if (!userExists) {
      return res.status(404).json({ error: 'Account not found' });
    }

    return res.json({ ok: true, message: 'Password reset instructions would be emailed in a production deployment.' });
  });

  app.get('/api/dashboard', authenticate, (req, res) => {
    res.json(store.getDashboard(req.user.userId, req.query.range));
  });

  app.get('/api/history', authenticate, (req, res) => {
    res.json({ entries: store.listEntries(req.user.userId, req.query) });
  });

  app.get('/api/history/export', authenticate, (req, res) => {
    const csv = store.exportCsv(req.user.userId, req.query);
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  });

  app.post('/api/entries', authenticate, (req, res) => {
    const parsed = entrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const entry = store.addEntry(req.user.userId, parsed.data);
    return res.status(201).json({ entry });
  });

  app.put('/api/entries/:entryId', authenticate, (req, res) => {
    const parsed = updateEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    try {
      const entry = store.updateEntry(req.user.userId, req.params.entryId, parsed.data);
      return res.json({ entry });
    } catch (error) {
      return res.status(404).json({ error: error.message });
    }
  });

  app.delete('/api/entries/:entryId', authenticate, (req, res) => {
    try {
      store.deleteEntry(req.user.userId, req.params.entryId);
      return res.status(204).send();
    } catch (error) {
      return res.status(404).json({ error: error.message });
    }
  });

  app.get('/api/goals', authenticate, (req, res) => {
    res.json({ goals: store.listGoals(req.user.userId) });
  });

  app.post('/api/goals', authenticate, (req, res) => {
    const parsed = goalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const goal = store.createGoal(req.user.userId, parsed.data);
    return res.status(201).json({ goal });
  });

  app.put('/api/goals/:goalId', authenticate, (req, res) => {
    const parsed = updateGoalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    try {
      const goal = store.updateGoal(req.user.userId, req.params.goalId, parsed.data);
      return res.json({ goal });
    } catch (error) {
      return res.status(404).json({ error: error.message });
    }
  });

  app.delete('/api/goals/:goalId', authenticate, (req, res) => {
    try {
      store.deleteGoal(req.user.userId, req.params.goalId);
      return res.status(204).send();
    } catch (error) {
      return res.status(404).json({ error: error.message });
    }
  });

  app.post('/api/goals/recalculate', authenticate, (req, res) => {
    store.recalculateGoals(req.user.userId);
    res.json({ goals: store.listGoals(req.user.userId), notifications: store.getNotifications(req.user.userId) });
  });

  app.get('/api/insights', authenticate, (req, res) => {
    const metricX = req.query.metricX || 'sleepHours';
    const metricY = req.query.metricY || 'workoutMinutes';
    res.json(store.buildInsights(req.user.userId, metricX, metricY));
  });

  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
