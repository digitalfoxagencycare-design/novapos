import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';

/**
 * Firebase Project Configuration for NovaPOS (Project: novapos-f60f2).
 * 10,000 Free Phone SMS OTPs per month.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCGbRleBCnMQ4DuUy7RX2vLsHxt3BQK2k0",
  authDomain: "novapos-f60f2.firebaseapp.com",
  projectId: "novapos-f60f2",
  storageBucket: "novapos-f60f2.firebasestorage.app",
  messagingSenderId: "882987938160",
  appId: "1:882987938160:web:e7948345acb158b3901fb5",
  measurementId: "G-7K52TWJTSQ",
};

// Initialize Firebase App instance safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// State to store active confirmation result
let confirmationResult: ConfirmationResult | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;

/**
 * Initializes Invisible reCAPTCHA on a fresh, isolated DOM container.
 * Completely eliminates "reCAPTCHA has already been rendered in this element" errors.
 */
export function setupRecaptcha(): RecaptchaVerifier {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      // ignore
    }
    recaptchaVerifier = null;
  }

  // Remove any previously rendered reCAPTCHA containers from DOM
  const oldContainers = document.querySelectorAll('[id^="recaptcha-dyn-"]');
  oldContainers.forEach((el) => {
    try {
      el.remove();
    } catch {
      // ignore
    }
  });

  // Create a brand new unique container for this specific attempt
  const dynamicId = `recaptcha-dyn-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const containerEl = document.createElement('div');
  containerEl.id = dynamicId;
  containerEl.style.position = 'fixed';
  containerEl.style.bottom = '0';
  containerEl.style.left = '0';
  containerEl.style.width = '0px';
  containerEl.style.height = '0px';
  containerEl.style.overflow = 'hidden';
  containerEl.style.opacity = '0';
  containerEl.style.pointerEvents = 'none';
  containerEl.style.zIndex = '-9999';
  document.body.appendChild(containerEl);

  recaptchaVerifier = new RecaptchaVerifier(auth, dynamicId, {
    size: 'invisible',
    callback: () => {
      console.log('[Firebase Auth] Invisible reCAPTCHA verified.');
    },
    'expired-callback': () => {
      console.warn('[Firebase Auth] Invisible reCAPTCHA expired.');
    },
  });

  return recaptchaVerifier;
}

/**
 * Sends a real SMS OTP to Indian mobile number (+91) using Firebase Phone Auth.
 * Includes 10,000 Free SMS OTPs per month.
 */
export async function sendFirebasePhoneOtp(
  phone: string
): Promise<{ success: boolean; message: string; isMock?: boolean }> {
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  if (cleanPhone.length !== 10) {
    return { success: false, message: 'Please enter a valid 10-digit mobile number.' };
  }

  const fullPhoneNumber = `+91${cleanPhone}`;

  try {
    const verifier = setupRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, fullPhoneNumber, verifier);

    return {
      success: true,
      message: `Firebase SMS OTP sent to +91 ${cleanPhone}`,
    };
  } catch (error: any) {
    console.error('[Firebase Phone Auth Error]', error);
    let msg = error?.message || 'Failed to send SMS OTP via Firebase.';
    if (error.code === 'auth/invalid-phone-number') msg = 'Invalid phone number format.';
    if (error.code === 'auth/quota-exceeded') msg = 'SMS quota exceeded for today.';
    if (error.code === 'auth/too-many-requests') msg = 'Too many requests. Please try after 1 minute.';
    if (error.code === 'auth/unauthorized-domain') msg = 'Domain needs to be added in Firebase Console > Authentication > Settings > Authorized domains.';
    if (error.code === 'auth/operation-not-allowed') msg = 'Phone Authentication is not enabled in Firebase Console.';
    if (error.code === 'auth/invalid-app-credential' || error.code === 'auth/captcha-check-failed') {
      msg = 'Verification failed. Please retry sending OTP.';
    }
    return { success: false, message: msg };
  }
}

/**
 * Confirms the 6-digit SMS OTP received via Firebase.
 */
export async function confirmFirebasePhoneOtp(
  otp: string
): Promise<{ success: boolean; message: string; user?: any }> {
  if (!confirmationResult) {
    return { success: false, message: 'No pending OTP verification found. Please tap Resend OTP.' };
  }

  try {
    const userCredential = await confirmationResult.confirm(otp.trim());
    return {
      success: true,
      message: 'Mobile verified successfully with Firebase!',
      user: userCredential.user,
    };
  } catch (error: any) {
    console.error('[Firebase OTP Verification Error]', error);
    return {
      success: false,
      message: 'Incorrect OTP code. Please enter the valid code sent to your mobile.',
    };
  }
}
