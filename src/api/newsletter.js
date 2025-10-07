const API_BASE =
  "https://australia-southeast1-deakin-app-7d1a8.cloudfunctions.net/sendgrid";

export async function subscribeToNewsletter(email, firstName = "") {
  const resp = await fetch(`${API_BASE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email, firstName }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.ok === false) {
    throw new Error(data?.error || `Subscribe failed (${resp.status})`);
  }
  return data;
}
