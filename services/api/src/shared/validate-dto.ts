import {
  Body,
  Query,
  ValidationPipe,
  type Type,
} from '@nestjs/common';

// The toolchain (esbuild-based: tsup/tsx/vitest) does not emit
// emitDecoratorMetadata, so Nest cannot infer DTO types from Reflect
// metadata. These param decorators bind an explicit expectedType instead,
// keeping full class-validator behavior (whitelist, transform, nested DTOs).
function dtoPipe(type: Type) {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    expectedType: type,
  });
}

/** @Body() with explicit DTO type validation. */
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export const ValidatedBody = (type: Type): ReturnType<typeof Body> =>
  Body(dtoPipe(type)) as ReturnType<typeof Body>;

/** @Query() with explicit DTO type validation. */
export const ValidatedQuery = (type: Type): ReturnType<typeof Query> =>
  Query(dtoPipe(type)) as ReturnType<typeof Query>;
