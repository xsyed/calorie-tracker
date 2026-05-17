import { access, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import busboy from "busboy";
import type { FileInfo } from "busboy";
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";

import { type BackendConfig } from "../config.js";
import { createFirebaseAuthVerifier } from "../firebaseAuth.js";
import { HttpError } from "../httpError.js";
import { logInfo } from "../logger.js";
import { requireFirebaseAuth } from "../middleware/auth.js";

const BACKUP_ROOT = "/data/backups";
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const MAX_BACKUP_COUNT = 5;
const MANIFEST_FILE = "manifest.json";
const BACKUP_FILE = "backup.enc";
const TRAILING_CRLF_BYTES = 2;

function sanitizeBackupId(id: string): string {
  const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (sanitized === "" || sanitized !== id) {
    throw new HttpError(400, "invalid_backup_id", "Backup ID contains invalid characters.");
  }
  return sanitized;
}

function takeHeaders(req: Request): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

function parseBackupUpload(req: Request, _res: Response, next: NextFunction): void {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    next(new HttpError(400, "invalid_content_type", "Expected multipart/form-data."));
    return;
  }

  const bb = busboy({
    headers: takeHeaders(req),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 2, fields: 1 },
  });

  const fileChunks: Buffer[] = [];
  let manifest: string | undefined;
  let fileTooLarge = false;
  let closed = false;

  bb.on("file", (_name: string, stream: NodeJS.ReadableStream, _info: FileInfo) => {
    stream.on("limit", () => { fileTooLarge = true; });
    stream.on("data", (chunk: Buffer) => { fileChunks.push(chunk); });
    stream.on("error", (err: Error) => {
      if (!closed) {
        closed = true;
        next(new HttpError(400, "upload_error", err.message));
      }
    });
  });

  bb.on("field", (name: string, value: string) => {
    if (name === "manifest") manifest = value;
  });

  bb.on("close", () => {
    if (closed) return;
    closed = true;
    if (fileChunks.length === 0 || manifest === undefined) {
      next(new HttpError(400, "missing_fields", "File and manifest are required."));
      return;
    }
    if (fileTooLarge) {
      next(new HttpError(413, "backup_too_large", "Backup file is too large."));
      return;
    }
    req.backupUpload = { file: Buffer.concat(fileChunks), manifest };
    next();
  });

  bb.on("error", (err: Error) => {
    if (!closed) {
      closed = true;
      next(new HttpError(400, "upload_error", err.message));
    }
  });

  req.pipe(bb);
}

function stripMultipartTrailingCrlf(file: Buffer, expectedSize: number): Buffer {
  if (
    file.length === expectedSize + TRAILING_CRLF_BYTES &&
    file[file.length - 2] === 13 &&
    file[file.length - 1] === 10
  ) {
    return file.subarray(0, expectedSize);
  }
  return file;
}

async function enforceRetention(uid: string, maxCount: number): Promise<void> {
  const userDir = join(BACKUP_ROOT, uid);
  let entries;
  try {
    entries = await readdir(userDir, { withFileTypes: true });
  } catch {
    return;
  }

  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length <= maxCount) return;

  const withTimes: { name: string; time: number }[] = [];
  for (const dir of dirs) {
    try {
      const raw = await readFile(join(userDir, dir.name, MANIFEST_FILE), "utf-8");
      const manifest = JSON.parse(raw) as { createdTime?: string };
      const t = manifest.createdTime !== undefined && typeof manifest.createdTime === "string"
        ? Date.parse(manifest.createdTime) : 0;
      withTimes.push({ name: dir.name, time: Number.isFinite(t) ? t : 0 });
    } catch {
      withTimes.push({ name: dir.name, time: 0 });
    }
  }

  withTimes.sort((a, b) => a.time - b.time);
  const toDelete = withTimes.slice(0, withTimes.length - maxCount);

  await Promise.all(
    toDelete.map((d) => rm(join(userDir, d.name), { recursive: true, force: true })),
  );
}

export function createBackupRouter(config: BackendConfig): Router {
  const router = Router();
  const authVerifier = createFirebaseAuthVerifier(config);

  router.use(requireFirebaseAuth(authVerifier));

  router.get("/list", async (req, res, next) => {
    try {
      const uid = req.auth?.uid;
      if (uid === undefined) return;

      const userDir = join(BACKUP_ROOT, uid);
      try {
        await access(userDir);
      } catch {
        res.json({ backups: [] });
        return;
      }

      const backups: { id: string; manifest: unknown; storedSizeBytes: number }[] = [];
      const entries = await readdir(userDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const raw = await readFile(join(userDir, entry.name, MANIFEST_FILE), "utf-8");
          const backupStats = await stat(join(userDir, entry.name, BACKUP_FILE));
          backups.push({
            id: entry.name,
            manifest: JSON.parse(raw),
            storedSizeBytes: backupStats.size,
          });
        } catch {
          // skip corrupted/incomplete backups
        }
      }

      res.json({ backups });
    } catch (err) {
      next(err);
    }
  });

  router.post("/upload", parseBackupUpload, async (req, res, next) => {
    try {
      const uid = req.auth?.uid;
      if (uid === undefined) return;
      const upload = req.backupUpload;
      if (upload === undefined) return;

      const manifest = JSON.parse(upload.manifest) as {
        backupId?: string;
        encryptedSizeBytes?: number;
      };
      const rawBackupId = typeof manifest.backupId === "string" ? manifest.backupId : "";
      const backupId = sanitizeBackupId(rawBackupId);
      if (backupId === "") {
        next(new HttpError(400, "invalid_manifest", "Manifest must include backupId."));
        return;
      }
      const backupFile = typeof manifest.encryptedSizeBytes === "number"
        ? stripMultipartTrailingCrlf(upload.file, manifest.encryptedSizeBytes)
        : upload.file;
      if (
        typeof manifest.encryptedSizeBytes !== "number" ||
        backupFile.length !== manifest.encryptedSizeBytes
      ) {
        next(new HttpError(400, "invalid_manifest", "Manifest encrypted size does not match file."));
        return;
      }

      const backupDir = join(BACKUP_ROOT, uid, backupId);
      await mkdir(backupDir, { recursive: true });

      await Promise.all([
        writeFile(join(backupDir, BACKUP_FILE), backupFile),
        writeFile(join(backupDir, MANIFEST_FILE), upload.manifest, "utf-8"),
      ]);

      try {
        await enforceRetention(uid, MAX_BACKUP_COUNT);
      } catch {
        // retention is best-effort
      }

      logInfo("backup_uploaded", { uid, backupId, size: backupFile.length });

      res.json({ status: "ok", backupId, storedSizeBytes: backupFile.length });
    } catch (err) {
      next(err);
    }
  });

  router.get("/download/:backupId", async (req, res, next) => {
    try {
      const uid = req.auth?.uid;
      if (uid === undefined) return;

      const backupId = sanitizeBackupId(req.params.backupId);
      const filePath = join(BACKUP_ROOT, uid, backupId, BACKUP_FILE);

      try {
        await access(filePath);
      } catch {
        next(new HttpError(404, "not_found", "Backup not found."));
        return;
      }

      res.sendFile(filePath, {
        headers: { "Content-Type": "application/octet-stream" },
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:backupId", async (req, res, next) => {
    try {
      const uid = req.auth?.uid;
      if (uid === undefined) return;

      const backupId = sanitizeBackupId(req.params.backupId);
      const backupDir = join(BACKUP_ROOT, uid, backupId);

      await rm(backupDir, { recursive: true, force: true });

      res.json({ status: "ok" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
