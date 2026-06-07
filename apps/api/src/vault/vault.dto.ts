import {
  IsArray,
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
