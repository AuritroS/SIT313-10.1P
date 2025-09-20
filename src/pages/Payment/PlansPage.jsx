import React from "react";
import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import styles from "./PlansPage.module.css";

function Feature({ ok = true, children }) {
  return (
    <li className={styles.feature}>
      <span aria-hidden className={styles.featureIcon}>
        {ok ? "✔︎" : "—"}
      </span>
      <span>{children}</span>
    </li>
  );
}

function PlanCard({ title, price, features, footer, highlight }) {
  return (
    <div className={`${styles.planCard} ${highlight ? styles.highlight : ""}`}>
      <h3 className={styles.planTitle}>{title}</h3>
      <p className={styles.planPrice}>{price}</p>
      <ul className={styles.featureList}>{features}</ul>
      {footer}
    </div>
  );
}

export default function PlansPage() {
  const { user, premium, premiumSince, loading } = useAuth();

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Plans</h2>
      <p className={styles.subheading}>
        DEV@Deakin offers two plans. Upgrade anytime.
      </p>

      <div className={styles.plansGrid}>
        {/* Free Plan */}
        <PlanCard
          title="Free"
          price="$0"
          features={
            <>
              <Feature>Browse & search posts</Feature>
              <Feature>Create and view posts</Feature>
              <Feature ok={false}>Theme switcher</Feature>
              <Feature ok={false}>Premium badge</Feature>
              <Feature ok={false}>Early feature access</Feature>
            </>
          }
          footer={
            <Link to="/" className={styles.footerLink}>
              Continue Free
            </Link>
          }
        />

        {/* Premium Plan */}
        <PlanCard
          title="Premium"
          price="$9.99"
          highlight
          features={
            <>
              <Feature>Everything in Free</Feature>
              <Feature>Theme switcher</Feature>
              <Feature>Premium badge</Feature>
              <Feature>Early access to new features</Feature>
            </>
          }
          footer={
            loading ? null : premium ? (
              <div className={styles.premiumMsg}>
                🎉 You’re Already Premium{" "}
                {premiumSince && (
                  <>
                    since{" "}
                    <strong>
                      {new Date(
                        (premiumSince.seconds ??
                          premiumSince._seconds ??
                          0) * 1000
                      ).toLocaleDateString()}
                    </strong>
                  </>
                )}
              </div>
            ) : user ? (
              <Link to="/pay" className={styles.upgradeBtn}>Upgrade to Premium</Link>
            ) : (
                 <Link to="/login" className={`btn-primary ${styles.upgradeBtn}`}>
                Sign in to Upgrade
              </Link>
            )
          }
        />
      </div>

      <div className={styles.note}>
        Payments are handled securely on the pay page via Stripe.
      </div>
    </div>
  );
}
