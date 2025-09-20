// src/api/payments.js
const region = process.env.REACT_APP_FIREBASE_FUNCTIONS_REGION || "australia-southeast1";
const projectId = "deakin-app-7d1a8";

const base =
  process.env.NODE_ENV === "development"
    ? `http://127.0.0.1:5001/${projectId}/${region}`
    : `https://${region}-${projectId}.cloudfunctions.net`;

export async function createPaymentIntent({ plan = "premium", uid = "anon" } = {}) {
  const res = await fetch(`${base}/createPaymentIntent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, uid }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { clientSecret }
}
