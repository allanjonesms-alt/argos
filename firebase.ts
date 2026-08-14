
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const configObj = (firebaseConfig || {}) as Record<string, any>;

const activeFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || configObj.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || configObj.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || configObj.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || configObj.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || configObj.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || configObj.appId || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || configObj.measurementId || '',
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || configObj.firestoreDatabaseId || 'aborda5'
};

// Initialize Firebase SDK safely
const app = !getApps().length ? initializeApp(activeFirebaseConfig) : getApp();
export const db = activeFirebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, activeFirebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

export async function logAction(userId: string, userName: string, action: string, details: string, metadata: any = {}) {
  try {
    await addDoc(collection(db, 'logs'), {
      userId,
      userName,
      action,
      details,
      metadata,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error recording log:', error);
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}
