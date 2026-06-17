// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDg2GokmZnivtv9pjRgYuksyA38afOrXiU",
  authDomain: "skillswap-ce6f9.firebaseapp.com",
  projectId: "skillswap-ce6f9",
  storageBucket: "skillswap-ce6f9.firebasestorage.app",
  messagingSenderId: "474339154909",
  appId: "1:474339154909:web:8adc585e201b331aca7434"
};

const app = initializeApp(firebaseConfig);

// 🔥 IMPORTANT: plain Firestore ONLY
const db = getFirestore(app);

const auth = getAuth(app);
const storage = getStorage(app);

export { app, auth, db, storage };