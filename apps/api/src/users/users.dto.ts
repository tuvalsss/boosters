import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AccountHold, KycStatus, UserRole, type User } from '@boosters/db';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;
}

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

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

export class SetRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}

export class SetKycDto {
  @IsEnum(KycStatus)
  status!: KycStatus;
}

export class SetHoldDto {
  @IsEnum(AccountHold)
  hold!: AccountHold;
}

/** Strip internal fields before returning a user over the API. */
export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    walletAddress: u.walletAddress,
    role: u.role,
    kycStatus: u.kycStatus,
    hold: u.hold,
    reputationScore: u.reputationScore,
    createdAt: u.createdAt,
  };
}
