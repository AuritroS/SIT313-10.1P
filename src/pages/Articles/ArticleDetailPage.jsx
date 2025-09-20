// src/components/Articles/ArticleDetailPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../api/firebase";
import styles from "./ArticleDetailPage.module.css";
import { Header, Image, Icon, Button } from "semantic-ui-react";

export default function ArticleDetailPage() {
  const { id } = useParams();
    const [article, setArticle] = useState(null);
    const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDoc(doc(db, "posts", id));
      if (snap.exists()) setArticle({ id: snap.id, ...snap.data() });
    };
    fetch();
  }, [id]);

  if (!article) return <p>Loading…</p>;

  return (
      <div className={styles.wrapper}>
          <Button  labelPosition="left" className={styles.backBtn} onClick={() => navigate(-1)}>
        <Icon name="arrow left" /> Back
      </Button>
      <Header as="h1" className={styles.title}>{article.title}</Header>
      {article.imageUrl && (
        <Image src={article.imageUrl} className={styles.image} />
      )}
      <p className={styles.abstract}>{article.abstract}</p>
      <div className={styles.body}>
        {article.body}
      </div>
    </div>
  );
}
