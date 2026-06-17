import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
import { CurrentTenant } from '../../tenancy/tenant-context.decorator';
import type { TenantContext } from '../../tenancy/tenant-context.interface';
import { ConsumerAuthGuard } from '../iam/authz/consumer-auth.guard';
import { SupportService } from './support.service';

@Controller('support/tickets')
@UseGuards(ConsumerAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  private userId(req: Request): string {
    const id = (req as Request & { userId?: string }).userId?.trim();
    if (!id) throw new UnauthorizedException('Missing user');
    return id;
  }

  private tenantId(tenant: TenantContext): string {
    const id = tenant?.tenantId?.trim() ?? '';
    if (!isUUID(id, 4)) {
      throw new UnauthorizedException('Valid X-Tenant-Id required');
    }
    return id;
  }

  @Post()
  create(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
    @Body()
    dto: {
      category: string;
      subject: string;
      message: string;
      bookingId?: string;
      canteenOrderId?: string;
      tournamentRegistrationId?: string;
      priority?: string;
    },
  ) {
    return this.supportService.createTicket(
      this.userId(req),
      this.tenantId(tenant),
      dto,
    );
  }

  @Get()
  list(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.supportService.listTickets(this.userId(req), {
      status,
      page,
      limit,
    });
  }

  @Get(':ticketId')
  get(
    @Req() req: Request,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    return this.supportService.getTicket(this.userId(req), ticketId);
  }

  @Post(':ticketId/messages')
  addMessage(
    @Req() req: Request,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: { body: string },
  ) {
    return this.supportService.addMessage(
      this.userId(req),
      ticketId,
      dto.body,
    );
  }
}
