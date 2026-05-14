import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessLocation } from '../businesses/entities/business-location.entity';
import { BusinessMembership } from '../businesses/entities/business-membership.entity';
import { IamModule } from '../iam/iam.module';
import { Expense } from './entities/expense.entity';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, BusinessLocation, BusinessMembership]),
    IamModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
