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
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Roles } from '../iam/authz/roles.decorator';
import { RolesGuard } from '../iam/authz/roles.guard';
import { CreateBusinessLocationDto } from './dto/create-business-location.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { ListBusinessLocationsQueryDto } from './dto/list-business-locations-query.dto';
import { ListLocationCitiesDto } from './dto/list-location-cities.dto';
import { SearchLocationsQueryDto } from './dto/search-locations-query.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateBusinessLocationDto } from './dto/update-business-location.dto';
import { BusinessesService } from './businesses.service';

@Controller('businesses')
@UseGuards(RolesGuard)
export class BusinessesController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly jwtService: JwtService,
  ) {}

  @Get()
  @Roles('platform-owner', 'business-admin', 'location-admin')
  async list(@Req() req: Request) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return this.businessesService.listForRequester(userId);
  }

  @Get('dashboard')
  @Roles('platform-owner', 'business-admin', 'location-admin')
  async dashboard(
    @Req() req: Request,
    @Query('period') period?: string,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return this.businessesService.getDashboardView(userId, period);
  }

  @Get('locations/:locationId/dashboard')
  @Roles('platform-owner', 'business-admin', 'location-admin')
  async dashboardForLocation(
    @Req() req: Request,
    @Param('locationId') locationId: string,
    @Query('period') period?: string,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return this.businessesService.getDashboardViewForLocation(
      userId,
      locationId,
      period,
    );
  }

  @Post('onboard')
  @Roles('platform-owner')
  async onboard(@Body() dto: CreateBusinessDto) {
    return this.businessesService.onboardBusiness(dto);
  }

  @Get('locations')
  async listLocations(
    @Req() req: Request,
    @Query() query: ListBusinessLocationsQueryDto,
  ) {
    const name = query.name?.trim() || undefined;
    const userId = await this.tryAccessTokenUserId(req);
    if (
      userId &&
      (await this.businessesService.hasConsoleLocationListScope(userId))
    ) {
      const tenantHeader = req.header('x-tenant-id')?.trim() || null;
      return this.businessesService.listLocationsForConsole(
        userId,
        tenantHeader,
        name,
      );
    }
    const all = await this.businessesService.listAllLocationsPublic(name);
    return all.map((r) => this.businessesService.toVenueMapMarker(r));
  }

  /**
   * Minimal location list for app boot / typeahead: only `id` and `name`.
   * Same auth and `X-Tenant-Id` rules as `GET /businesses/locations`.
   * Optional query `name` — case-insensitive substring filter.
   */
  @Get('locations/name-ids')
  async listLocationNameIds(
    @Req() req: Request,
    @Query() query: ListBusinessLocationsQueryDto,
  ) {
    const name = query.name?.trim() || undefined;
    const userId = await this.tryAccessTokenUserId(req);
    if (
      userId &&
      (await this.businessesService.hasConsoleLocationListScope(userId))
    ) {
      const tenantHeader = req.header('x-tenant-id')?.trim() || null;
      return this.businessesService.listLocationNameIdsForConsole(
        userId,
        tenantHeader,
        name,
      );
    }
    return this.businessesService.listLocationNameIdsPublic(name);
  }

  @Get('locations/cities')
  async listLocationCities(@Query() dto: ListLocationCitiesDto) {
    return this.businessesService.listLocationCitiesPublic(dto);
  }

  @Get('locations/location-types')
  async listLocationTypes() {
    return this.businessesService.listLocationTypesPublic();
  }

  @Get('locations/search')
  async searchLocations(@Query() dto: SearchLocationsQueryDto) {
    return this.businessesService.searchLocationsPublic(dto);
  }

  @Get('locations/facility-counts')
  async listLocationsWithFacilityCounts(@Req() req: Request) {
    const userId = await this.tryAccessTokenUserId(req);
    if (
      userId &&
      (await this.businessesService.hasConsoleLocationListScope(userId))
    ) {
      const tenantHeader = req.header('x-tenant-id')?.trim() || null;
      const locations = await this.businessesService.listLocationsForConsole(
        userId,
        tenantHeader,
      );
      return { locations };
    }
    return this.businessesService.listLocationsWithFacilityCountsPublic();
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
  @Roles('platform-owner', 'business-admin', 'location-admin')
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

  /** Optional bearer (same rules as {@link RolesGuard}); invalid / missing token → null. */
  private async tryAccessTokenUserId(req: Request): Promise<string | null> {
    const authHeader = req.header('Authorization')?.trim();
    if (!authHeader?.startsWith('Bearer ')) return null;
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        userId?: string;
        typ?: string;
      }>(authHeader.slice('Bearer '.length).trim());
      if (payload.typ === 'refresh') return null;
      const id = (payload.sub ?? payload.userId ?? '').trim();
      return id || null;
    } catch {
      return null;
    }
  }
}
