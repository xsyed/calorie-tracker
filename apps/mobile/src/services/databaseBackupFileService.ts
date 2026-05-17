import RNFS from 'react-native-fs';

import {
  closeDatabase,
  getDatabaseFilePath,
  initDatabase,
} from '../database/database';

const BACKUP_TEMP_DIR_NAME = 'calories-backups';
const SQLITE_MIME_TYPE = 'application/octet-stream';

export interface StagedDatabaseBackupFile {
  checksum: string;
  compressed: false;
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
}

export interface RestoreCandidateFile {
  checksum: string;
  compressed: false;
  filePath: string;
  sizeBytes: number;
}

export interface PrepareRestoreCandidateOptions {
  expectedChecksum?: string;
}

export interface ReplaceDatabaseOptions {
  validateReplacement?: () => Promise<void>;
}

export class DatabaseBackupFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseBackupFileError';
  }
}

function getBackupTempDir(): string {
  const basePath = RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath;
  return `${basePath}/${BACKUP_TEMP_DIR_NAME}`;
}

function createTempPath(prefix: string, extension: string): string {
  const safeRandom = Math.random().toString(36).slice(2);
  return `${getBackupTempDir()}/${prefix}-${Date.now()}-${safeRandom}.${extension}`;
}

function getBackupFileName(): string {
  return `calories-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
}

async function ensureBackupTempDir(): Promise<void> {
  await RNFS.mkdir(getBackupTempDir());
}

async function deleteIfExists(filePath: string | null): Promise<void> {
  if (filePath !== null && await RNFS.exists(filePath)) {
    await RNFS.unlink(filePath);
  }
}

async function getFileSize(filePath: string): Promise<number> {
  const stats = await RNFS.stat(filePath);
  const sizeBytes = Number(stats.size);
  if (!Number.isFinite(sizeBytes)) {
    throw new DatabaseBackupFileError('Backup file size is invalid');
  }
  return sizeBytes;
}

async function getFileMetadata(filePath: string): Promise<{
  checksum: string;
  sizeBytes: number;
}> {
  const [checksum, sizeBytes] = await Promise.all([
    RNFS.hash(filePath, 'sha256'),
    getFileSize(filePath),
  ]);
  return { checksum, sizeBytes };
}

async function checkpointDatabase(): Promise<void> {
  const db = initDatabase();
  await db.execute('PRAGMA wal_checkpoint(TRUNCATE)', []);
}

async function copyDatabaseSnapshot(destinationPath: string): Promise<void> {
  await checkpointDatabase();
  await RNFS.copyFile(getDatabaseFilePath(), destinationPath);
}

async function cleanupRestoreFiles(
  activeTempPath: string | null,
  rollbackPath: string | null,
): Promise<void> {
  await Promise.all([
    deleteIfExists(activeTempPath),
    deleteIfExists(rollbackPath),
  ]);
}

export async function cleanupDatabaseBackupFile(
  file: StagedDatabaseBackupFile | RestoreCandidateFile | string,
): Promise<void> {
  await deleteIfExists(typeof file === 'string' ? file : file.filePath);
}

export async function createRestoreDownloadFilePath(): Promise<string> {
  await ensureBackupTempDir();
  return createTempPath('restore-download', 'sqlite');
}

export async function createDatabaseBackupFile(): Promise<StagedDatabaseBackupFile> {
  await ensureBackupTempDir();
  const filePath = createTempPath('backup', 'sqlite');

  try {
    await copyDatabaseSnapshot(filePath);
    const metadata = await getFileMetadata(filePath);
    return {
      ...metadata,
      compressed: false,
      fileName: getBackupFileName(),
      filePath,
      mimeType: SQLITE_MIME_TYPE,
    };
  } catch (err) {
    await deleteIfExists(filePath);
    throw err;
  }
}

export async function withDatabaseBackupFile<T>(
  useFile: (file: StagedDatabaseBackupFile) => Promise<T>,
): Promise<T> {
  const file = await createDatabaseBackupFile();

  try {
    return await useFile(file);
  } finally {
    await cleanupDatabaseBackupFile(file);
  }
}

export async function prepareRestoreCandidateFile(
  sourcePath: string,
  options: PrepareRestoreCandidateOptions = {},
): Promise<RestoreCandidateFile> {
  await ensureBackupTempDir();
  const filePath = createTempPath('restore-candidate', 'sqlite');

  try {
    await RNFS.copyFile(sourcePath, filePath);
    const metadata = await getFileMetadata(filePath);
    if (
      options.expectedChecksum !== undefined &&
      metadata.checksum !== options.expectedChecksum
    ) {
      throw new DatabaseBackupFileError(
        `Restore candidate checksum mismatch (${metadata.checksum}/${options.expectedChecksum})`,
      );
    }
    return { ...metadata, compressed: false, filePath };
  } catch (err) {
    await deleteIfExists(filePath);
    throw err;
  }
}

export async function replaceDatabaseWithCandidate(
  candidatePath: string,
  options: ReplaceDatabaseOptions = {},
): Promise<void> {
  const databasePath = getDatabaseFilePath();
  const activeTempPath = createTempPath('active-replacement', 'sqlite');
  const rollbackPath = createTempPath('active-rollback', 'sqlite');

  await ensureBackupTempDir();
  await RNFS.copyFile(candidatePath, activeTempPath);
  await closeDatabase();

  let activeMoved = false;
  try {
    await RNFS.moveFile(databasePath, rollbackPath);
    activeMoved = true;
    await RNFS.moveFile(activeTempPath, databasePath);
    await options.validateReplacement?.();
    await deleteIfExists(rollbackPath);
  } catch (err) {
    await closeDatabase();
    if (activeMoved) {
      await deleteIfExists(databasePath);
      await RNFS.moveFile(rollbackPath, databasePath);
    }
    throw err;
  } finally {
    await cleanupRestoreFiles(activeTempPath, rollbackPath);
  }
}
