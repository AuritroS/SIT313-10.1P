import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAtz-7U-jFERnUb6NU0-VeGezZlW_BFa8k",
  authDomain: "deakin-app-7d1a8.firebaseapp.com",
  projectId: "deakin-app-7d1a8",
  storageBucket: "deakin-app-7d1a8.firebasestorage.app",
  messagingSenderId: "1022319390737",
  appId: "1:1022319390737:web:94b258e6bd9310906cc1b0",
  measurementId: "G-5J45YH0H4N"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/* ---------- Auth helpers ---------- */

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export const signInWithGooglePopup = () => signInWithPopup(auth, googleProvider);
export const createAuthUserWithEmailAndPassword = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);
export const signInAuthUserWithEmailAndPassword = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const createUserDocFromAuth = async (userAuth, additional = {}) => {
  if (!userAuth) return null;
  const ref = doc(db, "users", userAuth.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(
      ref,
      { email: userAuth.email ?? null, createdAt: new Date(), hiddenQuestionIds: [], ...additional },
      { merge: true }
    );
  }
  return ref;
};

/* ---------- Collections ---------- */

const postsCol = collection(db, "posts");
const questionsCol = collection(db, "questions");

/* ---------- Utilities ---------- */

const ensureUserDoc = async (uid) => {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { createdAt: new Date(), hiddenQuestionIds: [], questionOrder: [] }, { merge: true });
  }
  return ref;
};

const toTagsArray = (val) => {
  if (!val) return [];
  const arr = Array.isArray(val) ? val : String(val).split(",");
  return Array.from(
    new Set(
      arr
        .map((t) => String(t).trim().toLowerCase())
        .filter(Boolean)
        .map((t) => t.replace(/\s+/g, "-").replace(/[^a-z0-9+\-]/g, ""))
        .filter(Boolean)
    )
  );
};

/* ---------- Posts & Questions ---------- */

/** Create Post. Call after optional image upload (imageUrl). */
export const createPost = async ({
  title = "",
  abstract = "",
  body = "",
  tags = [],
  imageUrl = "",
  authorId = auth.currentUser?.uid ?? null,
}) => {
  const now = serverTimestamp();
  const ref = await addDoc(postsCol, {
    title,
    abstract,
    body,
    tags: toTagsArray(tags),
    imageUrl,
    authorId,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
};

/** Create Question with normalized, de-duplicated tags. */
export const createQuestion = async ({
  title = "",
  description = "",
  tags = [],
  tag,
  authorId = auth.currentUser?.uid ?? null,
}) => {
  const now = serverTimestamp();
  const ref = await addDoc(questionsCol, {
    title,
    description,
    tags: toTagsArray(tags.length ? tags : tag),
    authorId,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
};

/* Deletes  */
export const deletePost = (postId) => deleteDoc(doc(db, "posts", postId));
export const deleteQuestion = (questionId) => deleteDoc(doc(db, "questions", questionId));

/* Real-time listeners  */
export const listenToPosts = (cb) => onSnapshot(query(postsCol, orderBy("createdAt", "desc")), cb);
export const listenToQuestions = (cb) => onSnapshot(query(questionsCol, orderBy("createdAt", "desc")), cb);

/* ---------- Per-user "Hide question" ---------- */

export const hideQuestionForUser = async (questionId, uid = auth.currentUser?.uid) => {
  if (!uid) throw new Error("Not authenticated");
  const ref = await ensureUserDoc(uid);
  await updateDoc(ref, { hiddenQuestionIds: arrayUnion(questionId) });
};

export const unhideQuestionForUser = async (questionId, uid = auth.currentUser?.uid) => {
  if (!uid) throw new Error("Not authenticated");
  const ref = await ensureUserDoc(uid);
  await updateDoc(ref, { hiddenQuestionIds: arrayRemove(questionId) });
};

export const listenToHiddenQuestionIds = (uid, cb) => {
  if (!uid) return () => { };
  const ref = doc(db, "users", uid);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data().hiddenQuestionIds ?? [] : []));
};

/* ---------- Per-user "Question order" ---------- */

export const listenToQuestionOrder = (uid, cb) => {
  if (!uid) return () => { };
  const ref = doc(db, "users", uid);
  return onSnapshot(ref, (snap) => {
    const order = snap.exists() && Array.isArray(snap.data().questionOrder) ? snap.data().questionOrder : [];
    cb(order);
  });
};

export const saveQuestionOrder = async (uid, orderIds) => {
  if (!uid) throw new Error("Not authenticated");
  const ref = await ensureUserDoc(uid);
  await setDoc(ref, { questionOrder: Array.isArray(orderIds) ? orderIds : [] }, { merge: true });
};

export async function markUserPremium(uid) {
  await updateDoc(doc(db, "users", uid), {
    premium: true,
    premiumSince: new Date(),
  });
}