// src/firebase/admin.ts
import * as admin from 'firebase-admin';

// This guard prevents re-initialization in hot-reload scenarios.
if (!admin.apps.length) {
    try {
        // Attempt initialization with service account from environment variables.
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
            : undefined;

        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        } else {
            // Fallback for environments where service account is not set
            // (e.g., Firebase Hosting, Cloud Functions with default credentials).
            admin.initializeApp();
        }
    } catch (error) {
        console.error("Firebase Admin initialization error:", error);
    }
}


export const getAdminApp = () => admin.app();
export const getAdminAuth = () => admin.auth();
