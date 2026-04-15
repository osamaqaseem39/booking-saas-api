import { Controller, Get, Query } from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { TurfService } from './turf.service';

class GetVenueBySportQueryDto {
  @IsOptional()
  @IsUUID('4')
  branchId?: string;
}

@Controller('getvenue')
export class TurfController {
  constructor(private readonly turfService: TurfService) {}

  @Get('futsal')
  getFutsalVenues(@Query() query: GetVenueBySportQueryDto) {
    return this.turfService.listBySport('futsal', query.branchId);
  }

  @Get('cricket')
  getCricketVenues(@Query() query: GetVenueBySportQueryDto) {
    return this.turfService.listBySport('cricket', query.branchId);
  }
}
