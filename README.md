# FitPulse

FitPulse is a health and fitness dashboard built from the project requirements and UML specification. The repository includes a Node/Express API, a React dashboard, and unit and integration tests for the main logic.

## What is included

- Secure sign-in flow
- Manual entry types for workouts, nutrition, sleep, and body metrics
- Dashboard summaries, charts, and CSV export
- Goal tracking and trend insights
- Unit tests for domain logic plus API tests for the main flows

## Setup

1. Install Node.js 18 or newer.
2. Install dependencies:

```bash
npm install
```

## Run

Start the API and web app together:

```bash
npm run dev
```

The API runs on `http://localhost:3001` and the web app runs on `http://localhost:5173`.

## Test

Run the test suite:

```bash
npm test
```

## Notes

The implementation uses an in-memory store so it is easy to review and test. The code is structured so it can later be swapped to PostgreSQL without changing the front-end contract.
