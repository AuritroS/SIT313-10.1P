import React from "react";
import { Grid, List, Icon, Button } from "semantic-ui-react";
import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";   // ✅ add this
import styles from "./Footer.module.css";

const Footer = () => {
  const { premium } = useAuth(); // ✅ get premium state

  return (
    <div className={styles.footer}>
      <Grid columns={premium ? 3 : 4} divided stackable>
        <Grid.Row>
          <Grid.Column>
            <List>
              <List.Header className={styles.header}>Explore</List.Header>
              <List.Item as={Link} to="/">Home</List.Item>
              <List.Item as={Link} to="/question">Questions</List.Item>
              <List.Item as={Link} to="/articles">Articles</List.Item>
            </List>
          </Grid.Column>

          <Grid.Column>
            <List>
              <List.Header className={styles.header}>Support</List.Header>
              <List.Item>FAQs</List.Item>
              <List.Item>Help</List.Item>
              <List.Item>Contact Us</List.Item>
            </List>
          </Grid.Column>

          <Grid.Column textAlign="center">
            <List horizontal className={styles.social}>
              <List.Item><Icon name="facebook" size="large" link /></List.Item>
              <List.Item><Icon name="twitter" size="large" link /></List.Item>
              <List.Item><Icon name="instagram" size="large" link /></List.Item>
            </List>
          </Grid.Column>

          {/* ✅ Only render if NOT premium */}
          {!premium && (
            <Grid.Column>
              <List>
                <List.Header className={styles.header}>Plans</List.Header>
                <List.Item as={Link} to="/plans">View Plans</List.Item>
              </List>
              <Button as={Link} to="/pay" className={`btn-primary ${styles.plansBtn}`}>
                Upgrade
              </Button>
            </Grid.Column>
          )}
        </Grid.Row>
      </Grid>

      <div className={styles.bottom}>
        DEV@Deakin 2022 • Privacy Policy • Terms • Code of Conduct
      </div>
    </div>
  );
};

export default Footer;
