// src/components/QuestionCard.jsx
import React from "react";
import { Card, Icon, Label } from "semantic-ui-react";
import { useNavigate } from "react-router-dom";
import styles from "./QuestionCard.module.css";

export default function QuestionCard({ id, title, description, author, tags = [], createdAt }) {
  const navigate = useNavigate();
  const dateStr = createdAt ? new Date(createdAt.seconds * 1000).toLocaleDateString() : "";
  const open = () => id && navigate(`/question/${id}`);

  return (
    <Card className={styles.card} onClick={open} link>
      <Card.Content>
        <Card.Header className={styles.header}>{title}</Card.Header>
        <Card.Meta className={styles.meta}>
          {dateStr && <span className={styles.date}>{dateStr}</span>}
        </Card.Meta>
        <Card.Description className={styles.desc}>
          {description?.length > 140 ? description.slice(0, 140) + "…" : description}
        </Card.Description>
      </Card.Content>
      {tags.length > 0 && (
        <Card.Content extra className={styles.tagsRow}>
          {tags.map((t) => (
            <Label key={t} size="tiny" className={styles.tag}>
              <Icon name="tag" className={styles.tagIcon} />
              {t}
            </Label>
          ))}
        </Card.Content>
      )}
    </Card>
  );
}
