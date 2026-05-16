import { readFileSync } from "node:fs";

import { type App, cert, getApps, initializeApp } from "firebase-admin/app";
import { type DecodedIdToken, getAuth } from "firebase-admin/auth";

import { type BackendConfig } from "./config.js";
import { getErrorContext, logError } from "./logger.js";

interface FirebaseServiceAccount {
  readonly projectId?: string;
  readonly clientEmail?: string;
  readonly privateKey?: string;
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

  if (isEmptyServiceAccount(serviceAccount)) {
    return initializeApp({
      ...(projectId === undefined ? {} : { projectId }),
    });
  }

  return initializeApp({
    credential: cert({
      ...(projectId === undefined ? {} : { projectId }),
      ...(serviceAccount.clientEmail === undefined ? {} : { clientEmail: serviceAccount.clientEmail }),
      ...(serviceAccount.privateKey === undefined ? {} : { privateKey: serviceAccount.privateKey }),
    }),
    ...(projectId === undefined ? {} : { projectId }),
  });
}

function parseServiceAccount(value: string | undefined): FirebaseServiceAccount {
  if (value === undefined) {
    return {};
  }

  return JSON.parse(readServiceAccountValue(value)) as FirebaseServiceAccount;
}

function readServiceAccountValue(value: string): string {
  if (value.startsWith("{")) {
    return value;
  }

  return readFileSync(value, "utf8");
}

function isEmptyServiceAccount(value: FirebaseServiceAccount): boolean {
  return value.projectId === undefined
    && value.clientEmail === undefined
    && value.privateKey === undefined;
}
