import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CardCategory, Grader } from '@boosters/db';

/** What the user declares they are shipping in (pre-authentication). */
export class CreateSubmissionDto {
  @IsEnum(CardCategory)
  category!: CardCategory;

  @IsEnum(Grader)
  grader!: Grader;

  @IsString()
  @MaxLength(120)
  cardName!: string;

  @IsOptional()
  @IsString()
  setName?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  certNumber?: string;

  @IsOptional()
  @IsString()
  declaredGrade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ShipDto {
  @IsString()
  @MaxLength(80)
  trackingNumber!: string;
}

/** Card details confirmed by ops on physical receipt (declared vs actual). */
export class ReceiveDto {
  @IsEnum(CardCategory)
  category!: CardCategory;

  @IsEnum(Grader)
  grader!: Grader;

  @IsString()
  @MaxLength(120)
  cardName!: string;

  @IsOptional()
  @IsString()
  setName?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  certNumber?: string;
}

export class GradeSubmissionDto {
  @IsString()
  @MaxLength(40)
  grade!: string;
}

export class PhotosDto {
  @IsArray()
  @IsString({ each: true })
  urls!: string[];
}

export class RejectDto {
  @IsString()
  @MaxLength(300)
  reason!: string;
}
