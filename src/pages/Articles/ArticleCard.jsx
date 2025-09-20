// src/components/Articles/ArticleCard.jsx
import React from "react";
import { Card, Image } from "semantic-ui-react";
import { useNavigate } from "react-router-dom";
import styles from "./ArticleCard.module.css";

const ArticleCard = ({ id, title, description, imageUrl }) => {
  const navigate = useNavigate();

  return (
    <Card
      className={styles.card}
      onClick={() => navigate(`/articles/${id}`)}
    >
      <Image src={imageUrl || "https://picsum.photos/600/360" } wrapped ui={false} className={styles.image}   />
      <Card.Content className={styles.content}>
        <Card.Header className={styles.header}>{title}</Card.Header>
        <Card.Description className={styles.desc}>{description}</Card.Description>
      </Card.Content>
    </Card>
  );
};

export default ArticleCard;
