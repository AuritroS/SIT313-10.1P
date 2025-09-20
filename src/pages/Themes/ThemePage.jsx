// src/pages/ThemePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../app/providers/ThemeContext";
import useAuth from "../../hooks/useAuth";
import {
  addThemePreset,
  listThemePresets,
  deleteThemePreset,
} from "../../api/themeStore";
import styles from "./ThemePage.module.css";

/* ---------- In-memory cache to survive remounts ---------- */
const presetCache = new Map(); // key: userUid -> array of presets

/* ========= Color helpers ========= */
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const HEX = /^#(?:[0-9a-f]{3}){1,2}$/i;
const asHex = (v, fb = "#000000") => (HEX.test(v || "") ? v : fb);

function hexToRgb(hex) {
  const c = hex.replace("#", "");
  const n = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return { r, g, b };
}
function rgbToHex({ r, g, b }) {
  const t = (v) => v.toString(16).padStart(2, "0");
  return `#${t(r)}${t(g)}${t(b)}`;
}
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
function hslToRgb({ h, s, l }) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
  return { r, g, b };
}
const hexToHsl = (hex) => rgbToHsl(hexToRgb(hex));
const hslToHex = (hsl) => rgbToHex(hslToRgb(hsl));
function adjust(hsl, { dh = 0, ds = 0, dl = 0 }) {
  return {
    h: ((hsl.h + dh) % 360 + 360) % 360,
    s: Math.min(100, Math.max(0, hsl.s + ds)),
    l: Math.min(100, Math.max(0, hsl.l + dl)),
  };
}
function contrastOn(bgHex) {
  const { r, g, b } = hexToRgb(bgHex);
  const lum = (v) => {
    v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b);
  return L > 0.5 ? "#111111" : "#ffffff";
}

/* ===== Default Theme ===== */
const DEFAULT_THEME = {
  bgColor: "#ffffff",
  textColor: "#111111",
  accentColor: "#4f46e5",
  navbarBg: "#f3f4f6",
  footerBg: "#f3f4f6",
  inputBg: "#ffffff",
  inputBorder: "#e5e7eb",
};

function buildThemeFromBrand(brandHex) {
  const base = hexToHsl(brandHex);
  const accentColor = brandHex;
  const navbarBg = hslToHex(adjust(base, { ds: -20, dl: 65 }));
  const footerBg = hslToHex(adjust(base, { ds: -22, dl: 63 }));
  const inputBg = "#ffffff";
  const inputBorder = hslToHex(adjust(base, { ds: -10, dl: 40 }));
  const bgColor = hslToHex(adjust(base, { ds: -30, dl: 92 }));
  const textColor = contrastOn(bgColor);
  return { bgColor, textColor, accentColor, navbarBg, footerBg, inputBg, inputBorder };
}

export default function ThemePage() {
  const { theme, updateTheme, resetTheme } = useTheme();
  const { user } = useAuth();

  const [brand, setBrand] = useState(asHex(theme?.accentColor, "#4f46e5"));
  const [newName, setNewName] = useState("");

  // presets: null = loading; [] = empty; array = loaded
  const [presets, setPresets] = useState(null);

  // keep draft filled with defaults
  const [draft, setDraft] = useState({ ...DEFAULT_THEME, ...theme });
  useEffect(() => {
    setDraft((prev) => ({ ...DEFAULT_THEME, ...prev, ...theme }));
    setBrand(asHex(theme?.accentColor, "#4f46e5"));
  }, [theme]);

  const preview = useMemo(() => buildThemeFromBrand(brand), [brand]);

  // Load presets with cache hydration
  useEffect(() => {
    if (!user?.uid) {
      setPresets([]);
      return;
    }

    const cached = presetCache.get(user.uid);
    if (cached) {
      // hydrate immediately to avoid flicker
      setPresets(cached);
      // optional: refresh in background (kept simple here)
      return;
    }

    let cancelled = false;
    (async () => {
      setPresets(null); // show "loading" state, not "No saved themes"
      const list = await listThemePresets(user.uid);
      if (!cancelled) {
        presetCache.set(user.uid, list);
        setPresets(list);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.uid]);

  const applyBrandTheme = () => updateTheme(preview);

  const handleSavePreset = async () => {
    if (!user?.uid) return;
    const name = newName.trim() || "My Theme";
    const id = await addThemePreset(user.uid, name, theme);
    const next = [{ id, name, theme }, ...(presets || [])];
    presetCache.set(user.uid, next);
    setPresets(next);
    setNewName("");
  };

  const handleApplyPreset = (p) => {
    updateTheme(p.theme);
    // no presets reload; cache/state unchanged
  };

  const handleDeletePreset = async (id) => {
    if (!user?.uid) return;
    await deleteThemePreset(user.uid, id);
    const next = (presets || []).filter((x) => x.id !== id);
    presetCache.set(user.uid, next);
    setPresets(next);
  };

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Theme Settings</h2>
      <p className={styles.subtext}>
        Pick a single brand color to generate a palette, or fine-tune below. Save presets to reuse later.
      </p>

      {/* Build from one color */}
      <h4>Build from one color</h4>
      <div className={styles.section}>
        <div className={styles.row}>
          <label className={styles.label}>
            <span>Brand color</span>
            <input
              type="color"
              value={asHex(brand, "#4f46e5")}
              onChange={(e) => setBrand(asHex(e.target.value, "#4f46e5"))}
            />
          </label>
          <button className="btn-primary" onClick={applyBrandTheme}>
            Use This Color
          </button>
        </div>
      </div>

      {/* Fine-tune */}
      <h4 className={styles.subheading}>Fine-tune settings</h4>
      <div className={styles.section}>
        <div className={styles.fineControls}>
          {[
            ["Accent", "accentColor"],
            ["Background", "bgColor"],
            ["Text", "textColor"],
            ["Navbar", "navbarBg"],
            ["Footer", "footerBg"],
            ["Input background", "inputBg"],
          ].map(([label, key]) => (
            <label key={key} className={styles.label}>
              <span>{label}</span>
              <input
                type="color"
                value={asHex(draft[key], DEFAULT_THEME[key])}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [key]: asHex(e.target.value, DEFAULT_THEME[key]) }))
                }
              />
            </label>
          ))}
          <button className={`btn-primary ${styles.applyButton}`} onClick={() => updateTheme(draft)}>
            Apply Changes
          </button>
        </div>
      </div>

      {/* Default themes */}
      <h4 className={styles.subheading}>Default themes</h4>
      <div className={styles.section}>
        <div className={styles.actions}>
          <button className={styles.outlineButton} onClick={resetTheme}>
            Reset to Default
          </button>
          <button
            className={styles.outlineButton}
            onClick={() =>
              updateTheme({
                bgColor: "#eacec7",
                textColor: "#130907",
                accentColor: "#a8543e",
                navbarBg: "#ddaea2",
                footerBg: "#ddaea2",
                inputBg: "#f8efec",
                inputBorder: "#eacec7",
              })
            }
          >
            Use Premium Theme
          </button>
        </div>
      </div>

      {/* Save current as preset */}
      <div className={styles.savePreset}>
        <h4>Save current theme</h4>
        <div className={styles.row}>
          <input
            placeholder="Preset name (e.g., Coral Light)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn-primary" onClick={handleSavePreset} disabled={!user?.uid}>
            Save Preset
          </button>
        </div>
      </div>

      {/* Saved presets */}
      <div className={styles.presets}>
        <h4>Saved themes</h4>

        {presets === null ? (
          <p style={{ opacity: 0.7 }}>Loading presets…</p>
        ) : presets.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No saved themes yet.</p>
        ) : (
          <div className={styles.presetsGrid}>
            {presets.map((p) => (
              <div key={p.id} className={styles.presetCard}>
                <div className={styles.presetHeader}>
                  <strong className={styles.presetName}>{p.name}</strong>
                </div>
                <div className={styles.swatches}>
                  {["accentColor", "bgColor", "textColor", "navbarBg", "footerBg", "inputBg"].map((k) => (
                    <div key={k} title={k} className={styles.swatch} style={{ background: p.theme?.[k] || "transparent" }} />
                  ))}
                </div>
                <div className={styles.presetButtons}>
                  <button className="btn-primary" onClick={() => handleApplyPreset(p)} style={{ flex: 1 }}>
                    Apply
                  </button>
                  <button onClick={() => handleDeletePreset(p.id)} className={styles.deleteButton}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
