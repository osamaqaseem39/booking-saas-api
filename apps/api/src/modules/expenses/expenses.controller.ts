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
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@UseGuards(RolesGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  list(
    @Req() req: Request,
    @Query('locationId') locationId?: string,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.expensesService.list(userId, locationId);
  }

  @Post()
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  create(@Req() req: Request, @Body() dto: CreateExpenseDto) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.expensesService.create(userId, dto);
  }

  @Patch(':id')
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  patch(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.expensesService.update(userId, id, dto);
  }

  @Delete(':id')
  @Roles('platform-owner', 'business-admin', 'location-admin', 'business-staff')
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    const userId = (req as Request & { userId?: string }).userId?.trim();
    if (!userId) throw new UnauthorizedException('Missing user');
    return this.expensesService.remove(userId, id);
  }
}
