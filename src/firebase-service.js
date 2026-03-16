import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
    getDatabase,
    get,
    onValue,
    ref,
    set
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA8jfFX9Ch357bKODUCY7NoStr_B9pZNM0",
    authDomain: "bb-scoreboardnew.firebaseapp.com",
    projectId: "bb-scoreboardnew",
    storageBucket: "bb-scoreboardnew.firebasestorage.app",
    messagingSenderId: "244069146587",
    appId: "1:244069146587:web:34549c90f1eeb6c3cd11fe",
    measurementId: "G-2J5SK54WZK",
    databaseURL:"https://bb-scoreboardnew-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

export {
    auth,
    db,
    get,
    onAuthStateChanged,
    onValue,
    ref,
    set,
    signInWithEmailAndPassword,
    signOut
};
