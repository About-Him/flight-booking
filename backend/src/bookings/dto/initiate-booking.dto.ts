import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class InitiateBookingDto {
  @IsString()
  instanceId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  seatIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  passengerNames!: string[];
}
