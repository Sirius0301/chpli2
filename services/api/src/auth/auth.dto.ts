import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EMAIL_PATTERN, PHONE_INPUT_PATTERN } from '@chpli2/shared';

export const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

export class RegisterBody {
  @ApiProperty({ type: 'string', example: 'sirius' })
  @IsString()
  @IsNotEmpty()
  @Matches(USERNAME_PATTERN, {
    message: 'username must be 3-32 chars of a-z A-Z 0-9 _ . -',
  })
  username!: string;

  @ApiProperty({ type: 'string', example: 'secret-password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ type: 'string', required: false, nullable: true, example: 'sirius@example.com' })
  @IsOptional()
  @IsString()
  @Matches(EMAIL_PATTERN, { message: 'invalid email' })
  email?: string;

  @ApiProperty({ type: 'string', required: false, nullable: true, example: '+8613800112233' })
  @IsOptional()
  @IsString()
  @Matches(PHONE_INPUT_PATTERN, { message: 'invalid phone' })
  phone?: string;
}

export class LoginBody {
  @ApiProperty({ type: 'string', example: 'sirius@example.com' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ type: 'string', example: 'secret-password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class SendCodeBody {
  @ApiProperty({ type: 'string', example: 'sirius@example.com' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;
}

export class LoginCodeBody {
  @ApiProperty({ type: 'string', example: 'sirius@example.com' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ type: 'string', example: '483920' })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}
