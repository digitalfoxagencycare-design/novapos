import { Injectable, Logger } from '@nestjs/common';

export interface SendOtpResult {
  success: boolean;
  message: string;
  requestId?: string;
  isMock?: boolean;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  private getApiKey(): string {
    return (
      process.env.FAST2SMS_API_KEY ||
      'f7oiltuQVDCxG4zkKsYTWdqySejArL8c06p1On3hwm5NFXvIgaoIMzvGguTHn2NwhAfOtXKcb39Vi0m6'
    ).trim();
  }

  /**
   * Send a numeric verification OTP to an Indian mobile number via Fast2SMS.
   * Tries Fast2SMS 'otp' route first, and falls back to 'q' (Quick SMS) if needed.
   */
  async sendOtp(phone: string, otp: string): Promise<SendOtpResult> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return { success: false, message: 'Invalid 10-digit mobile number.' };
    }

    const key = this.getApiKey();
    if (!key || key === 'CHANGE_ME_FAST2SMS_KEY') {
      this.logger.warn(`[DEV MODE] Simulated OTP for +91${cleanPhone}: ${otp}`);
      return {
        success: true,
        message: 'OTP sent in development mode.',
        isMock: true,
      };
    }

    try {
      this.logger.log(`Dispatching SMS OTP to +91${cleanPhone} via Fast2SMS...`);
      
      // 1. Try OTP route
      let response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: otp,
          numbers: cleanPhone,
        }),
      });

      let data = (await response.json().catch(() => ({}))) as {
        return?: boolean;
        message?: string[];
        request_id?: string;
      };

      if (response.ok && data.return) {
        this.logger.log(`Fast2SMS OTP sent to ${cleanPhone}. Request ID: ${data.request_id}`);
        return {
          success: true,
          message: 'SMS OTP sent successfully to your mobile.',
          requestId: data.request_id,
          isMock: false,
        };
      }

      // 2. Fallback to Quick SMS route if OTP route failed
      this.logger.warn(`Fast2SMS OTP route response: ${JSON.stringify(data)}. Trying Quick SMS route...`);
      response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'q',
          message: `Your NovaPOS verification code is ${otp}. Valid for 5 minutes. Do not share this OTP.`,
          language: 'english',
          numbers: cleanPhone,
        }),
      });

      data = (await response.json().catch(() => ({}))) as {
        return?: boolean;
        message?: string[];
        request_id?: string;
      };

      if (response.ok && data.return) {
        this.logger.log(`Fast2SMS Quick SMS sent to ${cleanPhone}. Request ID: ${data.request_id}`);
        return {
          success: true,
          message: 'SMS OTP sent successfully to your mobile.',
          requestId: data.request_id,
          isMock: false,
        };
      }

      const errMsg = Array.isArray(data.message) ? data.message.join(', ') : 'Fast2SMS gateway returned error';
      this.logger.error(`Fast2SMS failed: ${errMsg}`);
      return {
        success: false,
        message: errMsg || 'Failed to dispatch SMS.',
      };
    } catch (err) {
      this.logger.error(`Fast2SMS Network Error: ${(err as Error).message}`);
      return {
        success: false,
        message: 'Failed to connect to SMS gateway.',
      };
    }
  }
}
