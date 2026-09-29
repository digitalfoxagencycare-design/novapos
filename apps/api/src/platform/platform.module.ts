import { Module } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { DealerController, DealerGuard, PlatformAuthController, PlatformGuard, PublicTelemetryController, SuperController, SuperGuard } from './platform.controller';
@Module({ providers: [PlatformService,PlatformGuard,SuperGuard,DealerGuard], controllers: [PlatformAuthController,SuperController,DealerController,PublicTelemetryController], exports: [PlatformService] })
export class PlatformModule {}
