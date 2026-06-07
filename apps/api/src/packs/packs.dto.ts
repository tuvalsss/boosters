import { IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const MONEY = /^\d+(\.\d{1,6})?$/;

export class CreatePackDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @Matches(MONEY, { message: 'priceUsdc must be a positive amount' })
  priceUsdc!: string;

  /** Optional tier → weight map, e.g. { "chase": 1, "common": 20 }. */
  @IsOptional()
  @IsObject()
  weights?: Record<string, number>;
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
