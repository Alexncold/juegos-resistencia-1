// js/firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCs8cP3ieGoHjRJ29ArlTpEikbNz2G5BfU",
  authDomain: "resistencia-juegos.firebaseapp.com",
  projectId: "resistencia-juegos",
  storageBucket: "resistencia-juegos.firebasestorage.app",
  messagingSenderId: "526008068394",
  appId: "1:526008068394:web:cc781e25504cdfc13c1653"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };