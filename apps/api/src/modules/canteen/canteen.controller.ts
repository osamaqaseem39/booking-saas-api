import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CanteenService } from './canteen.service';
import { CreateCanteenItemDto } from './dto/create-canteen-item.dto';
import { UpdateCanteenItemDto } from './dto/update-canteen-item.dto';

@ApiTags('canteen')
@Controller('canteen')
export class CanteenController {
  constructor(private readonly canteenService: CanteenService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new canteen item' })
  create(@Body() createCanteenItemDto: CreateCanteenItemDto) {
    return this.canteenService.create(createCanteenItemDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all canteen items' })
  @ApiQuery({ name: 'locationId', required: false })
  findAll(@Query('locationId') locationId?: string) {
    return this.canteenService.findAll(locationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a canteen item by ID' })
  findOne(@Param('id') id: string) {
    return this.canteenService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a canteen item' })
  update(@Param('id') id: string, @Body() updateCanteenItemDto: UpdateCanteenItemDto) {
    return this.canteenService.update(id, updateCanteenItemDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a canteen item' })
  remove(@Param('id') id: string) {
    return this.canteenService.remove(id);
  }
}
