import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString,
  IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { MenuService } from './menu.service';
import { RequirePermissions } from '../auth/guards';

class MenuVariantDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MinLength(1) @MaxLength(120) @Matches(/\S/) name!: string;
  @IsOptional() @IsInt() @Min(0) @Max(2147483647) priceMinor?: number | null;
  @IsOptional() @IsInt() @Min(-2147483648) @Max(2147483647) priceDeltaMinor?: number;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

class ModifierDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MinLength(1) @MaxLength(120) @Matches(/\S/) name!: string;
  @IsOptional() @IsInt() @Min(0) @Max(2147483647) priceMinor?: number;
}

class ModifierGroupDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MinLength(1) @MaxLength(120) @Matches(/\S/) name!: string;
  @IsOptional() @IsInt() @Min(0) @Max(20) minSelect?: number;
  @IsOptional() @IsInt() @Min(1) @Max(20) maxSelect?: number;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ModifierDto)
  modifiers!: ModifierDto[];
}

class UpdateItemDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) @Matches(/\S/) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsInt() @Min(0) @Max(2147483647) priceMinor?: number;
  @IsOptional() @IsInt() @Min(0) @Max(2147483647) packagingChargeMinor?: number;
  @IsOptional() @IsIn(['gst-0', 'gst-5', 'gst-12', 'gst-18']) taxSlabId?: string;
  @IsOptional() @IsString() @MaxLength(12) hsnSac?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => MenuVariantDto)
  variants?: MenuVariantDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ModifierGroupDto)
  modifierGroups?: ModifierGroupDto[];
}

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
  updateItem(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateItemDto) {
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
