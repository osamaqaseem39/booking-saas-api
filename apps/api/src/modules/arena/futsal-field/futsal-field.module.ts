import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../../businesses/businesses.module';
import { IamModule } from '../../iam/iam.module';
import { FutsalFieldController } from './futsal-field.controller';
import { FutsalFieldService } from './futsal-field.service';
import { FutsalField } from './entities/futsal-field.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FutsalField]),
    IamModule,
    BusinessesModule,
  ],
  controllers: [FutsalFieldController],
  providers: [FutsalFieldService],
  exports: [FutsalFieldService],
})
export class FutsalFieldModule {}
