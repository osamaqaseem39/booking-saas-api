import { Controller, Get } from '@nestjs/common';
import { ProductCatalogService } from './product-catalog.service';

@Controller('product-catalog')
export class ProductCatalogController {
  constructor(private readonly productCatalogService: ProductCatalogService) {}

  @Get()
  getCatalog() {
    return this.productCatalogService.getCatalog();
  }
}
