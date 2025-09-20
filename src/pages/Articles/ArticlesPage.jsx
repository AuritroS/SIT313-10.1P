import React, { useEffect, useState } from "react";
import { Card, Button, Header, Message, Loader } from "semantic-ui-react";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
} from "firebase/firestore";
// 🔺 Make sure this path matches YOUR project structure.
// If your firebase file is at src/firebase.js use: "../firebase" or "../../firebase"
import { db } from "../../api/firebase";

import ArticleCard from "./ArticleCard";
import styles from "./ArticlesPage.module.css";

const PAGE = 9;

export default function ArticlesPage() {
  const [items, setItems] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);

  const [loading, setLoading] = useState(true);        // first page spinner
  const [loadingMore, setLoadingMore] = useState(false); // load-more spinner
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  // ---------- First load ----------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const ref = collection(db, "posts");
        const q = query(ref, orderBy("createdAt", "desc"), limit(PAGE));
        const snap = await getDocs(q);

        if (cancelled) return;

        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(docs);

        const last = snap.docs[snap.docs.length - 1] || null;
        setLastDoc(last);
        setDone(snap.docs.length < PAGE);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load articles.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Load more ----------
  const loadMore = async () => {
    if (loadingMore || done || !lastDoc) return;

    setLoadingMore(true);
    setErr("");
    try {
      const ref = collection(db, "posts");
      const q = query(ref, orderBy("createdAt", "desc"), startAfter(lastDoc), limit(PAGE));
      const snap = await getDocs(q);

      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems((prev) => [...prev, ...docs]);

      const last = snap.docs[snap.docs.length - 1] || null;
      setLastDoc(last);
      setDone(snap.docs.length < PAGE);
    } catch (e) {
      setErr(e?.message || "Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className={styles.page}>
      <Header as="h2" className={styles.header}>
        All Articles
      </Header>

      {err && <Message negative>{err}</Message>}

      {loading ? (
        <div className={styles.loadingBox}>
          <Loader active inline="centered" />
        </div>
      ) : (
        <>
          <div className={styles.cards}>
            <Card.Group itemsPerRow={3} stackable className={styles.cards}>
              {items.map((p) => (
                <ArticleCard
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  description={
                    p.abstract ||
                    (p.body ? String(p.body).slice(0, 160) + "…" : "")
                  }
                  imageUrl={p.imageUrl}
                />
              ))}
            </Card.Group>
          </div>

          {!done && items.length > 0 && (
            <div className={styles.loadMore}>
              <Button
                className={styles.accentButton}
                loading={loadingMore}
                disabled={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}

          {done && items.length === 0 && (
            <div className={styles.empty}>
              <p>No articles yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
