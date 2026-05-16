import { readFileSync } from "node:fs";

import { type App, cert, getApps, initializeApp } from "firebase-admin/app";
import { type DecodedIdToken, getAuth } from "firebase-admin/auth";

import { type BackendConfig } from "./config.js";
import { getErrorContext, logError } from "./logger.js";

interface FirebaseServiceAccount {
  readonly projectId: string | undefined;
  readonly clientEmail: string | undefined;
  readonly privateKey: string | undefined;
}

interface FirebaseServiceAccountJson {
  readonly project_id?: string;
  readonly client_email?: string;
  readonly private_key?: string;
  readonly projectId?: string;
  readonly clientEmail?: string;
  readonly privateKey?: string;
}

interface CompleteFirebaseServiceAccount {
  readonly projectId: string;
  readonly clientEmail: string;
  readonly privateKey: string;
}

export interface FirebaseAuthVerifier {
  readonly verifyIdToken: (token: string) => Promise<DecodedIdToken>;
}

export interface FirebaseAdminHealth {
  readonly isReady: () => boolean;
}

export function createFirebaseAuthVerifier(config: BackendConfig): FirebaseAuthVerifier {
  return {
    verifyIdToken: (token: string) => getAuth(getFirebaseApp(config)).verifyIdToken(token, true),
  };
}

export function createFirebaseAdminHealth(config: BackendConfig): FirebaseAdminHealth {
  return {
    isReady: () => {
      try {
        getFirebaseApp(config);
        return true;
      } catch (error) {
        logError("firebase_admin_initialization_failed", getErrorContext(error));
        return false;
      }
    },
  };
}

function getFirebaseApp(config: BackendConfig): App {
  const existingApp = getApps()[0];

  if (existingApp !== undefined) {
    return existingApp;
  }

  const serviceAccount = parseServiceAccount(config.firebaseServiceAccount);
  const projectId = serviceAccount.projectId ?? config.firebaseProjectId;
  const resolvedServiceAccount = {
    projectId,
    clientEmail: serviceAccount.clientEmail,
    privateKey: serviceAccount.privateKey,
  };

  validateServiceAccount(resolvedServiceAccount);

  return initializeApp({
    credential: cert({
      projectId: resolvedServiceAccount.projectId,
      clientEmail: resolvedServiceAccount.clientEmail,
      privateKey: resolvedServiceAccount.privateKey,
    }),
    projectId: resolvedServiceAccount.projectId,
  });
}

function parseServiceAccount(value: string | undefined): FirebaseServiceAccount {
  if (value === undefined) {
    return {
      projectId: undefined,
      clientEmail: undefined,
      privateKey: undefined,
    };
  }

  return normalizeServiceAccount(JSON.parse(readServiceAccountValue(value)) as FirebaseServiceAccountJson);
}

function readServiceAccountValue(value: string): string {
  if (value.startsWith("{")) {
    return value;
  }

  return readFileSync(value, "utf8");
}

function normalizeServiceAccount(value: FirebaseServiceAccountJson): FirebaseServiceAccount {
  return {
    projectId: value.projectId ?? value.project_id,
    clientEmail: value.clientEmail ?? value.client_email,
    privateKey: value.privateKey ?? value.private_key,
  };
}

function validateServiceAccount(value: FirebaseServiceAccount): asserts value is CompleteFirebaseServiceAccount {
  if (value.projectId === undefined || value.clientEmail === undefined || value.privateKey === undefined) {
    throw new Error("Firebase service-account credentials are incomplete.");
  }
}
