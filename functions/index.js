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
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
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
      if (req.method !== "POST")
        return res.status(405).send("Method Not Allowed");

      const stripe = new Stripe(STRIPE_SECRET.value(), {
        apiVersion: "2024-06-20",
      });
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
    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: "2024-06-20",
    });

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        STRIPE_WEBHOOK_SECRET.value()
      );
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
// SendGrid Newsletter
exports.sendgrid = onRequest(
  { secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL] },
  allowCors(async (req, res) => {
    try {
      if (req.method !== "POST")
        return res.status(405).json({ ok: false, error: "Method Not Allowed" });
      if (!req.is("application/json"))
        return res
          .status(415)
          .json({ ok: false, error: "Use application/json" });

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
        err?.response?.body?.errors?.[0]?.message ||
        err.message ||
        "SendGrid error";
      console.error("SendGrid error:", err?.response?.body || err);
      return res.status(500).json({ ok: false, error: detail });
    }
  })
);

// --------------------------------------------------
// Ai Assistant (updated for conversational + action JSON output)
exports.aiAssist = onRequest(
  { secrets: [OPENAI_API_KEY], cors: false }, // CORS handled by your existing allowCors
  allowCors(async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      // ---- Auth (Firebase ID token from Authorization: Bearer <token>) ----
      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
      if (!idToken) return res.status(401).json({ error: "Missing ID token" });

      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch {
        return res.status(401).json({ error: "Invalid ID token" });
      }
      const uid = decoded.uid;

      // ---- Input validation ----
      const {
        feature = "chat", // "chat" | "editor" | "summarise" | "tags" | etc.
        prompt = "",
        context = "",
        power = false, // premium users can opt into bigger model
      } = req.body || {};

      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      if (prompt.length > 12000 || String(context).length > 24000) {
        return res.status(413).json({ error: "Input too large" });
      }

      // ---- Determine user tier (for quota/model) ----
      const userSnap = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .get();
      const u = userSnap.exists ? userSnap.data() : {};
      const isPremium = !!u.premium;
      const limit = isPremium ? 100 : 5; // premium vs free

      // ---- Simple per-day quota in ai_usage/{uid}/daily/{YYYY-MM-DD} ----
      const day = new Date().toISOString().slice(0, 10);
      const usageRef = admin
        .firestore()
        .collection("ai_usage")
        .doc(uid)
        .collection("daily")
        .doc(day);

      const { allowed, current } = await admin
        .firestore()
        .runTransaction(async (tx) => {
          const d = await tx.get(usageRef);
          const used = d.exists ? d.data().requests || 0 : 0;
          if (used >= limit) return { allowed: false, current: used };
          tx.set(
            usageRef,
            {
              requests: used + 1,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          return { allowed: true, current: used + 1 };
        });

      if (!allowed) {
        return res.status(429).json({
          error: "Daily AI quota reached",
          quota: { used: current, limit },
        });
      }

      // ---- System prompt tuned for conversational + actions JSON ----
      // The client can still steer tone/mode via its own prompt; this is a stable base.
      const ACTION_GUIDE = [
        "After your natural-language reply, include at most one fenced JSON block *only if relevant* with shape:",
        "```json",
        '{"actions":[{"type":"REPLACE_BODY","body_md":"..."},{"type":"APPEND_BODY","body_md":"..."},{"type":"APPLY_TITLE","title":"..."},{"type":"APPLY_ABSTRACT","abstract":"..."},{"type":"APPLY_TAGS","tags":["..."]},{"type":"CONFIRM","question":"..."}],"confidence":0.0}',
        "```",
        "Only include the JSON block if at least one action is appropriate. Confidence must be in [0,1].",
        "Prefer REPLACE_BODY when the user clearly wants to swap the full current body.",
        "Prefer APPEND_BODY when proposing incremental edits/snippets.",
        "Preserve author voice. Use Markdown for any body content.",
      ].join("\n");

      const SYSTEM_BASE = [
        "You are the DEV@Deakin in-app co-writer inside a rich-text editor.",
        "Be supportive, concise, and safe. Do not request secrets or credentials.",
        "First, respond conversationally (acknowledge, give 1–3 practical suggestions).",
        ACTION_GUIDE,
      ].join("\n\n");

      // Feature-specific hint for better routing (keeps backward compatibility)
      const featureHint =
        feature === "summarise"
          ? "Task: Summarise the following content clearly and briefly."
          : feature === "tags"
            ? "Task: Generate 3–6 relevant, lowercase tags separated by commas."
            : feature === "editor"
              ? "Task: Provide concrete editing suggestions or drafts as needed."
              : "Task: Chat naturally and assist with writing, editing, or planning.";

      const userContent = [
        featureHint,
        context ? `Context:\n${context}` : null,
        `User input:\n${prompt}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const messages = [
        { role: "system", content: SYSTEM_BASE + `\n\nFeature: ${feature}` },
        { role: "user", content: userContent },
      ];

      // ---- Model selection ----
      const model = isPremium && power ? "gpt-4o" : "gpt-4o-mini";
      const payload = {
        model,
        messages,
        temperature: 0.5, // slightly higher for friendlier phrasing
        max_tokens: 1200, // enough room for answer + optional JSON block
      };

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const detail = await r.text();
        return res.status(502).json({ error: "Upstream error", detail });
      }

      const data = await r.json();
      const text = data?.choices?.[0]?.message?.content || "";

      // ---- Minimal log for transparency ----
      await admin
        .firestore()
        .collection("ai_usage")
        .doc(uid)
        .collection("logs")
        .add({
          feature,
          model,
          promptChars: prompt.length,
          contextChars: String(context || "").length,
          usage: data?.usage || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      return res.status(200).json({
        ok: true,
        text,
        usage: data?.usage || null,
        quota: { used: current, limit },
        model,
        premium: isPremium,
      });
    } catch (err) {
      console.error("aiAssist error", err);
      return res.status(500).json({ error: "Internal error" });
    }
  })
);
