import { NativeModules, Platform } from 'react-native';

export interface EncryptedBackupManifest {
  backupId: string;
  createdTime: string;
  encryptedSizeBytes: number;
  firebaseUid: string;
  originalChecksum: string;
  originalFileName: string;
  originalSizeBytes: number;
  salt: string;
  version: 1;
  wrappedDataKey: string;
  wrapIv: string;
  contentIv: string;
}

export interface EncryptBackupFileOptions {
  backupId: string;
  createdTime: string;
  firebaseUid: string;
  inputPath: string;
  outputPath: string;
  originalChecksum: string;
  originalFileName: string;
  originalSizeBytes: number;
  password?: string;
}

interface BackupCryptoNativeModule {
  hasLocalBackupKey(): Promise<boolean>;
  encryptBackupFile(options: EncryptBackupFileOptions): Promise<EncryptedBackupManifest>;
  decryptBackupFile(
    inputPath: string,
    outputPath: string,
    password: string,
    manifest: EncryptedBackupManifest,
  ): Promise<void>;
}

const nativeBackupCrypto =
  NativeModules.BackupCrypto as BackupCryptoNativeModule | undefined;

export class BackupCryptoError extends Error {
  constructor(
    public readonly code: 'unsupported_platform' | 'password_required' | 'incorrect_password' | 'crypto_failed',
    message: string,
  ) {
    super(message);
    this.name = 'BackupCryptoError';
  }
}

function requireNativeBackupCrypto(): BackupCryptoNativeModule {
  if (Platform.OS !== 'android' || nativeBackupCrypto === undefined) {
    throw new BackupCryptoError(
      'unsupported_platform',
      'Backup encryption is unavailable on this platform.',
    );
  }
  return nativeBackupCrypto;
}

function mapNativeCryptoError(err: unknown): BackupCryptoError {
  if (
    err instanceof Error &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string'
  ) {
    const code = (err as Record<string, unknown>).code;
    if (code === 'BACKUP_PASSWORD_REQUIRED') {
      return new BackupCryptoError('password_required', 'Create a backup password first.');
    }
    if (code === 'BACKUP_INCORRECT_PASSWORD') {
      return new BackupCryptoError('incorrect_password', 'Incorrect backup password.');
    }
  }
  return new BackupCryptoError(
    'crypto_failed',
    err instanceof Error ? err.message : 'Backup encryption failed.',
  );
}

export async function hasLocalBackupKey(): Promise<boolean> {
  try {
    return await requireNativeBackupCrypto().hasLocalBackupKey();
  } catch (err) {
    if (err instanceof BackupCryptoError) throw err;
    throw mapNativeCryptoError(err);
  }
}

export async function encryptBackupFile(
  options: EncryptBackupFileOptions,
): Promise<EncryptedBackupManifest> {
  try {
    return await requireNativeBackupCrypto().encryptBackupFile(options);
  } catch (err) {
    if (err instanceof BackupCryptoError) throw err;
    throw mapNativeCryptoError(err);
  }
}

export async function decryptBackupFile(
  inputPath: string,
  outputPath: string,
  password: string,
  manifest: EncryptedBackupManifest,
): Promise<void> {
  try {
    await requireNativeBackupCrypto().decryptBackupFile(
      inputPath,
      outputPath,
      password,
      manifest,
    );
  } catch (err) {
    if (err instanceof BackupCryptoError) throw err;
    throw mapNativeCryptoError(err);
  }
}
