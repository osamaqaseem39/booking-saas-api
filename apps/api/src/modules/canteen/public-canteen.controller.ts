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
import { ConsumerAuthGuard } from '../iam/authz/consumer-auth.guard';
import { CanteenService } from './canteen.service';

@Controller('public/canteen')
@UseGuards(ConsumerAuthGuard)
export class PublicCanteenController {
  constructor(private readonly canteenService: CanteenService) {}

  private userId(req: Request): string {
    const id = (req as Request & { userId?: string }).userId?.trim();
    if (!id) throw new UnauthorizedException('Missing user');
    return id;
  }

  @Get('menu')
  menu(@Query('locationId') locationId: string) {
    return this.canteenService.getPublicMenu(locationId);
  }

  @Post('orders')
  createOrder(
    @Req() req: Request,
    @Body()
    dto: {
      locationId: string;
      bookingId?: string;
      pickupAt?: string;
      notes?: string;
      items: { itemId: string; quantity: number }[];
      payment?: { method?: string };
    },
  ) {
    const key = req.headers['idempotency-key'] as string | undefined;
    return this.canteenService.createOrder(this.userId(req), dto, key);
  }

  @Get('orders')
  listOrders(
    @Req() req: Request,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.canteenService.listOrders(this.userId(req), page, limit);
  }

  @Get('orders/:orderId')
  getOrder(
    @Req() req: Request,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.canteenService.getOrder(this.userId(req), orderId);
  }
}
