declare global {
  namespace Express {
    interface Request {
      auth?: {
        readonly uid: string;
      };
      parseRequest?: {
        readonly prompt: string;
        readonly deviceId: string;
      };
      backupUpload?: {
        readonly file: Buffer;
        readonly manifest: string;
      };
    }
  }
}

export {};
