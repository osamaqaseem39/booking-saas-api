import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RolesGuard } from '../iam/authz/roles.guard';
import { Roles } from '../iam/authz/roles.decorator';
import { SYSTEM_ROLES } from '../iam/iam.constants';
import { IamService } from '../iam/iam.service';
import { BookingsService } from './bookings.service';

/** Profile / orders: list bookings for a user (cross-tenant). */
@Controller('PreviousBookings')
@UseGuards(RolesGuard)
export class PreviousBookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly iamService: IamService,
  ) {}

  private requesterUserId(req: Request): string {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) {
      throw new UnauthorizedException('Missing authentication');
    }
    return userId;
  }

  @Get(':userId')
  @Roles(...SYSTEM_ROLES)
  async previousBookings(
    @Req() req: Request,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    const requesterId = this.requesterUserId(req);
    const isStaff = await this.iamService.hasAnyRole(requesterId, [
      'platform-owner',
      'business-admin',
      'business-staff',
    ]);
    if (!isStaff && userId !== requesterId) {
      throw new ForbiddenException('You can only load your own bookings');
    }
    return this.bookingsService.listByUserForProfile(userId);
  }
}
