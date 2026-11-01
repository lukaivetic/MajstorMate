import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCColazPmUAjWK2hAbke-055MmvNlo4b-E",
  authDomain: "majstormate-c16bb.firebaseapp.com",
  projectId: "majstormate-c16bb",
  storageBucket: "majstormate-c16bb.firebasestorage.app",
  messagingSenderId: "177293548563",
  appId: "1:177293548563:web:4519532cef6228aa8af3e6"
};

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const auth = getAuth(app);

export const storage = getStorage(app);
