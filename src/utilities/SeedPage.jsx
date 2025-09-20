// src/dev/SeedPage.jsx
import React, { useState } from "react";
import { seedFirestore } from "./seedFirestore";

export default function SeedPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handleSeed = async () => {
    setLoading(true);
    try {
      await seedFirestore({ posts: 12, questions: 20 });
      setStatus("Done seeding!");
    } catch (err) {
      console.error(err);
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Seed Firestore</h2>
      <button disabled={loading} onClick={handleSeed}>
        {loading ? "Seeding…" : "Seed Database"}
      </button>
      {status && <p>{status}</p>}
    </div>
  );
}
