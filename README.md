# AdSpend Doctor Web App

This project turns the `TestV1` flow configuration into a runnable web app with Stripe checkout and OpenAI-powered verdicts.

## Requirements

- Node.js 18+
- Stripe account + secret key
- OpenAI API key

## Setup

```bash
npm install
```

Create a `.env` file based on `.env.example` and fill in your keys.

## Run locally

```bash
npm run dev
```

Then visit `http://localhost:3000`.

## Mock mode

To run without Stripe/OpenAI (for local dev or tests), set:

```bash
MOCK_SERVICES=true
```

## End-to-end tests

```bash
npm run test:e2e
```

The Playwright tests automatically run the app in mock mode.
