import React from "react";
import { Menu, Input } from "semantic-ui-react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../api/firebase";
import useAuth from "../../hooks/useAuth";
import PremiumBadge from "../../pages/Home/PremiumBadge";
import styles from "./Navbar.module.css";

const Navbar = () => {
  const { user, premium } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  return (
    <Menu className={styles.nav}>
      {/* Left */}
      <Menu.Item as={NavLink} to="/" header>
        DEV@Deakin
      </Menu.Item>
      <Menu.Item as={NavLink} to="/question" name="Find Question" />
      <Menu.Item as={NavLink} to="/post" name="Post" />

      {/* Middle: full-length search (grows to fill remaining space) */}
      <Menu.Item className={styles.grow}>
        <Input
          icon="search"
          placeholder="Search…"
          fluid
          className={styles.search}
        />
      </Menu.Item>

      {/* Right */}
      <Menu.Menu position="right">
  {user ? (
    <>
      <Menu.Item
  as={NavLink}
  to={premium ? "/theme" : "/plans"}  // ✅ conditional link
  className={`${styles.user} ${premium ? styles.userPremium : styles.userFree}`}
>
  <span className={styles.userName}>
    {user.displayName || "User"}
  </span>
  {premium && <PremiumBadge />}
</Menu.Item>


      <Menu.Item name="Logout" onClick={handleLogout} />
    </>
  ) : (
    <Menu.Item as={NavLink} to="/login" name="Login" />
  )}
</Menu.Menu>
    </Menu>
  );
};

export default Navbar;
