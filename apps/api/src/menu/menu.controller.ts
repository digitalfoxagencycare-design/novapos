import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { MenuService } from './menu.service';
import { RequirePermissions } from '../auth/guards';

class CreateItemDto {
  @IsString() name!: string;
  @IsUUID() categoryId!: string;
  @IsInt() @Min(0) priceMinor!: number;
  @IsString() taxSlabId!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() hsnSac?: string;
  @IsOptional() @IsUUID() stationId?: string;
  @IsOptional() @IsString() description?: string;
}

@ApiTags('menu')
@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get('snapshot')
  @RequirePermissions('menu:read')
  @ApiOperation({
    summary: 'Full menu snapshot for offline caching',
    description: 'One call returns everything a POS device needs to take and price orders with no network.',
  })
  snapshot(@Query('outletId') outletId: string) {
    return this.menu.snapshot(outletId);
  }

  @Get('items')
  @RequirePermissions('menu:read')
  items(@Query('categoryId') categoryId?: string, @Query('search') search?: string) {
    return this.menu.listItems({ categoryId, search });
  }

  @Post('items')
  @RequirePermissions('menu:write')
  createItem(@Body() dto: CreateItemDto) {
    return this.menu.createItem(dto);
  }

  @Patch('items/:id')
  @RequirePermissions('menu:write')
  updateItem(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.menu.updateItem(id, body);
  }

  @Delete('items/:id')
  @RequirePermissions('menu:write')
  @ApiOperation({ summary: 'Archive an item — never hard-deleted, old bills reference it' })
  archiveItem(@Param('id') id: string) {
    return this.menu.archiveItem(id);
  }

  @Get('categories')
  @RequirePermissions('menu:read')
  categories() {
    return this.menu.listCategories();
  }

  @Post('categories')
  @RequirePermissions('menu:write')
  createCategory(@Body() body: { name: string; sortOrder?: number; stationId?: string; colour?: string }) {
    return this.menu.createCategory(body);
  }
}
