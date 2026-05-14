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
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  list(
    @Req() req: Request,
    @Query('locationId') locationId?: string,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.inventoryService.list(userId, locationId);
  }

  @Post()
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  create(@Req() req: Request, @Body() dto: CreateAssetDto) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.inventoryService.create(userId, dto);
  }

  @Patch(':id')
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  patch(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.inventoryService.update(userId, id, dto);
  }

  @Delete(':id')
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.inventoryService.remove(userId, id);
  }
}
