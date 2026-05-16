export class HttpError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message?: string,
    public readonly reason?: string,
  ) {
    super(message);
  }
}
