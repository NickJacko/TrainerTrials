// assets/js/firebase.client.js
// Central Firebase client module for TrainerTrials
// Import this in all pages instead of duplicating config

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyDdStpC5rVtgaZ4XvtKLwQttnyIDXL2z7Q",
  authDomain: "trainertrials.firebaseapp.com",
  databaseURL: "https://trainertrials-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "trainertrials",
  storageBucket: "trainertrials.firebasestorage.app",
  messagingSenderId: "22071275267",
  appId: "1:22071275267:web:92e82d6bfaee169aff8336"
};

// Prevent duplicate app initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);

export { app, db };