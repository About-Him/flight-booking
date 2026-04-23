import { IsDateString, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class SearchFlightsDto {
  @IsIn(['one-way', 'round-trip'])
  type!: 'one-way' | 'round-trip';

  @IsString()
  @Length(3, 3)
  origin!: string;

  @IsString()
  @Length(3, 3)
  destination!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsDateString()
  returnDate?: string;
}
