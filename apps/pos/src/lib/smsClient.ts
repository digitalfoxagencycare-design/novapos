import { cloudApi } from './cloudSession';

/** OTP generation, delivery and verification belong on the server. */
export const sendFast2SmsOtp = (phone: string) => cloudApi.sendOtp(phone);
