import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateFlightTemplateDto {
  @IsString()
  @MinLength(1)
  airlineId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(12)
  flightNumber!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(3)
  @Matches(/^[A-Za-z]{3}$/)
  origin!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(3)
  @Matches(/^[A-Za-z]{3}$/)
  destination!: string;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(1440)
  durationMins!: number;
}
