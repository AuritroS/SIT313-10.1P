// src/app/providers/ThemeContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import useAuth from "../../hooks/useAuth";
import { loadUserTheme, saveUserTheme } from "../../api/themeStore";

const DEFAULT_THEME = {
  bgColor: "#ffffff",
  textColor: "#111111",
  accentColor: "#27818c",
  navbarBg: "#ffffff",
  footerBg: "#ffffff",
  inputBg: "#ffffff",
  inputBorder: "#ccc",
};

const PREMIUM_THEME = {
  bgColor: "#eacec7",
  textColor: "#130907",
  accentColor: "#a8543e",
  navbarBg: "#ddaea2",
  footerBg: "#ddaea2",
  inputBg: "#f8efec",
  inputBorder: "#eacec7",
};

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  updateTheme: () => {},
  resetTheme: () => {},
});

export function ThemeProvider({ children }) {
  const { user, premium } = useAuth();
  const [theme, setTheme] = useState(DEFAULT_THEME);

  // Load theme when a premium user logs in
  useEffect(() => {
    let cancelled = false;

    async function initTheme() {
      if (!user || !premium) {
        setTheme(DEFAULT_THEME);
        return;
      }

      const saved = await loadUserTheme(user.uid);
      if (!cancelled) {
        if (saved) {
          setTheme(saved);
        } else {
          setTheme(PREMIUM_THEME);
          await saveUserTheme(user.uid, PREMIUM_THEME);
        }
      }
    }

    initTheme();
    return () => {
      cancelled = true;
    };
  }, [user, premium]);

  // Apply theme variables to document root
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--bg-color", theme.bgColor);
    r.style.setProperty("--text-color", theme.textColor);
    r.style.setProperty("--accent-color", theme.accentColor);
    r.style.setProperty("--navbar-bg", theme.navbarBg || theme.bgColor);
    r.style.setProperty("--footer-bg", theme.footerBg || theme.bgColor);
    r.style.setProperty("--input-bg", theme.inputBg || theme.bgColor);
    r.style.setProperty("--input-border", theme.inputBorder || "#ccc");
  }, [theme]);

  // 🔑 Updates immediately save to Firestore if premium user
  const applyTheme = async (newTheme) => {
    setTheme(newTheme);
    if (user && premium) {
      await saveUserTheme(user.uid, newTheme);
    }
  };

  // ✅ Memoize value to prevent unnecessary provider remounts
  const value = useMemo(
    () => ({
      theme,
      setTheme: applyTheme,
      updateTheme: (patch) => applyTheme({ ...theme, ...patch }),
      resetTheme: () => applyTheme(DEFAULT_THEME),
    }),
    [theme] // only recreate when theme actually changes
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
