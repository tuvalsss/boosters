import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Decimal money string with up to 6 fractional digits, > 0 validated in service. */
const MONEY = /^\d+(\.\d{1,6})?$/;

export class CreateListingDto {
  @IsString()
  vaultItemId!: string;

  @Matches(MONEY, { message: 'priceUsdc must be a positive amount with ≤ 6 decimals' })
  priceUsdc!: string;
}

export class BuyDto {
  /** Caller-supplied idempotency key so retries never double-charge. */
  @IsString()
  idempotencyKey!: string;
}

export class CreditBalanceDto {
  @IsString()
  userId!: string;

  @Matches(MONEY, { message: 'amountUsdc must be a positive amount with ≤ 6 decimals' })
  amountUsdc!: string;
}

export class BrowseQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}
