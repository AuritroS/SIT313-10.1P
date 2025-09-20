// src/api/themeStore.js
import { db } from "./firebase";
import {
  doc, getDoc, setDoc,
  collection, addDoc, getDocs, deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

/** Load the user's current theme (from users/{uid}.theme) */
export async function loadUserTheme(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().theme || null) : null;
}

/** Persist current theme on the user doc (users/{uid}.theme) */
export async function saveUserTheme(uid, theme) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { theme, themeUpdatedAt: serverTimestamp() }, { merge: true });
}

/** Save a named preset in users/{uid}/themes */
export async function addThemePreset(uid, name, theme) {
  const colRef = collection(db, "users", uid, "themes");
  const docRef = await addDoc(colRef, {
    name: name?.trim() || "Untitled",
    theme,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/** List all presets for a user from users/{uid}/themes */
export async function listThemePresets(uid) {
  const colRef = collection(db, "users", uid, "themes");
  const qs = await getDocs(colRef);
  return qs.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Delete a preset by id */
export async function deleteThemePreset(uid, presetId) {
  const ref = doc(db, "users", uid, "themes", presetId);
  await deleteDoc(ref);
}

