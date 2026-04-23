import { Controller, Get, Query } from '@nestjs/common';
import { AirportsService } from './airports.service';

@Controller('airports')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get('list')
  list() {
    return this.airportsService.list();
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.airportsService.search(q ?? '');
  }
}
