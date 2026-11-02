import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorBody } from '@chpli2/shared';
import { errorCodeOf } from './http-error';

/**
 * Guarantees the unified error body shape `{ statusCode, message, errorCode }`
 * (ApiErrorBody) for every error thrown by the API.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const raw = (body as { message?: unknown }).message;
        message = Array.isArray(raw) ? raw.join('; ') : String(raw ?? exception.message);
      } else {
        message = exception.message;
      }
      errorCode =
        errorCodeOf(exception) ??
        (status === HttpStatus.BAD_REQUEST ? 'VALIDATION_ERROR' : 'HTTP_ERROR');
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const bodyJson: ApiErrorBody = { statusCode: status, message, errorCode };
    response.status(status).json(bodyJson);
  }
}
