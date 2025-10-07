import { getAuth } from "firebase/auth";
const DEFAULT_URL = `https://australia-southeast1-deakin-app-7d1a8.cloudfunctions.net/aiAssist`;

// src/api/ai.js (keep your URL logic)
export async function aiAssist({ feature = "compose", prompt, context }) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const idToken = await user.getIdToken();

  const r = await fetch(DEFAULT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ feature, prompt, context }),
  });

  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }

  if (!r.ok) {
    if (r.status === 429 && data?.quota) {
      const { used, limit } = data.quota;
      throw new Error(`Daily AI limit reached (${used}/${limit}).`);
    }
    if (r.status === 429 && data?.cooldownMs) {
      throw new Error(
        `Please wait ${(data.cooldownMs / 1000).toFixed(1)}s and try again.`
      );
    }
    throw new Error(data?.error || "AI request failed");
  }
  return data;
}
