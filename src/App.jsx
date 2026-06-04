import { useEffect, useMemo, useState } from 'react';
import Section from './components/Section.jsx';
import MetricCard from './components/MetricCard.jsx';
import MiniChart from './components/MiniChart.jsx';
import { api } from './api.js';

const demoLogin = {
  email: '',
  password: ''
};

const entryDefaults = {
  type: 'workout',
  title: 'Evening workout',
  activityType: 'running',
  durationMinutes: 35,
  caloriesBurned: 320,
  intensity: 'moderate',
  averageHeartRate: 145,
  calories: 520,
  proteinGrams: 35,
  carbohydratesGrams: 50,
  fatGrams: 14,
  bedtime: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  wakeTime: new Date().toISOString(),
  durationHours: 7.2,
  qualityRating: 4,
  deepSleepHours: 1.6,
  weightKg: 71,
  bodyFatPercent: 16.2,
  heightCm: 178,
  muscleMassKg: 56,
  notes: 'Generated from dashboard form.'
};

const goalDefaults = {
  metric: 'workoutMinutes',
  targetValue: 180,
  deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) + 'T00:00:00.000Z'
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('fitpulse-token') || '');
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState('');
  const [message, setMessage] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [goals, setGoals] = useState([]);
  const [history, setHistory] = useState([]);
  const [insights, setInsights] = useState(null);
  const [range, setRange] = useState('7d');
  const [entryForm, setEntryForm] = useState(entryDefaults);
  const [goalForm, setGoalForm] = useState(goalDefaults);
  const [loginForm, setLoginForm] = useState(demoLogin);

  useEffect(() => {
    if (!token) {
      return;
    }

    void refreshAll(token);
  }, [token, range]);

  async function refreshAll(activeToken) {
    try {
      setError('');
      const [dashboardResult, goalsResult, historyResult, insightsResult] = await Promise.all([
        api.dashboard(activeToken, range),
        api.goals(activeToken),
        api.history(activeToken),
        api.insights(activeToken, 'sleepHours', 'workoutMinutes')
      ]);

      setDashboard(dashboardResult);
      setGoals(goalsResult.goals);
      setHistory(historyResult.entries);
      setInsights(insightsResult);
    } catch (exception) {
      setError(exception.message);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setAuthError('');
    try {
      const result = await api.login(loginForm);
      localStorage.setItem('fitpulse-token', result.token);
      setToken(result.token);
      setUser(result.user);
      setMessage(`Signed in as ${result.user.fullName}`);
    } catch (exception) {
      setAuthError('Incorrect email or password');
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    try {
      const result = await api.register({ ...loginForm, fullName: 'New FitPulse User' });
      setMessage(`Account created for ${result.user.email}. Use the login form to continue.`);
    } catch (exception) {
      setError(exception.message);
    }
  }

  async function submitEntry(event) {
    event.preventDefault();
    try {
      await api.addEntry(token, normalizeEntryPayload(entryForm));
      setMessage('Entry saved. Dashboard refreshed.');
      await refreshAll(token);
    } catch (exception) {
      setError(exception.message);
    }
  }

  async function submitGoal(event) {
    event.preventDefault();
    try {
      await api.addGoal(token, {
        metric: goalForm.metric,
        targetValue: Number(goalForm.targetValue),
        deadline: goalForm.deadline
      });
      setMessage('Goal saved. Progress recalculated.');
      await refreshAll(token);
    } catch (exception) {
      setError(exception.message);
    }
  }

  async function exportCsv() {
    try {
      const csv = await api.exportCsv(token);
      setMessage(`CSV export ready (${csv.length} characters).`);
    } catch (exception) {
      setError(exception.message);
    }
  }

  const summaryCards = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return [
      { label: 'Workout minutes', value: dashboard.summary.totals.workoutMinutes, sublabel: 'This week' },
      { label: 'Calories burned', value: dashboard.summary.totals.workoutCalories, sublabel: 'From workouts' },
      { label: 'Sleep hours', value: dashboard.summary.averages.sleepHours, sublabel: 'Average per sleep log' },
      { label: 'Calories eaten', value: dashboard.summary.totals.nutritionCalories, sublabel: 'From meals' }
    ];
  }, [dashboard]);

  if (!token) {
    return (
      <main className="auth-layout">
        <section className="hero panel">
          <p className="eyebrow">CCS-502 FitPulse</p>
          <h1>Track workouts, meals, sleep, goals, and progress in one place.</h1>
          <p className="hero__text">
            The app gives you a simple dashboard for logging health data, checking trends, setting goals, and exporting your history.
          </p>
          <div className="hero__chips">
            <span>Secure sign-in</span>
            <span>Goals</span>
            <span>Trends</span>
            <span>Export data</span>
          </div>
        </section>

        <Section eyebrow="Access" title="Sign in or create an account">
          <form className="stack" onSubmit={handleLogin}>
            <label>
              Email
              <input value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} />
            </label>
            <label>
              Password
              <input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} />
            </label>
            {authError ? <p className="auth-error">{authError}</p> : null}
            <div className="button-row">
              <button type="submit">Log in</button>
              <button type="button" className="button-secondary" onClick={handleRegister}>Register</button>
            </div>
          </form>
        </Section>

        {(error || message) ? <p className={error ? 'flash flash--error' : 'flash'}>{error || message}</p> : null}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar panel">
        <div>
          <p className="eyebrow">FitPulse</p>
          <h1>Dashboard</h1>
          <p className="muted">Signed in as {user?.fullName || 'Demo User'}</p>
        </div>
        <div className="topbar__actions">
          <label>
            Time range
            <select value={range} onChange={(event) => setRange(event.target.value)}>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              localStorage.removeItem('fitpulse-token');
              setToken('');
              setUser(null);
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {(error || message) ? <p className={error ? 'flash flash--error' : 'flash'}>{error || message}</p> : null}

      <section className="metrics-grid">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section className="dashboard-grid">
        <Section eyebrow="Trends" title="Weekly charts">
          <div className="chart-grid">
            <MiniChart title="Workout minutes" points={dashboard?.charts.workoutMinutes || []} />
            <MiniChart title="Calories eaten" points={dashboard?.charts.nutritionCalories || []} />
          </div>
        </Section>

        <Section eyebrow="Entries" title="Add an entry">
          <form className="stack" onSubmit={submitEntry}>
            <label>
              Category
              <select value={entryForm.type} onChange={(event) => setEntryForm({ ...entryForm, type: event.target.value })}>
                <option value="workout">Workout</option>
                <option value="nutrition">Meal</option>
                <option value="sleep">Sleep</option>
                <option value="bodyMetrics">Body metrics</option>
              </select>
            </label>
            <label>
              Title
              <input value={entryForm.title} onChange={(event) => setEntryForm({ ...entryForm, title: event.target.value })} />
            </label>
            {entryForm.type === 'workout' ? (
              <>
                <label>
                  Activity type
                  <input value={entryForm.activityType} onChange={(event) => setEntryForm({ ...entryForm, activityType: event.target.value })} />
                </label>
                <label>
                  Duration minutes
                  <input type="number" value={entryForm.durationMinutes} onChange={(event) => setEntryForm({ ...entryForm, durationMinutes: event.target.value })} />
                </label>
                <label>
                  Calories burned
                  <input type="number" value={entryForm.caloriesBurned} onChange={(event) => setEntryForm({ ...entryForm, caloriesBurned: event.target.value })} />
                </label>
                <label>
                  Intensity
                  <select value={entryForm.intensity} onChange={(event) => setEntryForm({ ...entryForm, intensity: event.target.value })}>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label>
                  Average heart rate
                  <input type="number" value={entryForm.averageHeartRate} onChange={(event) => setEntryForm({ ...entryForm, averageHeartRate: event.target.value })} />
                </label>
              </>
            ) : null}
            {entryForm.type === 'nutrition' ? (
              <>
                <label>
                  Calories eaten
                  <input type="number" value={entryForm.calories} onChange={(event) => setEntryForm({ ...entryForm, calories: event.target.value })} />
                </label>
                <label>
                  Protein grams
                  <input type="number" value={entryForm.proteinGrams} onChange={(event) => setEntryForm({ ...entryForm, proteinGrams: event.target.value })} />
                </label>
                <label>
                  Carbohydrates grams
                  <input type="number" value={entryForm.carbohydratesGrams} onChange={(event) => setEntryForm({ ...entryForm, carbohydratesGrams: event.target.value })} />
                </label>
                <label>
                  Fat grams
                  <input type="number" value={entryForm.fatGrams} onChange={(event) => setEntryForm({ ...entryForm, fatGrams: event.target.value })} />
                </label>
              </>
            ) : null}
            {entryForm.type === 'sleep' ? (
              <>
                <label>
                  Bedtime
                  <input value={entryForm.bedtime} onChange={(event) => setEntryForm({ ...entryForm, bedtime: event.target.value })} />
                </label>
                <label>
                  Wake time
                  <input value={entryForm.wakeTime} onChange={(event) => setEntryForm({ ...entryForm, wakeTime: event.target.value })} />
                </label>
                <label>
                  Duration hours
                  <input type="number" step="0.1" value={entryForm.durationHours} onChange={(event) => setEntryForm({ ...entryForm, durationHours: event.target.value })} />
                </label>
                <label>
                  Quality rating
                  <input type="number" min="1" max="5" value={entryForm.qualityRating} onChange={(event) => setEntryForm({ ...entryForm, qualityRating: event.target.value })} />
                </label>
                <label>
                  Deep sleep hours
                  <input type="number" step="0.1" value={entryForm.deepSleepHours} onChange={(event) => setEntryForm({ ...entryForm, deepSleepHours: event.target.value })} />
                </label>
              </>
            ) : null}
            {entryForm.type === 'bodyMetrics' ? (
              <>
                <label>
                  Weight kg
                  <input type="number" step="0.1" value={entryForm.weightKg} onChange={(event) => setEntryForm({ ...entryForm, weightKg: event.target.value })} />
                </label>
                <label>
                  Body fat %
                  <input type="number" step="0.1" value={entryForm.bodyFatPercent} onChange={(event) => setEntryForm({ ...entryForm, bodyFatPercent: event.target.value })} />
                </label>
                <label>
                  Height cm
                  <input type="number" step="0.1" value={entryForm.heightCm} onChange={(event) => setEntryForm({ ...entryForm, heightCm: event.target.value })} />
                </label>
                <label>
                  Muscle mass kg
                  <input type="number" step="0.1" value={entryForm.muscleMassKg} onChange={(event) => setEntryForm({ ...entryForm, muscleMassKg: event.target.value })} />
                </label>
              </>
            ) : null}
            <label>
              Notes
              <textarea value={entryForm.notes} onChange={(event) => setEntryForm({ ...entryForm, notes: event.target.value })} />
            </label>
            <button type="submit">Save entry</button>
          </form>
        </Section>

        <Section eyebrow="Goals" title="Set a goal">
          <form className="stack" onSubmit={submitGoal}>
            <label>
              Metric
              <select value={goalForm.metric} onChange={(event) => setGoalForm({ ...goalForm, metric: event.target.value })}>
                <option value="workoutMinutes">Workout minutes</option>
                <option value="workoutCalories">Calories burned</option>
                <option value="nutritionCalories">Calories eaten</option>
                <option value="sleepHours">Sleep hours</option>
                <option value="weightKg">Weight</option>
                <option value="bodyFatPercent">Body fat %</option>
              </select>
            </label>
            <label>
              Target value
              <input type="number" value={goalForm.targetValue} onChange={(event) => setGoalForm({ ...goalForm, targetValue: event.target.value })} />
            </label>
            <label>
              Deadline
              <input type="date" value={goalForm.deadline.slice(0, 10)} onChange={(event) => setGoalForm({ ...goalForm, deadline: `${event.target.value}T00:00:00.000Z` })} />
            </label>
            <button type="submit">Save goal</button>
          </form>
          <div className="goal-list">
            {goals.map((goal) => (
              <article key={goal.goalId} className="goal-card">
                <div>
                  <strong>{goal.metric}</strong>
                  <p>{goal.status}</p>
                </div>
                <span>{goal.progress}%</span>
              </article>
            ))}
          </div>
        </Section>

        <Section eyebrow="Insights" title="Trends and insights">
          {insights?.ready ? (
            <>
              <p className="insight-copy">Correlation score: {insights.correlation} · {insights.interpretation}</p>
              <div className="scatter-box">
                {insights.points.map((point, index) => (
                  <span key={`${point.label}-${index}`} style={{ left: `${Math.min(92, point.x / 2)}%`, top: `${Math.min(85, 100 - point.y / 2)}%` }} title={point.label} />
                ))}
              </div>
            </>
          ) : (
            <p className="empty">{insights?.message || 'Loading insights...'}</p>
          )}
        </Section>

        <Section eyebrow="History" title="Recent entries" action={<button type="button" className="button-secondary" onClick={exportCsv}>Export CSV</button>}>
          <div className="history-list">
            {history.map((entry) => (
              <article key={entry.entryId} className="history-item">
                <div>
                  <strong>{entry.title}</strong>
                  <p>{entry.type}</p>
                  {entry.type === 'workout' ? <p>Calories burned: {entry.caloriesBurned} kcal</p> : null}
                </div>
                <span>{new Date(entry.loggedAt).toLocaleDateString()}</span>
              </article>
            ))}
          </div>
        </Section>
      </section>
    </main>
  );
}

function normalizeEntryPayload(form) {
  if (form.type === 'workout') {
    return {
      type: 'workout',
      title: form.title,
      activityType: form.activityType,
      durationMinutes: Number(form.durationMinutes),
      caloriesBurned: Number(form.caloriesBurned),
      intensity: form.intensity,
      averageHeartRate: Number(form.averageHeartRate),
      notes: form.notes
    };
  }

  if (form.type === 'nutrition') {
    return {
      type: 'nutrition',
      title: form.title,
      calories: Number(form.calories),
      proteinGrams: Number(form.proteinGrams),
      carbohydratesGrams: Number(form.carbohydratesGrams),
      fatGrams: Number(form.fatGrams),
      notes: form.notes
    };
  }

  if (form.type === 'sleep') {
    return {
      type: 'sleep',
      title: form.title,
      bedtime: form.bedtime,
      wakeTime: form.wakeTime,
      durationHours: Number(form.durationHours),
      qualityRating: Number(form.qualityRating),
      deepSleepHours: Number(form.deepSleepHours),
      notes: form.notes
    };
  }

  return {
    type: 'bodyMetrics',
    title: form.title,
    weightKg: Number(form.weightKg),
    bodyFatPercent: Number(form.bodyFatPercent),
    heightCm: Number(form.heightCm),
    muscleMassKg: Number(form.muscleMassKg),
    notes: form.notes
  };
}
