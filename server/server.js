require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const validator = require('validator');
const sgMail = require('@sendgrid/mail');

const {
  PORT = 8080,
  CORS_ORIGIN = '*',
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL
} = process.env;

if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
  console.error('Missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL');
  process.exit(1);
}

sgMail.setApiKey(SENDGRID_API_KEY);

const app = express();
app.use(helmet());
app.use(express.json({ type: 'application/json', limit: '100kb' }));

app.use(
  cors({
    origin: CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN.split(',').map(s => s.trim()),
    credentials: true
  })
);


app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (!req.is('application/json')) {
      return res
        .status(415)
        .json({ ok: false, error: 'Unsupported Media Type. Use application/json.' });
    }
  }
  const accept = req.headers.accept || 'application/json';
  if (!accept.includes('application/json') && accept !== '*/*') {
    return res.status(406).json({ ok: false, error: 'Not Acceptable. Expect application/json.' });
  }
  next();
});

app.post('/api/sendgrid', async (req, res) => {
  try {
    const { email, firstName = '' } = req.body || {};
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email address' });
    }
    await sgMail.send({
      to: email,
      from: SENDGRID_FROM_EMAIL,
      subject: 'Welcome to our newsletter',
      text: `Hi ${firstName || 'there'}, thanks for subscribing!`,
      html: `<h2>Welcome!</h2><p>Hi ${firstName || 'there'}, thanks for subscribing.</p>`
    });

    return res.status(200).json({ ok: true, data: { subscribed: true, email } });
  } catch (err) {
    const detail =
      err?.response?.body?.errors?.[0]?.message ||
      err?.message ||
      'Unknown error';
    console.error('Send error:', err?.response?.body || err);
    return res.status(500).json({ ok: false, error: detail });
  }
});

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));
app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`JSON API listening on http://localhost:${PORT}`);
});
