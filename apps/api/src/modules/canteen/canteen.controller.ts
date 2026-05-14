import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { CreateCanteenItemDto } from './dto/create-canteen-item.dto';
import { UpdateCanteenItemDto } from './dto/update-canteen-item.dto';
import { CanteenService } from './canteen.service';

@Controller('canteen')
@UseGuards(RolesGuard)
export class CanteenController {
  constructor(private readonly canteenService: CanteenService) {}

  @Get()
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  list(
    @Req() req: Request,
    @Query('locationId') locationId?: string,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.canteenService.list(userId, locationId);
  }

  @Post()
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  create(@Req() req: Request, @Body() dto: CreateCanteenItemDto) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.canteenService.create(userId, dto);
  }

  @Patch(':id')
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  patch(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCanteenItemDto,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.canteenService.update(userId, id, dto);
  }

  @Delete(':id')
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.canteenService.remove(userId, id);
  }
}
