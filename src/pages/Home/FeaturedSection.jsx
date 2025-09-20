import React, { useEffect, useState } from "react";
import { Header, Card, Button } from "semantic-ui-react";
import { useNavigate } from "react-router-dom";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../../api/firebase"; // adjust if your path differs
import ArticleCard from "../Articles/ArticleCard";
import QuestionCard from "../Questions/QuestionCard";
import styles from "./FeaturedSection.module.css"; // ✅ CSS module import

// Small hook to fetch recent items from Firestore
const useRecent = (col, n = 3) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const q = query(collection(db, col), orderBy("createdAt", "desc"), limit(n));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(docs);
    });
    return () => unsub();
  }, [col, n]);
  return items;
};

export default function FeaturedSection() {
  const navigate = useNavigate();
  const recentPosts = useRecent("posts", 6);
  const recentQuestions = useRecent("questions", 3);

  return (
    <div className={styles.section}>
      {/* ---------- Recent Articles ---------- */}
      <Header as="h2" className={styles.sectionHeader}>
        Recent Articles
      </Header>
      <Card.Group centered>
        {recentPosts.map((p) => (
          <ArticleCard
            key={p.id}
            title={p.title}
            id={p.id}
            description={p.abstract || (p.body ? String(p.body).slice(0, 140) + "…" : "")}
            author={p.authorDisplay || p.authorName || "—"}
            imageUrl={p.imageUrl}
          />
        ))}
      </Card.Group>
      <div className={styles.buttonWrapper}>
        <Button
          className='btn-primary'
          onClick={() => navigate("/articles")}
        >
          See all articles
        </Button>
      </div>

      {/* ---------- Recent Questions ---------- */}
      <Header as="h2" className={styles.sectionHeader}>
        Recent Questions
      </Header>
      <Card.Group centered>
        {recentQuestions.map((q) => (
          <QuestionCard
            key={q.id}
            title={q.title}
            id={q.id} 
            description={q.description}
            author={q.authorDisplay || q.authorName || "—"}
            tags={q.tags}
            createdAt={q.createdAt}
          />
        ))}
      </Card.Group>
      <div className={styles.buttonWrapper}>
        <Button
          className='btn-primary'
          onClick={() => navigate("/question")}
        >
          Browse questions
        </Button>
      </div>
    </div>
  );
}
