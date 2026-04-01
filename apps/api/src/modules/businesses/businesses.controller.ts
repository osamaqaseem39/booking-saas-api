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

  @Get('locations')
  @Roles('platform-owner', 'business-admin', 'customer-end-user')
  async listLocations() {
    return this.businessesService.listAllLocationsPublic();
  }

  @Get('locations/cities')
  @Roles('platform-owner', 'business-admin', 'customer-end-user')
  async listLocationCities(@Query() dto: ListLocationCitiesDto) {
    return this.businessesService.listLocationCitiesPublic(dto);
  }

  @Get('locations/location-types')
  @Roles('platform-owner', 'business-admin', 'customer-end-user')
  async listLocationTypes() {
    return this.businessesService.listLocationTypesPublic();
  }

  @Get('locations/search')
  @Roles('platform-owner', 'business-admin', 'customer-end-user')
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
