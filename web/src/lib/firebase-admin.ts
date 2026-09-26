// Server-only credentials. Never expose these through NEXT_PUBLIC_* variables.
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  admin.initializeApp({
    projectId,
    credential: privateKey && clientEmail
      ? admin.credential.cert({ projectId, privateKey, clientEmail })
      : admin.credential.applicationDefault(),
  });
}
export { admin };
export const messaging = admin.messaging();
export const firestore = admin.firestore();
export const adminFirestore = () => admin.firestore();
export const adminAuth = () => admin.auth();
