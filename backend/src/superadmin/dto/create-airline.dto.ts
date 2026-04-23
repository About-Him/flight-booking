import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAirlineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(3)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  /** Login for the first senior associate on this airline. */
  @IsEmail()
  seniorAssociateEmail!: string;

  @IsString()
  @MinLength(8)
  seniorAssociatePassword!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  seniorAssociateName?: string;
}
