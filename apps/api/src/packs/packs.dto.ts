import { IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const MONEY = /^\d+(\.\d{1,6})?$/;

export class CreatePackDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @Matches(MONEY, { message: 'priceUsdc must be a positive amount' })
  priceUsdc!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  brandLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  tier?: string;

  /** Optional tier-to-weight map, e.g. { "chase": 1, "common": 20 }. */
  @IsOptional()
  @IsObject()
  weights?: Record<string, number>;
}

export class UpdatePackVisualDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  brandLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  tier?: string;
}

export class AddPoolItemDto {
  @IsString()
  vaultItemId!: string;

  @IsOptional()
  @IsString()
  tier?: string;
}

export class OpenPackDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientSeed?: string;
}

export class RevealDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientSeed?: string;
}
