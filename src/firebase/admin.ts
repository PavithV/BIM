// src/firebase/admin.ts
import * as admin from 'firebase-admin';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

let adminApp: admin.app.App;

function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }
  
  if (serviceAccount) {
    // Standard initialization with service account key
     return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Initialization for Firebase Hosting or Cloud Functions/Run
    return admin.initializeApp();
  }
}

export function getAdminApp(): admin.app.App {
  if (!adminApp) {
    adminApp = initializeAdminApp();
  }
  return adminApp;
}

export function getAdminAuth(): admin.auth.Auth {
    return getAdminApp().auth();
}
