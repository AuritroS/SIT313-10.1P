import React, { useState } from "react";
import styles from "./EmailSignUp.module.css";

export default function SignupInsiderBar({
  onSubmit,
  labelText = "SIGN UP FOR OUR DAILY INSIDER",
  placeholder = "Enter your email",
  buttonText = "Subscribe",
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState("idle"); 

  const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);
  const isValid = isValidEmail(email);

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!isValid || submitting) return;

    try {
      setSubmitting(true);
      if (onSubmit) await onSubmit(email);
      setEmail("");
      setStatus("success");
    } catch (err) {
      setStatus("error");
    } finally {
      setSubmitting(false);
      setTimeout(() => setStatus("idle"), 3000); 
    }
  }

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <span className={styles.label}>{labelText}</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          aria-invalid={touched && !isValid}
          className={styles.input}
        />
        <button
          type="submit"
          disabled={!isValid || submitting}
          className={`${styles.button} ${
            status === "success" ? styles.success : ""
          } ${status === "error" ? styles.error : ""}`}
        >
          {submitting
            ? "Submitting…"
            : status === "success"
            ? "✓ Subscribed"
            : status === "error"
            ? "x Failed"
            : buttonText}
        </button>
      </form>
    </div>
  );
}
