import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SmsService } from './sms.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { issuer: 'novapos', audience: 'novapos-clients' },
      verifyOptions: { issuer: 'novapos', audience: 'novapos-clients' },
    }),
  ],
  providers: [AuthService, SmsService],
  controllers: [AuthController],
  exports: [AuthService, SmsService, JwtModule],
})
export class AuthModule {}
