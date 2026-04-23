import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsString, Matches, MinLength } from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  @MinLength(1)
  flightId!: string;

  /** Local departure time, 24h, e.g. `09:30` or `14:05` */
  @IsString()
  @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/, {
    message: 'departureTime must be HH:mm (24h)',
  })
  departureTime!: string;

  /** First operating date (YYYY-MM-DD or ISO datetime). */
  @IsDateString()
  scheduledDate!: string;

  @Type(() => Boolean)
  @IsBoolean()
  isDaily!: boolean;
}
