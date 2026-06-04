import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';

describe('FitPulse API', () => {
  it('returns a clear message when login credentials are wrong', async () => {
    const app = createApp(createStore());

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@example.com', password: 'wrongpass' })
      .expect(401);

    expect(response.body.error).toBe('Email or password is incorrect.');
  });

  it('authenticates the seeded demo user and returns dashboard data', async () => {
    const app = createApp(createStore());

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@fitpulse.dev', password: 'admin123' })
      .expect(200);

    expect(login.body.token).toBeTypeOf('string');

    const dashboard = await request(app)
      .get('/api/dashboard?range=7d')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);

    expect(dashboard.body.summary.totals.workoutMinutes).toBeGreaterThan(0);
    expect(dashboard.body.entries.length).toBeGreaterThan(0);
  });

  it('creates an entry and exports CSV', async () => {
    const app = createApp(createStore());

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@fitpulse.dev', password: 'admin123' })
      .expect(200);

    const created = await request(app)
      .post('/api/entries')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        type: 'nutrition',
        title: 'Recovery meal',
        calories: 530,
        proteinGrams: 35,
        carbohydratesGrams: 48,
        fatGrams: 17,
        notes: 'Post-workout bowl'
      })
      .expect(201);

    expect(created.body.entry.type).toBe('nutrition');

    const csv = await request(app)
      .get('/api/history/export')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);

    expect(csv.text).toContain('entryId');
    expect(csv.text).toContain('Recovery meal');
  });

  it('creates and recalculates goals', async () => {
    const app = createApp(createStore());

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@fitpulse.dev', password: 'admin123' })
      .expect(200);

    const goal = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ metric: 'workoutMinutes', targetValue: 100, deadline: '2025-12-31T00:00:00.000Z' })
      .expect(201);

    expect(goal.body.goal.metric).toBe('workoutMinutes');

    const recalculated = await request(app)
      .post('/api/goals/recalculate')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);

    expect(recalculated.body.goals.length).toBeGreaterThan(0);
  });
});
