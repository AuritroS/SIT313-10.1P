// src/dev/seedFirestore.js
import { collection, addDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../api/firebase"; // adjust path if needed
import { faker } from "@faker-js/faker";

const randTags = () => {
  const pool = ["react", "firebase", "node", "css", "db", "cloud"];
  const n = Math.floor(Math.random() * 3) + 1;
  return Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]);
};

const placeholderImg = () =>
  `https://picsum.photos/seed/${Math.round(Math.random() * 1e9)}/640/360`;

export async function seedFirestore({ posts = 10, questions = 15 } = {}) {
  // Seed posts (articles)
  for (let i = 0; i < posts; i++) {
    const ref = await addDoc(collection(db, "posts"), {
      title: faker.commerce.productName(),
      abstract: faker.lorem.sentences(2),
      body: faker.lorem.paragraphs(3),
      tags: randTags(),
      imageUrl: placeholderImg(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Merge the Firestore-generated ID back into the doc
    await setDoc(ref, { id: ref.id }, { merge: true });
  }

  // Seed questions
  for (let i = 0; i < questions; i++) {
    const ref = await addDoc(collection(db, "questions"), {
      title: `${faker.hacker.verb()} ${faker.hacker.noun()}?`,
      description: faker.lorem.paragraphs(2),
      tags: randTags(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(ref, { id: ref.id }, { merge: true });
  }

  alert(`✅ Seeded ${posts} posts and ${questions} questions.`);
}
