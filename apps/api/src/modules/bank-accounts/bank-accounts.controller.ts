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
import { Permissions } from '../iam/authz/permissions.decorator';
import { BankAccountsService } from './bank-accounts.service';

@Controller('bank-accounts')
@UseGuards(RolesGuard)
export class BankAccountsController {
  constructor(private readonly service: BankAccountsService) {}

  private uid(req: Request): string {
    const id = (req as Request & { userId?: string }).userId?.trim();
    if (!id) throw new UnauthorizedException('Missing user');
    return id;
  }

  @Get()
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  @Permissions('payments:view')
  list(@Req() req: Request, @Query('locationId') locationId?: string) {
    return this.service.list(this.uid(req), locationId);
  }

  @Post()
  @Roles(
    'platform-owner',
    'business-admin',
    'location-admin',
    'business-staff',
  )
  @Permissions('payments:edit')
  create(
    @Req() req: Request,
    @Body()
    dto: {
      locationId: string;
      title: string;
      bankName: string;
      accountNumber: string;
      accountHolder?: string;
      isDefault?: boolean;
    },
  ) {
    return this.service.create(this.uid(req), dto);
  }

  @Patch(':id')
  @Roles(
    'platform-owner',
    'business-admin',
    'location-admin',
    'business-staff',
  )
  @Permissions('payments:edit')
  patch(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      title?: string;
      bankName?: string;
      accountNumber?: string;
      accountHolder?: string;
      isDefault?: boolean;
      status?: string;
    },
  ) {
    return this.service.update(this.uid(req), id, dto);
  }

  @Delete(':id')
  @Roles(
    'platform-owner',
    'business-admin',
    'location-admin',
    'business-staff',
  )
  @Permissions('payments:edit')
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(this.uid(req), id);
  }
}
