import { getApp, getApps, initializeApp } from "firebase/app";
import {
    browserLocalPersistence,
    getAuth,
    setPersistence,
    type Auth,
} from "firebase/auth";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyA5I6XNy4hraST3hFb7VsAqsf2I_eeB2GQ",
  authDomain: "solacecapstone.firebaseapp.com",
  projectId: "solacecapstone",
  storageBucket: "solacecapstone.firebasestorage.app",
  messagingSenderId: "950629810443",
  appId: "1:950629810443:web:76cebe594be508a1bae20e",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth: Auth = getAuth(app);

if (Platform.OS === "web") {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export { app, auth };

