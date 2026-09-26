import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { FirebaseAuthentication as NativeAuth } from '@capacitor-firebase/authentication';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';

export const firebaseConfig = {
  apiKey: 'AIzaSyCGbRleBCnMQ4DuUy7RX2vLsHxt3BQK2k0',
  authDomain: 'novapos-f60f2.firebaseapp.com',
  projectId: 'novapos-f60f2',
  storageBucket: 'novapos-f60f2.firebasestorage.app',
  messagingSenderId: '882987938160',
  appId: '1:882987938160:web:e7948345acb158b3901fb5',
  measurementId: 'G-7K52TWJTSQ',
};

// Web Auth instance
const webApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const webAuth = getAuth(webApp);

export function cleanIndianPhone(phone: string): string {
  const clean = phone.trim().replace(/\D/g, '').slice(-10);
  if (clean.length !== 10) {
    throw new Error('Please enter a valid 10-digit mobile number.');
  }
  return `+91${clean}`;
}

// State tracking for active session
let activeVerificationId: string | null = null;
let activePhone: string | null = null;
let webConfirmationResult: ConfirmationResult | null = null;
let webRecaptchaVerifier: RecaptchaVerifier | null = null;
let nativeListeners: PluginListenerHandle[] = [];

/**
 * Initializes and sends SMS OTP using Native Android Firebase Auth on Mobile,
 * or Web JS SDK fallback on Desktop Browser.
 */
export async function sendOtp(phone: string): Promise<{ success: boolean; message: string }> {
  const formattedPhone = cleanIndianPhone(phone);
  activePhone = formattedPhone;

  // 1. NATIVE ANDROID PHONE AUTH (Uses Google Play Integrity, NO reCAPTCHA IFRAME)
  if (Capacitor.isNativePlatform()) {
    try {
      // Clear previous listeners
      for (const h of nativeListeners) {
        try {
          await h.remove();
        } catch {
          // ignore
        }
      }
      nativeListeners = [];

      // Promise to await code dispatch or auto-verification
      return new Promise(async (resolve, reject) => {
        let isResolved = false;

        try {
          const l1 = await NativeAuth.addListener('phoneCodeSent', (event) => {
            activeVerificationId = event.verificationId;
            if (!isResolved) {
              isResolved = true;
              resolve({
                success: true,
                message: `Native SMS OTP sent to ${formattedPhone}`,
              });
            }
          });
          nativeListeners.push(l1);

          const l2 = await NativeAuth.addListener('phoneVerificationCompleted', async () => {
            if (!isResolved) {
              isResolved = true;
              resolve({
                success: true,
                message: `Device verified automatically!`,
              });
            }
          });
          nativeListeners.push(l2);

          const l3 = await NativeAuth.addListener('phoneVerificationFailed', (event) => {
            if (!isResolved) {
              isResolved = true;
              resolve({
                success: false,
                message: event.message || 'Phone verification failed on device.',
              });
            }
          });
          nativeListeners.push(l3);

          await NativeAuth.signInWithPhoneNumber({
            phoneNumber: formattedPhone,
            timeout: 60,
          });

          // Fallback timer if listener didn't trigger
          setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              resolve({
                success: true,
                message: `SMS OTP dispatched to ${formattedPhone}`,
              });
            }
          }, 4000);
        } catch (err: any) {
          if (!isResolved) {
            isResolved = true;
            resolve({
              success: false,
              message: err?.message || 'Failed to dispatch native SMS OTP.',
            });
          }
        }
      });
    } catch (err: any) {
      console.error('[Native Phone Auth Error]', err);
      return { success: false, message: err?.message || 'Failed to start native SMS auth.' };
    }
  }

  // 2. WEB JS SDK FALLBACK (In normal desktop browser)
  try {
    if (webRecaptchaVerifier) {
      try {
        webRecaptchaVerifier.clear();
      } catch {
        // ignore
      }
      webRecaptchaVerifier = null;
    }

    const dynamicId = `recaptcha-web-${Date.now()}`;
    const container = document.createElement('div');
    container.id = dynamicId;
    container.style.position = 'fixed';
    container.style.bottom = '0';
    container.style.left = '0';
    container.style.width = '0px';
    container.style.height = '0px';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);

    webRecaptchaVerifier = new RecaptchaVerifier(webAuth, dynamicId, {
      size: 'invisible',
      callback: () => console.log('Web reCAPTCHA solved'),
    });

    webConfirmationResult = await signInWithPhoneNumber(webAuth, formattedPhone, webRecaptchaVerifier);

    return {
      success: true,
      message: `Web SMS OTP sent to ${formattedPhone}`,
    };
  } catch (err: any) {
    console.error('[Web Phone Auth Error]', err);
    return { success: false, message: err?.message || 'Failed to send SMS code.' };
  }
}

/**
 * Confirms the 6-digit SMS code entered by the user.
 */
export async function confirmOtp(
  code: string
): Promise<{ success: boolean; message: string; idToken?: string; user?: any }> {
  const cleanCode = code.trim();
  if (cleanCode.length < 4) {
    return { success: false, message: 'Please enter the valid OTP code.' };
  }

  // 1. NATIVE ANDROID CONFIRMATION
  if (Capacitor.isNativePlatform()) {
    try {
      if (activeVerificationId) {
        await NativeAuth.confirmVerificationCode({
          verificationId: activeVerificationId,
          verificationCode: cleanCode,
        });
      }

      const { user } = await NativeAuth.getCurrentUser();
      const { token } = await NativeAuth.getIdToken();

      return {
        success: true,
        message: 'Phone verified successfully!',
        idToken: token || undefined,
        user,
      };
    } catch (err: any) {
      console.error('[Native OTP Confirmation Error]', err);
      return {
        success: false,
        message: err?.message || 'Invalid or expired OTP code.',
      };
    }
  }

  // 2. WEB CONFIRMATION
  if (!webConfirmationResult) {
    return { success: false, message: 'No pending OTP verification. Please request a new OTP.' };
  }

  try {
    const cred = await webConfirmationResult.confirm(cleanCode);
    const idToken = await cred.user.getIdToken();
    return {
      success: true,
      message: 'Phone verified successfully with Firebase!',
      idToken,
      user: cred.user,
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Incorrect OTP code. Please enter the valid code sent to your mobile.',
    };
  }
}
