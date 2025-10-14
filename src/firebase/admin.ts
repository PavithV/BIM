// src/firebase/admin.ts
import * as admin from 'firebase-admin';

// This guard prevents re-initialization in hot-reload scenarios.
if (!admin.apps.length) {
  try {
    // Initialize the Admin SDK. It will automatically use the credentials
    // available in the App Hosting environment, without needing a service account key file.
    admin.initializeApp();
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}


export const getAdminApp = () => admin.app();
export const getAdminAuth = () => admin.auth();
