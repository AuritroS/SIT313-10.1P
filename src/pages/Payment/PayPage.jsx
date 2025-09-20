// src/pages/Payment/PayPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import useAuth from "../../hooks/useAuth";
import styles from "./PayPage.module.css";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
const CREATE_PI_URL =
  "https://australia-southeast1-deakin-app-7d1a8.cloudfunctions.net/createPaymentIntent";

/* ----------------------------- UI helpers ----------------------------- */

function Card({ children }) {
  return <div className={styles.card}>{children}</div>;
}

function Row({ label, children }) {
  return (
    <div className={styles.row}>
      <strong className={styles.rowLabel}>{label}</strong>
      <span className={styles.rowValue}>{children}</span>
    </div>
  );
}

function Feature({ children, ok = true }) {
  return (
    <li className={styles.feature}>
      <span className={styles.featureIcon} aria-hidden>
        {ok ? "✔︎" : "—"}
      </span>
      <span>{children}</span>
    </li>
  );
}

/* ---------------------------- Checkout form --------------------------- */

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setError("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setError(error.message || "Payment failed");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      window.location.href = "/";
      return;
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.checkoutForm}>
      <Card>
        <PaymentElement />
      </Card>

      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className={`btn-primary ${styles.payButton}`}
      >
        {submitting ? "Processing…" : "Pay"}
      </button>

      {error && <p className={styles.errorMsg}>{error}</p>}
    </form>
  );
}

/* --------------------------------- Page -------------------------------- */

export default function PayPage() {
  const { user, premium, premiumSince, loading } = useAuth();

  const [clientSecret, setClientSecret] = useState("");
  const [statusMsg, setStatusMsg] = useState("Preparing secure payment…");
  const [error, setError] = useState("");

  const plan = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("plan") || "premium";
  }, []);

  // Only create a PaymentIntent if a user is logged in and not premium
  useEffect(() => {
    if (!user) return;           // not signed in → skip (we'll show sign-in CTA)
    if (loading) return;
    if (premium) return;         // already premium → no PI

    let cancelled = false;
    (async () => {
      try {
        setError("");
        setStatusMsg("Preparing secure payment…");
        const res = await fetch(CREATE_PI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, uid: user.uid || "anon" }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const { clientSecret } = await res.json();
        if (!cancelled) {
          setClientSecret(clientSecret);
          setStatusMsg("");
        }
      } catch (e) {
        if (!cancelled) {
          setStatusMsg("");
          setError(e.message || "Failed to prepare payment");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, plan, premium, loading]);

  if (loading) {
    return <div className={styles.container}>Loading…</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Upgrade to Premium</h2>

      {/* Info card always visible */}
      <Card>
        <div style={{ marginBottom: 10 }}>
          <strong
            style={{
              color: "#111",
              fontWeight: 600,
              fontSize: 17,
              display: "block",
              marginBottom: 8,
            }}
          >
            What you get:
          </strong>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: "0 0 0 20px",
              fontSize: 16,
              color: "#333",
            }}
          >
            <Feature>Theme switcher</Feature>
            <Feature>Premium badge</Feature>
            <Feature>Early access to new features</Feature>
          </ul>
        </div>

        <Row label="Price:">
          <span style={{ fontWeight: 600 }}>$9.99</span>
        </Row>
      </Card>

      {/* Already premium */}
      {premium && (
        <div className={styles.premiumMsg}>
          🎉 You’re a <strong>Premium Member</strong>
          {premiumSince ? (
            <>
              {" "}
              since{" "}
              <strong>
                {new Date(
                  (premiumSince.seconds ?? premiumSince._seconds ?? 0) * 1000
                ).toLocaleDateString()}
              </strong>
            </>
          ) : null}
          . Enjoy your benefits!
        </div>
      )}

      {/* Not signed in → show CTA to sign in */}
      {!user && !premium && (
        <div className={styles.ctaWrap}>
          <button
            type="button"
            onClick={() => (window.location.href = "/login")}
            className={`btn-primary ${styles.payButton}`}
          >
            Sign in to Upgrade
          </button>
        </div>
      )}

      {/* Signed in + not premium → show Stripe checkout */}
      {user && !premium && (
        <>
          {statusMsg && <div className={styles.statusMsg}>{statusMsg}</div>}
          {error && !clientSecret && (
            <div className={styles.errorMsg}>{error}</div>
          )}
          {clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: { theme: "stripe" } }}
            >
              <CheckoutForm />
            </Elements>
          )}
        </>
      )}
    </div>
  );
}
