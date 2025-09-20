import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../api/firebase";      // adjust if your path differs
import { Header, Label, Icon, Button } from "semantic-ui-react";
import styles from "./QuestionDetailPage.module.css";

const fmtDate = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleString() : new Date(ts).toLocaleString();

export default function QuestionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "questions", id));
        if (!snap.exists()) {
          setErr("Question not found.");
          return;
        }
        if (mounted) setQ({ id: snap.id, ...snap.data() });
      } catch (e) {
        setErr(e?.message || "Failed to load question.");
      }
    })();
    return () => (mounted = false);
  }, [id]);

  if (err) return <div className={styles.wrapper}><p className={styles.error}>{err}</p></div>;
  if (!q) return <div className={styles.wrapper}><p>Loading…</p></div>;

  const tags = Array.isArray(q.tags) ? q.tags : [];

  return (
    <div className={styles.wrapper}>
      <Button  labelPosition="left" className={styles.backBtn} onClick={() => navigate(-1)}>
        <Icon name="arrow left" /> Back
      </Button>

      <Header as="h1" className={styles.title}>{q.title}</Header>

      <div className={styles.metaRow}>
        <span className={styles.author}>{q.authorDisplay || q.authorName || "Anonymous"}</span>
        {q.createdAt && <>
          <span className={styles.dot}>•</span>
          <time className={styles.date}>{fmtDate(q.createdAt)}</time>
        </>}
      </div>

      {tags.length > 0 && (
        <div className={styles.tagsRow}>
          {tags.map(t => (
            <Label key={t} size="tiny" className={styles.tag}>
              <Icon name="tag" className={styles.tagIcon} /> {t}
            </Label>
          ))}
        </div>
      )}

      <div className={styles.body}>
        {q.description || "(no description)"}
      </div>
    </div>
  );
}
