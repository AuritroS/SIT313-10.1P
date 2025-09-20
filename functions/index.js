const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const sgMail = require("@sendgrid/mail");
const validator = require("validator");

// --------------------------------------------------
// Global defaults
setGlobalOptions({ region: "australia-southeast1" });

// --------------------------------------------------
// Secrets (unified convention)
const STRIPE_SECRET = defineSecret("STRIPE_SECRET");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const SENDGRID_FROM_EMAIL = defineSecret("SENDGRID_FROM_EMAIL");

// --------------------------------------------------
// Init Admin once
try {
  admin.app();
} catch {
  admin.initializeApp();
}

// --------------------------------------------------
// CORS helper (used only for browser-called endpoints)
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://example-prod-domain.com", // change when deploying
];

const allowCors = (handler) => async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Credentials", "true");

  // Preflight
  if (req.method === "OPTIONS") return res.status(204).send("");
  return handler(req, res);
};

// --------------------------------------------------
// Create PaymentIntent  (browser → function)
exports.createPaymentIntent = onRequest(
  { secrets: [STRIPE_SECRET] },
  allowCors(async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      const stripe = new Stripe(STRIPE_SECRET.value(), { apiVersion: "2024-06-20" });
      const { plan = "premium", uid = "anon" } = req.body || {};

      const priceMap = {
        premium: { amount: 999, currency: "aud", description: "Premium plan" },
      };
      const price = priceMap[plan];
      if (!price) return res.status(400).json({ error: "Unknown plan" });

      const pi = await stripe.paymentIntents.create({
        amount: price.amount,
        currency: price.currency,
        automatic_payment_methods: { enabled: true },
        metadata: { plan, uid },
      });

      return res.json({ clientSecret: pi.client_secret });
    } catch (err) {
      console.error("Stripe error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  })
);

// --------------------------------------------------
// Stripe Webhook (Stripe → function; no CORS)
exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const stripe = new Stripe(STRIPE_SECRET.value(), { apiVersion: "2024-06-20" });

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET.value());
    } catch (err) {
      console.error("Bad webhook signature:", err.message);
      return res.status(400).send("Bad signature");
    }

    try {
      if (event.type === "payment_intent.succeeded") {
        const pi = event.data.object;
        const uid = pi.metadata?.uid;
        if (uid) {
          await admin.firestore().collection("users").doc(uid).set(
            {
              premium: true,
              premiumSince: admin.firestore.FieldValue.serverTimestamp(),
              lastPaymentIntentId: pi.id,
            },
            { merge: true }
          );
        }
      }
      return res.json({ received: true });
    } catch (err) {
      console.error("Webhook handler error:", err);
      return res.status(500).send("Handler error");
    }
  }
);

// --------------------------------------------------
// SendGrid Newsletter  (browser → function)
exports.sendgrid = onRequest(
  { secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL] },
  allowCors(async (req, res) => {
    try {
      if (req.method !== "POST")
        return res.status(405).json({ ok: false, error: "Method Not Allowed" });
      if (!req.is("application/json"))
        return res.status(415).json({ ok: false, error: "Use application/json" });

      const { email, firstName = "" } = req.body || {};
      if (!email || !validator.isEmail(email)) {
        return res.status(400).json({ ok: false, error: "Invalid email" });
      }

      // Set API key per-invocation using Secrets
      sgMail.setApiKey(SENDGRID_API_KEY.value());

      await sgMail.send({
        to: email,
        from: SENDGRID_FROM_EMAIL.value(),
        subject: "Welcome to our newsletter",
        text: `Hi ${firstName || "there"}, thanks for subscribing!`,
        html: `<h2>Welcome!</h2><p>Hi ${firstName || "there"}, thanks for subscribing.</p>`,
      });

      return res.json({ ok: true, data: { subscribed: true, email } });
    } catch (err) {
      const detail =
        err?.response?.body?.errors?.[0]?.message || err.message || "SendGrid error";
      console.error("SendGrid error:", err?.response?.body || err);
      return res.status(500).json({ ok: false, error: detail });
    }
  })
);
