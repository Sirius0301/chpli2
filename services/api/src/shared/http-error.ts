import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * A domain-level 400 carrying a stable machine-readable errorCode
 * (see ERROR_CODES in @chpli2/shared).
 */
export class DomainException extends BadRequestException {
  readonly errorCode: string;

  constructor(errorCode: string, message: string) {
    super(message);
    this.name = 'DomainException';
    this.errorCode = errorCode;
  }
}

/** A 404 carrying a stable machine-readable errorCode. */
export function notFoundException(errorCode: string, message: string) {
  const exception = new NotFoundException(message);
  (exception as unknown as { errorCode: string }).errorCode = errorCode;
  return exception;
}

/** A 409 carrying a stable machine-readable errorCode. */
export function conflictException(errorCode: string, message: string) {
  const exception = new ConflictException(message);
  (exception as unknown as { errorCode: string }).errorCode = errorCode;
  return exception;
}

/** A 422 carrying a stable machine-readable errorCode. */
export function unprocessableException(errorCode: string, message: string) {
  const exception = new UnprocessableEntityException(message);
  (exception as unknown as { errorCode: string }).errorCode = errorCode;
  return exception;
}

/** Reads the errorCode carried by an HttpException, if any. */
export function errorCodeOf(exception: unknown): string | undefined {
  return (exception as { errorCode?: string } | null | undefined)?.errorCode;
}
