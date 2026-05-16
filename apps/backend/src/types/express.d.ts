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
    }
  }
}

export {};
