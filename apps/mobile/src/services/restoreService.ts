import { open } from '@op-engineering/op-sqlite';

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
  downloadGoogleDriveBackup,
  GoogleDriveBackupError,
  listGoogleDriveBackups,
} from './googleDriveBackupClient';
import type { DriveBackupFile } from './googleDriveBackupClient';
import { recoverMealReminderScheduleForUser } from './reminderRecoveryService';

export type RestoreErrorCode =
  | 'checksum_unavailable'
  | 'checksum_mismatch'
  | 'download_failed'
  | 'migration_failed'
  | 'network_error'
  | 'permission_denied'
  | 'quota_exceeded'
  | 'reauth_required'
  | 'uid_mismatch'
  | 'unsupported_platform'
  | 'restore_failed';

export interface RestoreBackupCandidate {
  checksum: string | null;
  createdTime: string;
  fileId: string;
  firebaseUid: string | null;
  modifiedTime: string;
  name: string;
  sizeBytes: number | null;
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

function toCandidate(file: DriveBackupFile): RestoreBackupCandidate {
  return {
    checksum: file.checksum,
    createdTime: file.createdTime,
    fileId: file.id,
    firebaseUid: file.firebaseUid,
    modifiedTime: file.modifiedTime,
    name: file.name,
    sizeBytes: file.sizeBytes,
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

function mapDriveRestoreError(err: GoogleDriveBackupError): RestoreBackupFailure {
  if (err.code === 'drive_unavailable') {
    return {
      status: 'error',
      code: 'unsupported_platform',
      message: 'Restore is coming soon on this platform.',
      nextCandidate: null,
    };
  }
  if (err.code === 'reauth_required') {
    return {
      status: 'error',
      code: 'reauth_required',
      message: 'Google Drive access required. Please sign in again.',
      nextCandidate: null,
    };
  }
  if (err.code === 'permission_denied') {
    return {
      status: 'error',
      code: 'permission_denied',
      message: 'Google Drive appData access is not configured or was denied.',
      nextCandidate: null,
    };
  }
  if (err.code === 'quota_exceeded') {
    return {
      status: 'error',
      code: 'quota_exceeded',
      message: 'Google Drive AppData quota exceeded.',
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

  if (err instanceof GoogleDriveBackupError) {
    return { ...mapDriveRestoreError(err), nextCandidate };
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
        ? 'Backup file is corrupted.'
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
  const candidates = sortNewestFirst(
    (await listGoogleDriveBackups()).map(toCandidate),
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
  let candidatePath: string | null = null;

  try {
    await downloadGoogleDriveBackup(candidate.fileId, downloadPath);
    const restoreFile = await prepareRestoreCandidateFile(downloadPath, {
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
    if (candidatePath !== null) await cleanupDatabaseBackupFile(candidatePath);
  }
}
