import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CardCategory, Grader } from '@boosters/db';

export class PhotoDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  kind?: string;
}

export class CreateIntakeDto {
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
  grade?: string;

  @IsOptional()
  attributes?: Record<string, unknown>;

  /** Owner of the vault item. Defaults to the acting ops user (first-party). */
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoDto)
  photos?: PhotoDto[];
}

export class SetGradeDto {
  @IsString()
  @MaxLength(40)
  grade!: string;
}

export class ManagedCategoryDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsEnum(CardCategory)
  legacyCategory!: CardCategory;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  accentColor?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCardDto {
  @IsOptional()
  @IsEnum(CardCategory)
  category?: CardCategory;

  @IsOptional()
  @IsEnum(Grader)
  grader?: Grader;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cardName?: string;

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
  grade?: string;

  @IsOptional()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoDto)
  photos?: PhotoDto[];
}
