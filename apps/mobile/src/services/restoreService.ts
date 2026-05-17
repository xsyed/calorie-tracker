import { open } from '@op-engineering/op-sqlite';
import auth from '@react-native-firebase/auth';
import RNFS from 'react-native-fs';

import {
  initDatabase,
  userExists,
} from '../database';
import {
  cleanupDatabaseBackupFile,
  DatabaseBackupFileError,
  createRestoreDownloadFilePath,
  prepareRestoreCandidateFile,
  replaceDatabaseWithCandidate,
} from './databaseBackupFileService';
import {
  downloadCloudBackup,
  CloudBackupError,
  listCloudBackups,
} from './backendStorageBackupClient';
import type { CloudBackupFile } from './backendStorageBackupClient';
import { BackupCryptoError, decryptBackupFile } from './backupCrypto';
import type { EncryptedBackupManifest } from './backupCrypto';
import { recoverMealReminderScheduleForUser } from './reminderRecoveryService';

const TRAILING_CRLF_BYTES = 2;

export type RestoreErrorCode =
  | 'checksum_unavailable'
  | 'checksum_mismatch'
  | 'incorrect_password'
  | 'download_failed'
  | 'migration_failed'
  | 'network_error'
  | 'permission_denied'
  | 'quota_exceeded'
  | 'uid_mismatch'
  | 'unsupported_platform'
  | 'restore_failed';

export interface RestoreBackupCandidate {
  checksum: string | null;
  createdTime: string;
  fileId: string;
  firebaseUid: string | null;
  manifest: EncryptedBackupManifest;
  modifiedTime: string;
  name: string;
  sizeBytes: number | null;
  storedEncryptedSizeBytes: number | null;
}

export interface DetectRestoreBackupsResult {
  candidates: RestoreBackupCandidate[];
  latestBackup: RestoreBackupCandidate | null;
}

export interface RestoreBackupSuccess {
  status: 'success';
  candidate: RestoreBackupCandidate;
}

export interface RestoreBackupFailure {
  status: 'error';
  code: RestoreErrorCode;
  message: string;
  nextCandidate: RestoreBackupCandidate | null;
}

export type RestoreBackupResult = RestoreBackupSuccess | RestoreBackupFailure;

class RestoreFlowError extends Error {
  constructor(
    public readonly code: RestoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RestoreFlowError';
  }
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function toCandidate(file: CloudBackupFile): RestoreBackupCandidate {
  return {
    checksum: file.checksum,
    createdTime: file.createdTime,
    fileId: file.id,
    firebaseUid: file.firebaseUid,
    manifest: file.manifest,
    modifiedTime: file.modifiedTime,
    name: file.name,
    sizeBytes: file.sizeBytes,
    storedEncryptedSizeBytes: file.storedEncryptedSizeBytes,
  };
}

function sortNewestFirst(
  candidates: RestoreBackupCandidate[],
): RestoreBackupCandidate[] {
  return [...candidates].sort(
    (left, right) => toTimestamp(right.createdTime) - toTimestamp(left.createdTime),
  );
}

function getNextCandidate(
  candidate: RestoreBackupCandidate,
  candidates: RestoreBackupCandidate[],
): RestoreBackupCandidate | null {
  const index = candidates.findIndex((item) => item.fileId === candidate.fileId);
  return index >= 0 ? candidates[index + 1] ?? null : null;
}

function splitFilePath(filePath: string): { location: string; name: string } {
  const separatorIndex = filePath.lastIndexOf('/');
  if (separatorIndex < 0) return { location: '', name: filePath };
  return {
    location: filePath.slice(0, separatorIndex),
    name: filePath.slice(separatorIndex + 1),
  };
}

async function verifyCandidateOwner(
  filePath: string,
  firebaseUid: string,
): Promise<void> {
  const { location, name } = splitFilePath(filePath);
  const candidateDb = open({ location, name });

  try {
    const result = await candidateDb.execute(
      'SELECT 1 FROM User WHERE firebase_uid = ? LIMIT 1',
      [firebaseUid],
    );
    if (result.rows.length === 0) {
      throw new RestoreFlowError(
        'uid_mismatch',
        'Backup belongs to a different account.',
      );
    }
  } finally {
    await candidateDb.closeAsync();
  }
}

async function verifyDownloadedBackupSize(
  filePath: string,
  expectedSizeBytes: number,
): Promise<void> {
  const stats = await RNFS.stat(filePath);
  const sizeBytes = Number(stats.size);
  if (isExpectedBackupSize(sizeBytes, expectedSizeBytes)) {
    return;
  }
  throw new RestoreFlowError(
    'checksum_mismatch',
    `Downloaded backup size mismatch (${sizeBytes}/${expectedSizeBytes} bytes).`,
  );
}

function isExpectedBackupSize(
  actualSizeBytes: number,
  expectedSizeBytes: number,
): boolean {
  return actualSizeBytes === expectedSizeBytes ||
    actualSizeBytes === expectedSizeBytes + TRAILING_CRLF_BYTES;
}

function getBackupSizeMismatchMessage(
  actualSizeBytes: number,
  expectedSizeBytes: number,
): string | null {
  if (isExpectedBackupSize(actualSizeBytes, expectedSizeBytes)) return null;
  if (actualSizeBytes < expectedSizeBytes) {
    return `Stored backup is incomplete (${actualSizeBytes}/${expectedSizeBytes} bytes).`;
  }
  return `Stored backup size mismatch (${actualSizeBytes}/${expectedSizeBytes} bytes).`;
}

function validateCloudBackupSize(candidate: RestoreBackupCandidate): void {
  if (candidate.storedEncryptedSizeBytes === null) return;
  const mismatchMessage = getBackupSizeMismatchMessage(
    candidate.storedEncryptedSizeBytes,
    candidate.manifest.encryptedSizeBytes,
  );
  if (mismatchMessage !== null) {
    throw new RestoreFlowError(
      'checksum_mismatch',
      mismatchMessage,
    );
  }
}

function mapCloudRestoreError(err: CloudBackupError): RestoreBackupFailure {
  if (err.code === 'permission_denied') {
    return {
      status: 'error',
      code: 'permission_denied',
      message: 'Cloud backup access is not configured or was denied.',
      nextCandidate: null,
    };
  }
  if (err.code === 'quota_exceeded') {
    return {
      status: 'error',
      code: 'quota_exceeded',
      message: 'Cloud backup storage quota exceeded.',
      nextCandidate: null,
    };
  }
  if (err.code === 'network_error') {
    return {
      status: 'error',
      code: 'network_error',
      message: 'Network failed while downloading the backup.',
      nextCandidate: null,
    };
  }
  return {
    status: 'error',
    code: 'download_failed',
    message: 'Backup download failed. Try again.',
    nextCandidate: null,
  };
}

function mapRestoreError(
  err: unknown,
  candidate: RestoreBackupCandidate,
  candidates: RestoreBackupCandidate[],
): RestoreBackupFailure {
  const nextCandidate = getNextCandidate(candidate, candidates);

  if (err instanceof CloudBackupError) {
    return { ...mapCloudRestoreError(err), nextCandidate };
  }
  if (err instanceof BackupCryptoError) {
    return {
      status: 'error',
      code: err.code === 'incorrect_password' ? 'incorrect_password' : 'restore_failed',
      message: err.code === 'incorrect_password'
        ? 'Incorrect backup password.'
        : 'Backup could not be decrypted.',
      nextCandidate,
    };
  }
  if (err instanceof RestoreFlowError) {
    return {
      status: 'error',
      code: err.code,
      message: err.message,
      nextCandidate,
    };
  }
  if (err instanceof DatabaseBackupFileError) {
    const checksumMismatch = err.message.includes('checksum mismatch');
    return {
      status: 'error',
      code: checksumMismatch ? 'checksum_mismatch' : 'restore_failed',
      message: checksumMismatch
        ? err.message
        : 'Backup file could not be prepared.',
      nextCandidate,
    };
  }
  return {
    status: 'error',
    code: 'restore_failed',
    message: 'Restore failed. Try again.',
    nextCandidate,
  };
}

export async function detectRestoreBackups(): Promise<DetectRestoreBackupsResult> {
  const currentUser = auth().currentUser;
  if (currentUser === null) {
    return { candidates: [], latestBackup: null };
  }
  const candidates = sortNewestFirst(
    (await listCloudBackups(currentUser.uid)).map(toCandidate),
  );
  return {
    candidates,
    latestBackup: candidates[0] ?? null,
  };
}

export async function restoreBackupForUser(
  candidate: RestoreBackupCandidate,
  candidates: RestoreBackupCandidate[],
  firebaseUid: string,
  password: string,
): Promise<RestoreBackupResult> {
  if (candidate.checksum === null) {
    return {
      status: 'error',
      code: 'checksum_unavailable',
      message: 'Backup cannot be verified.',
      nextCandidate: getNextCandidate(candidate, candidates),
    };
  }
  if (candidate.firebaseUid !== firebaseUid) {
    return {
      status: 'error',
      code: 'uid_mismatch',
      message: 'Backup belongs to a different account.',
      nextCandidate: getNextCandidate(candidate, candidates),
    };
  }
  const downloadPath = await createRestoreDownloadFilePath();
  const decryptedPath = await createRestoreDownloadFilePath();
  let candidatePath: string | null = null;

  try {
    validateCloudBackupSize(candidate);
    await downloadCloudBackup(firebaseUid, candidate.fileId, downloadPath);
    await verifyDownloadedBackupSize(downloadPath, candidate.manifest.encryptedSizeBytes);
    await decryptBackupFile(downloadPath, decryptedPath, password, candidate.manifest);
    const restoreFile = await prepareRestoreCandidateFile(decryptedPath, {
      expectedChecksum: candidate.checksum,
    });
    candidatePath = restoreFile.filePath;
    await verifyCandidateOwner(candidatePath, firebaseUid);
    await replaceDatabaseWithCandidate(candidatePath, {
      validateReplacement: async () => {
        try {
          initDatabase();
        } catch (err) {
          throw new RestoreFlowError(
            'migration_failed',
            err instanceof Error ? err.message : 'Backup migration failed.',
          );
        }
        if (!await userExists(firebaseUid)) {
          throw new RestoreFlowError(
            'uid_mismatch',
            'Restored data belongs to a different account.',
          );
        }
      },
    });
    await recoverMealReminderScheduleForUser(firebaseUid, 'database-restore');
    return { status: 'success', candidate };
  } catch (err) {
    return mapRestoreError(err, candidate, candidates);
  } finally {
    await cleanupDatabaseBackupFile(downloadPath);
    await cleanupDatabaseBackupFile(decryptedPath);
    if (candidatePath !== null) await cleanupDatabaseBackupFile(candidatePath);
  }
}
