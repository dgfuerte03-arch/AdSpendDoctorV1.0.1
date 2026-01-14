import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import Stripe from 'stripe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const mockServices = process.env.MOCK_SERVICES === 'true';

app.use(express.json());
app.use(express.static(path.join(repoRoot, 'public')));

async function loadConfig() {
  const configPath = path.join(repoRoot, 'TestV1');
  const raw = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(raw);
}

function resolveBaseUrl(req) {
  const configuredBaseUrl = process.env.PUBLIC_BASE_URL;
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  return `${protocol}://${req.headers.host}`;
}

function fillTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (values[key] === undefined || values[key] === null) {
      return '';
    }
    return String(values[key]);
  });
}

app.get('/api/config', async (_req, res) => {
  try {
    const config = await loadConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load config.' });
  }
});

app.post('/api/create-checkout-session', async (req, res) => {
  const config = await loadConfig();
  const { pricing } = config.flow.steps.find((step) => step.id === 'payment');
  const baseUrl = resolveBaseUrl(req);

  if (mockServices) {
    return res.json({ url: `${baseUrl}/?paid=1&step=inputs` });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY.' });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: pricing.currency.toLowerCase(),
            product_data: {
              name: config.app.name
            },
            unit_amount: pricing.amount * 100
          },
          quantity: 1
        }
      ],
      success_url: `${baseUrl}/?paid=1&step=inputs&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?step=exit`
    });

    return res.json({ url: session.url });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create Stripe session.' });
  }
});

app.post('/api/verdict', async (req, res) => {
  const config = await loadConfig();
  const { prompt, model } = config.flow.steps.find((step) => step.id === 'verdict_ai');
  const values = req.body;

  if (mockServices) {
    return res.json({
      verdict: [
        'SECTION 1: VERDICT',
        'Fix. The numbers point to a controllable issue, not a total failure.',
        '',
        'SECTION 2: PRIMARY FAILURE POINT',
        'Creative',
        '',
        'SECTION 3: WHY THIS IS THE FAILURE',
        'CTR is below 1% and spend is steady, so the ads are not breaking through. With limited results, stability is weak.',
        '',
        'SECTION 4: HARD TRUTH',
        'Your ads are being ignored because the creative is not compelling enough.',
        '',
        'SECTION 5: WHAT NOT TO TOUCH',
        'Do not change your campaign objective right now.',
        '',
        'SECTION 6: NEXT 72 HOURS',
        'Replace creatives: launch 3 new variations focused on a single clear offer.',
        'STOP LOSS: If cost per result doesn’t improve by at least 20% within 72 hours, then pause the ad set.',
        '',
        'SECTION 7: CONFIDENCE NOTE',
        'Moderate confidence based on the inputs provided.'
      ].join('\n')
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing OPENAI_API_KEY.' });
  }

  const selectedModel = process.env.OPENAI_MODEL || model.name;
  const systemMessage = prompt.system;
  const userMessage = fillTemplate(prompt.user, values);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'OpenAI request failed.' });
    }

    const data = await response.json();
    const verdict = data.choices?.[0]?.message?.content;

    if (!verdict) {
      return res.status(500).json({ error: 'No verdict returned.' });
    }

    return res.json({ verdict });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate verdict.' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(repoRoot, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`AdSpend Doctor running on http://localhost:${port}`);
});
