import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../iam/authz/roles.decorator';
import { RolesGuard } from '../iam/authz/roles.guard';
import { CreateBusinessLocationDto } from './dto/create-business-location.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { ListLocationCitiesDto } from './dto/list-location-cities.dto';
import { SearchLocationsQueryDto } from './dto/search-locations-query.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateBusinessLocationDto } from './dto/update-business-location.dto';
import { BusinessesService } from './businesses.service';

@Controller('businesses')
@UseGuards(RolesGuard)
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  @Roles('platform-owner', 'business-admin')
  async list(@Req() req: Request) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return this.businessesService.listForRequester(userId);
  }

  @Post('onboard')
  @Roles('platform-owner')
  async onboard(@Body() dto: CreateBusinessDto) {
    return this.businessesService.onboardBusiness(dto);
  }

  /** No auth required; returns all locations for end-user discovery (see listAllLocationsPublic). */
  @Get('locations')
  async listLocations() {
    return this.businessesService.listAllLocationsPublic();
  }

  @Get('locations/cities')
  async listLocationCities(@Query() dto: ListLocationCitiesDto) {
    return this.businessesService.listLocationCitiesPublic(dto);
  }

  /** No auth; distinct location types that have at least one active location. */
  @Get('locations/location-types')
  async listLocationTypes() {
    return this.businessesService.listLocationTypesPublic();
  }

  /** Query filters: cities (comma-separated), locationType, bookingStatus=unbooked + date + startTime + endTime. */
  @Get('locations/search')
  async searchLocations(@Query() dto: SearchLocationsQueryDto) {
    return this.businessesService.searchLocationsPublic(dto);
  }

  @Post('locations')
  @Roles('platform-owner', 'business-admin')
  async createLocation(
    @Req() req: Request,
    @Body() dto: CreateBusinessLocationDto,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return this.businessesService.createLocation(userId, dto);
  }

  @Patch('locations/:locationId')
  @Roles('platform-owner', 'business-admin')
  async updateLocation(
    @Req() req: Request,
    @Param('locationId') locationId: string,
    @Body() dto: UpdateBusinessLocationDto,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return this.businessesService.updateLocation(userId, locationId, dto);
  }

  @Patch(':businessId')
  @Roles('platform-owner', 'business-admin')
  async updateBusiness(
    @Req() req: Request,
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return this.businessesService.updateBusiness(userId, businessId, dto);
  }

  @Delete('locations/:locationId')
  @Roles('platform-owner', 'business-admin')
  async deleteLocation(
    @Req() req: Request,
    @Param('locationId') locationId: string,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return this.businessesService.deleteLocation(userId, locationId);
  }

  @Delete(':businessId')
  @Roles('platform-owner', 'business-admin')
  async deleteBusiness(
    @Req() req: Request,
    @Param('businessId') businessId: string,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return this.businessesService.deleteBusiness(userId, businessId);
  }
}
