import { Injectable, Logger } from '@nestjs/common';
import type { IdentifierType } from '@chpli2/shared';

/**
 * Pluggable delivery channel for login verification codes (M0 增强, D7/H5).
 * Only the `log` transport exists today: codes go to the server log and are
 * also surfaced as `devCode` in the send response (never in production).
 * A real SMTP/SMS implementation plugs in behind the same interface.
 */
export interface CodeDelivery {
  /** True when this transport surfaces codes back via the API (dev only). */
  readonly exposesCode: boolean;
  send(channel: IdentifierType, destination: string, code: string): Promise<void>;
}

export const CODE_DELIVERY = 'CODE_DELIVERY';

@Injectable()
export class LogCodeDelivery implements CodeDelivery {
  readonly exposesCode = true;
  private readonly logger = new Logger(LogCodeDelivery.name);

  async send(channel: IdentifierType, destination: string, code: string): Promise<void> {
    this.logger.log(`login code for ${channel}:${destination}: ${code}`);
  }
}

/** Resolves the configured transport; unknown values fall back to `log` with a warning. */
export function codeDeliveryFromEnv(): CodeDelivery {
  const transport = process.env.AUTH_CODE_TRANSPORT ?? 'log';
  if (transport !== 'log') {
    new Logger('CodeDelivery').warn(
      `AUTH_CODE_TRANSPORT=${transport} has no implementation yet; falling back to 'log' (codes are printed to the server log)`,
    );
  }
  return new LogCodeDelivery();
}
