import { Capacitor, CapacitorHttp } from '@capacitor/core';

const FAST2SMS_API_KEY =
  'f7oiltuQVDCxG4zkKsYTWdqySejArL8c06p1On3hwm5NFXvIgaoIMzvGguTHn2NwhAfOtXKcb39Vi0m6';

const OTP_CACHE_KEY = 'novapos:pending_otp_verification';

export interface DispatchOtpResult {
  success: boolean;
  message: string;
  requestId?: string;
  generatedOtp?: string;
}

/**
 * Sends a real 4-digit SMS OTP to any Indian 10-digit mobile number via Fast2SMS.
 * Uses native CapacitorHttp on Android for 100% reliable direct SMS delivery without CORS/reCAPTCHA issues.
 */
export async function sendFast2SmsOtp(mobileNumber: string): Promise<DispatchOtpResult> {
  const cleanPhone = mobileNumber.replace(/\D/g, '').slice(-10);
  if (cleanPhone.length !== 10) {
    return { success: false, message: 'Please enter a valid 10-digit mobile number.' };
  }

  // Generate real random 4-digit OTP
  const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  // Save in local storage for instant verification on mobile
  localStorage.setItem(
    OTP_CACHE_KEY,
    JSON.stringify({ phone: cleanPhone, otp: randomOtp, expiresAt })
  );

  console.log(`[Fast2SMS] Dispatching native SMS OTP ${randomOtp} to +91${cleanPhone}...`);

  // 1. Native Android HTTP Dispatch via CapacitorHttp
  try {
    const payload = {
      route: 'q',
      message: `Your NovaPOS verification code is ${randomOtp}. Valid for 5 minutes. Do not share this OTP.`,
      language: 'english',
      numbers: cleanPhone,
    };

    let data: any = null;

    if (Capacitor.isNativePlatform()) {
      const nativeRes = await CapacitorHttp.post({
        url: 'https://www.fast2sms.com/dev/bulkV2',
        headers: {
          authorization: FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
        data: payload,
      });
      data = nativeRes.data;
    } else {
      const webRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      data = await webRes.json().catch(() => ({}));
    }

    if (data && (data.return === true || data.status_code === 200)) {
      console.log(`[Fast2SMS] SMS delivered successfully. Request ID: ${data.request_id}`);
      return {
        success: true,
        message: `SMS OTP sent to +91 ${cleanPhone}`,
        requestId: data.request_id,
        generatedOtp: randomOtp,
      };
    }

    // Try fallback route 'otp'
    const otpPayload = {
      route: 'otp',
      variables_values: randomOtp,
      numbers: cleanPhone,
    };

    if (Capacitor.isNativePlatform()) {
      const nativeRes = await CapacitorHttp.post({
        url: 'https://www.fast2sms.com/dev/bulkV2',
        headers: {
          authorization: FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
        data: otpPayload,
      });
      data = nativeRes.data;
    } else {
      const webRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(otpPayload),
      });
      data = await webRes.json().catch(() => ({}));
    }

    if (data && (data.return === true || data.status_code === 200)) {
      return {
        success: true,
        message: `SMS OTP sent to +91 ${cleanPhone}`,
        requestId: data.request_id,
        generatedOtp: randomOtp,
      };
    }

    const errStr = Array.isArray(data?.message) ? data.message.join(', ') : 'SMS gateway error';
    return {
      success: false,
      message: errStr || 'Unable to dispatch SMS. Please check mobile number.',
    };
  } catch (err: any) {
    console.error('[Fast2SMS Network Error]', err);
    return {
      success: false,
      message: 'Failed to connect to SMS gateway. Check internet connection.',
    };
  }
}

/**
 * Verifies entered OTP against the active session.
 */
export function verifyLocalFast2SmsOtp(
  mobileNumber: string,
  enteredOtp: string
): { success: boolean; message: string } {
  const cleanPhone = mobileNumber.replace(/\D/g, '').slice(-10);
  const raw = localStorage.getItem(OTP_CACHE_KEY);

  if (!raw) {
    return { success: false, message: 'OTP expired or not requested. Please tap Resend OTP.' };
  }

  try {
    const cached = JSON.parse(raw);
    if (cached.phone !== cleanPhone) {
      return { success: false, message: 'Mobile number mismatch. Please re-enter mobile number.' };
    }
    if (Date.now() > cached.expiresAt) {
      return { success: false, message: 'OTP expired (5 min validity). Please request a new OTP.' };
    }
    if (cached.otp !== enteredOtp.trim()) {
      return { success: false, message: 'Incorrect OTP code. Please enter the 4-digit code received via SMS.' };
    }

    // Clear used OTP on success
    localStorage.removeItem(OTP_CACHE_KEY);
    return { success: true, message: 'Mobile verification successful!' };
  } catch {
    return { success: false, message: 'Verification error. Please retry.' };
  }
}
