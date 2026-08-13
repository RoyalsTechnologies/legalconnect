export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, message, 'BAD_REQUEST', details);

export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, message, 'UNAUTHORIZED');

export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError(403, message, 'FORBIDDEN');

export const notFound = (message = 'Resource not found') => new AppError(404, message, 'NOT_FOUND');

export const conflict = (message: string) => new AppError(409, message, 'CONFLICT');

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, message, 'UNPROCESSABLE_ENTITY', details);

export const serviceUnavailable = (message: string) =>
  new AppError(503, message, 'SERVICE_UNAVAILABLE');
