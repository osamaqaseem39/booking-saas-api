import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../iam/authz/roles.decorator';
import { RolesGuard } from '../iam/authz/roles.guard';
import { CreateBusinessLocationDto } from './dto/create-business-location.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { BusinessesService } from './businesses.service';

@Controller('businesses')
@UseGuards(RolesGuard)
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  @Roles('platform-owner', 'business-admin')
  async list(@Req() req: Request) {
    const userId = req.header('x-user-id')?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    return this.businessesService.listForRequester(userId);
  }

  @Post('onboard')
  @Roles('platform-owner')
  async onboard(@Body() dto: CreateBusinessDto) {
    return this.businessesService.onboardBusiness(dto);
  }

  @Get('locations')
  @Roles('platform-owner', 'business-admin')
  async listLocations(@Req() req: Request) {
    const userId = req.header('x-user-id')?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    return this.businessesService.listLocationsForRequester(userId);
  }

  @Post('locations')
  @Roles('platform-owner', 'business-admin')
  async createLocation(
    @Req() req: Request,
    @Body() dto: CreateBusinessLocationDto,
  ) {
    const userId = req.header('x-user-id')?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    return this.businessesService.createLocation(userId, dto);
  }
}
