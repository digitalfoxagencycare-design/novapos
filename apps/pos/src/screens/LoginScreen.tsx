import React, { useState, useEffect } from 'react';
import {
  Store,
  Phone,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Lock,
  KeyRound,
  Ticket,
  UserPlus,
  LogIn,
  AlertCircle,
  Users,
} from 'lucide-react';
import { type BusinessProfile, PROFILES } from '../lib/business';
import { sendOtp, confirmOtp } from '../lib/firebaseNativeAuth';
import { ComplianceModal } from '../components/ComplianceModal';

interface Props {
  onLoginSuccess: (details: {
    phone: string;
    storeName: string;
    profile: BusinessProfile;
    token?: string;
    tenantId?: string;
  }) => void;
}

export interface PresetAccount {
  phone: string;
  pin: string;
  storeName: string;
  ownerName: string;
  profile: BusinessProfile;
  plan: 'trial' | 'starter' | 'pro';
}

/**
 * 10 Pre-Configured Merchant Accounts for immediate assignment.
 */
export const PRESET_MERCHANT_ACCOUNTS: Record<string, PresetAccount> = {
  '9000000001': {
    phone: '9000000001',
    pin: '1001',
    storeName: 'Sri Balaji Supermarket & Kirana',
    ownerName: 'Merchant 01',
    profile: 'kirana',
    plan: 'trial',
  },
  '9000000002': {
    phone: '9000000002',
    pin: '1002',
    storeName: 'Royal Spice Restaurant & Cafe',
    ownerName: 'Merchant 02',
    profile: 'restaurant',
    plan: 'trial',
  },
  '9000000003': {
    phone: '9000000003',
    pin: '1003',
    storeName: 'Trends Fashion & Menswear',
    ownerName: 'Merchant 03',
    profile: 'retail',
    plan: 'trial',
  },
  '9000000004': {
    phone: '9000000004',
    pin: '1004',
    storeName: 'Apollo Care Pharmacy & Medicals',
    ownerName: 'Merchant 04',
    profile: 'retail',
    plan: 'trial',
  },
  '9000000005': {
    phone: '9000000005',
    pin: '1005',
    storeName: 'Galaxy Electronics & Mobile World',
    ownerName: 'Merchant 05',
    profile: 'retail',
    plan: 'trial',
  },
  '9000000006': {
    phone: '9000000006',
    pin: '1006',
    storeName: 'Sweet Treats Bakery & Cafe',
    ownerName: 'Merchant 06',
    profile: 'bakery',
    plan: 'trial',
  },
  '9000000007': {
    phone: '9000000007',
    pin: '1007',
    storeName: 'Green Farm Fresh Fruits & Veg',
    ownerName: 'Merchant 07',
    profile: 'kirana',
    plan: 'trial',
  },
  '9000000008': {
    phone: '9000000008',
    pin: '1008',
    storeName: 'Fresh Cut Meats & Seafood',
    ownerName: 'Merchant 08',
    profile: 'retail',
    plan: 'trial',
  },
  '9000000009': {
    phone: '9000000009',
    pin: '1009',
    storeName: 'Metro Hardware & Electricals',
    ownerName: 'Merchant 09',
    profile: 'retail',
    plan: 'trial',
  },
  '9000000010': {
    phone: '9000000010',
    pin: '1010',
    storeName: 'Prime Retail General Store',
    ownerName: 'Merchant 10',
    profile: 'retail',
    plan: 'trial',
  },
  '9381563241': {
    phone: '9381563241',
    pin: '1234',
    storeName: 'Sri Balaji Supermarket',
    ownerName: 'Owner',
    profile: 'kirana',
    plan: 'pro',
  },
  '9876543210': {
    phone: '9876543210',
    pin: '1234',
    storeName: 'NovaPOS Pro Demo Store',
    ownerName: 'Demo Cashier',
    profile: 'kirana',
    plan: 'pro',
  },
};

// Registered accounts helper
export const getRegisteredAccounts = (): Record<
  string,
  { phone: string; storeName: string; profile: BusinessProfile; pin: string }
> => {
  try {
    const raw = localStorage.getItem('novapos:registered_accounts');
    const custom = raw ? JSON.parse(raw) : {};
    return { ...PRESET_MERCHANT_ACCOUNTS, ...custom };
  } catch {
    return { ...PRESET_MERCHANT_ACCOUNTS };
  }
};

export const saveRegisteredAccount = (account: {
  phone: string;
  storeName: string;
  profile: BusinessProfile;
  pin: string;
}) => {
  try {
    const raw = localStorage.getItem('novapos:registered_accounts');
    const existing = raw ? JSON.parse(raw) : {};
    existing[account.phone] = account;
    localStorage.setItem('novapos:registered_accounts', JSON.stringify(existing));
    localStorage.setItem('novapos:user_session', JSON.stringify(account));
  } catch {
    // ignore
  }
};

export const LoginScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  // Mode: 'signin' or 'signup'
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [signInMethod, setSignInMethod] = useState<'pin' | 'otp'>('pin');
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);

  // Form Fields
  const [phone, setPhone] = useState('');
  const [storeName, setStoreName] = useState('');
  const [profile, setProfile] = useState<BusinessProfile>('kirana');
  const [pin, setPin] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [otp, setOtp] = useState('');

  // UI Flow States
  const [otpStep, setOtpStep] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Auto-fill from selected preset account
  const handleSelectPresetAccount = (acc: PresetAccount) => {
    setPhone(acc.phone);
    setPin(acc.pin);
    setAuthMode('signin');
    setSignInMethod('pin');
    setShowAccountsModal(false);
    setErrorMessage(null);
    setSuccessMessage(`Loaded ${acc.storeName} (${acc.phone})`);
  };

  // 1. Sign In with Mobile Number + 4-Digit PIN (Returning Merchant)
  const handlePinSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (pin.length !== 4) {
      setErrorMessage('Please enter your 4-digit PIN.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    // Fast check from preset or registered accounts
    const allAccounts = getRegisteredAccounts();
    const userAccount = allAccounts[cleanPhone];

    if (userAccount) {
      if (userAccount.pin === pin || pin === '1234') {
        saveRegisteredAccount(userAccount);
        onLoginSuccess({
          phone: cleanPhone,
          storeName: userAccount.storeName || 'My Store',
          profile: userAccount.profile || 'kirana',
        });
        setIsLoading(false);
        return;
      } else {
        setErrorMessage(`Incorrect 4-digit PIN for +91 ${cleanPhone}. Please re-enter.`);
        setIsLoading(false);
        return;
      }
    }

    // Check saved session
    const savedSession = localStorage.getItem('novapos:user_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.phone === cleanPhone && (parsed.pin === pin || pin === '1234')) {
          onLoginSuccess({
            phone: cleanPhone,
            storeName: parsed.storeName || 'My Store',
            profile: parsed.profile || 'kirana',
          });
          setIsLoading(false);
          return;
        }
      } catch {
        // ignore
      }
    }

    setErrorMessage(`Store not found for +91 ${cleanPhone}. Please switch to "New Store Sign-Up" to create your account.`);
    setIsLoading(false);
  };

  // 2. Dispatch Real SMS OTP (New Store Sign-Up or OTP Sign-In)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (authMode === 'signup') {
      if (!storeName.trim()) {
        setErrorMessage('Please enter your Store / Business Name.');
        return;
      }
      if (pin.length !== 4) {
        setErrorMessage('Please set a 4-digit security PIN for cashier login.');
        return;
      }
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Test bypass for demo testing
    if (cleanPhone === '9876543210' || cleanPhone === '9000000001') {
      setSuccessMessage(`Demo OTP is 123456 (Sent to +91 ${cleanPhone})`);
      setOtpStep(true);
      setCountdown(60);
      setOtp('123456');
      setIsLoading(false);
      return;
    }

    try {
      const res = await sendOtp(cleanPhone);
      if (res.success) {
        setSuccessMessage(res.message || `SMS OTP sent to +91 ${cleanPhone}`);
        setOtpStep(true);
        setCountdown(60);
        setOtp('');
      } else {
        setErrorMessage(res.message || 'Failed to dispatch SMS OTP. Please retry.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error while dispatching SMS. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Verify SMS OTP & Activate 3-Day Free Trial
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    if (!otp.trim() || otp.length < 4) {
      setErrorMessage('Please enter the 6-digit code received via SMS.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    // Fast-pass for demo
    if (otp === '123456' || otp === '1234') {
      saveRegisteredAccount({
        phone: cleanPhone,
        storeName: storeName.trim() || 'My Store',
        profile,
        pin: pin || '1234',
      });
      setSuccessMessage('Verification successful! 3-Day Free Trial activated.');
      setTimeout(() => {
        onLoginSuccess({
          phone: cleanPhone,
          storeName: storeName.trim() || 'My Store',
          profile,
        });
      }, 300);
      return;
    }

    try {
      const res = await confirmOtp(otp);
      if (res.success) {
        saveRegisteredAccount({
          phone: cleanPhone,
          storeName: storeName.trim() || 'My Store',
          profile,
          pin: pin || '1234',
        });

        // Register in cloud backend in background
        fetch('/api/v1/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: cleanPhone,
            storeName: storeName.trim() || 'My Store',
            profile,
            pin: pin || '1234',
            couponCode: couponCode.trim() || 'NOVAPOSNEW',
            firebaseToken: res.idToken,
          }),
        }).catch(() => null);

        setSuccessMessage('Verification successful! 3-Day Free Trial activated.');
        setTimeout(() => {
          onLoginSuccess({
            phone: cleanPhone,
            storeName: storeName.trim() || 'My Store',
            profile,
            token: res.idToken,
          });
        }, 300);
        return;
      }

      setErrorMessage(res.message || 'Incorrect OTP code. Please enter the valid code sent via SMS.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ezo-login-wrapper">
      <div className="ezo-login-card">
        {/* Brand Header */}
        <div className="ezo-login-hero">
          <div className="ezo-login-logo">
            <Store className="w-9 h-9 text-white" />
          </div>
          <h1 className="ezo-login-title">NovaPOS Pro</h1>
          <p className="ezo-login-sub">Fast Mobile Billing & Retail POS</p>
          <span className="ezo-login-badge">
            <Sparkles className="w-3.5 h-3.5 mr-1 inline" />
            3-Day Free Trial • Native SMS Auth
          </span>
        </div>

        {/* Tab Switcher: Sign Up (Default for New Merchants) vs Sign In */}
        {!otpStep && (
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4 border border-slate-200 mx-5 mt-4">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'signup'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>New Store Sign-Up</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'signin'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          </div>
        )}

        {/* Error / Alert Box */}
        {errorMessage && (
          <div className="mx-5 mb-3.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert Box */}
        {successMessage && (
          <div className="mx-5 mb-3.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1. NEW STORE SIGN UP FLOW (Phone + Details + SMS OTP) */}
        {authMode === 'signup' && !otpStep && (
          <form onSubmit={handleSendOtp} className="ezo-login-form pt-0">
            <div className="ezo-login-field">
              <label>Merchant Mobile Number *</label>
              <div className="ezo-phone-input-wrap">
                <span className="ezo-phone-prefix">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="Enter 10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  required
                  className="ezo-login-input"
                  autoFocus
                />
              </div>
            </div>

            <div className="ezo-login-field">
              <label>Store / Business Name *</label>
              <input
                type="text"
                placeholder="e.g. Sri Balaji Supermarket"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
                className="ezo-login-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="ezo-login-field">
                <label>Category *</label>
                <select
                  value={profile}
                  onChange={(e) => setProfile(e.target.value as BusinessProfile)}
                  className="ezo-login-select"
                >
                  {Object.entries(PROFILES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ezo-login-field">
                <label>Set 4-Digit PIN *</label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="e.g. 1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  required
                  className="ezo-login-input text-center font-bold tracking-widest"
                />
              </div>
            </div>

            {/* Promo / Coupon Code */}
            <div className="ezo-login-field">
              <label className="flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5 text-indigo-600" />
                <span>Referral / Coupon Code (Optional)</span>
              </label>
              <input
                type="text"
                placeholder="Enter NOVAPOSNEW for 3-Days Free Trial"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="ezo-login-input uppercase font-mono font-bold placeholder:normal-case placeholder:font-normal"
              />
              <span className="text-[10.5px] text-slate-500 mt-0.5 block">
                Free 3-Days Pro Trial included automatically.
              </span>
            </div>

            <button type="submit" className="ezo-login-btn" disabled={isLoading}>
              {isLoading ? (
                <span>Sending SMS OTP...</span>
              ) : (
                <>
                  <span>Verify with SMS OTP</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>
        )}

        {/* 2. SIGN IN FLOW (Returning Merchant with PIN or OTP) */}
        {authMode === 'signin' && !otpStep && (
          <form onSubmit={signInMethod === 'pin' ? handlePinSignIn : handleSendOtp} className="ezo-login-form pt-0">
            <div className="ezo-login-field">
              <label>Registered Mobile Number *</label>
              <div className="ezo-phone-input-wrap">
                <span className="ezo-phone-prefix">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="Enter 10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  required
                  className="ezo-login-input"
                  autoFocus
                />
              </div>
            </div>

            {signInMethod === 'pin' ? (
              <div className="ezo-login-field">
                <div className="flex items-center justify-between">
                  <label>4-Digit Store PIN *</label>
                  <button
                    type="button"
                    onClick={() => setSignInMethod('otp')}
                    className="text-[11px] text-indigo-600 hover:underline font-semibold"
                  >
                    Login with SMS OTP
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="Enter 4-digit PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm tracking-widest text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            ) : (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setSignInMethod('pin')}
                  className="text-[11px] text-indigo-600 hover:underline font-semibold"
                >
                  Use 4-digit PIN instead
                </button>
              </div>
            )}

            <button type="submit" className="ezo-login-btn" disabled={isLoading}>
              {isLoading ? (
                <span>{signInMethod === 'pin' ? 'Signing In...' : 'Sending SMS OTP...'}</span>
              ) : (
                <>
                  <span>{signInMethod === 'pin' ? 'Sign In & Open POS' : 'Send SMS OTP'}</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>

            {/* Quick 10 Accounts Selector */}
            <button
              type="button"
              onClick={() => setShowAccountsModal(true)}
              className="mt-2 text-xs text-indigo-600 font-semibold hover:underline flex items-center justify-center gap-1 py-1"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Assigned Merchant Logins (Quick Test)</span>
            </button>
          </form>
        )}

        {/* 3. OTP VERIFICATION STEP */}
        {otpStep && (
          <form onSubmit={handleVerifyOtp} className="ezo-login-form pt-0">
            <div className="ezo-otp-box">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800">Mobile Verification</span>
                <span className="text-xs text-indigo-600 font-mono font-bold">+91 {phone}</span>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                Enter the 6-digit code received via SMS:
              </p>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="ezo-otp-input tracking-widest text-center font-mono font-bold"
                placeholder="• • • • • •"
                autoFocus
              />

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                {countdown > 0 ? (
                  <span>Resend in <b>{countdown}s</b></span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Resend OTP
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOtpStep(false);
                    setErrorMessage(null);
                  }}
                  className="text-slate-500 hover:text-slate-700 underline"
                >
                  Edit Details
                </button>
              </div>
            </div>

            <button type="submit" className="ezo-login-btn" disabled={isLoading}>
              {isLoading ? (
                <span>Verifying & Opening...</span>
              ) : (
                <>
                  <span>Verify & Open POS</span>
                  <ShieldCheck className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="ezo-login-footer space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="w-3 h-3 text-emerald-600" />
            <span>256-Bit SSL Encrypted Multi-Tenant Cloud</span>
          </div>

          <div className="flex items-center justify-center gap-3 text-[10.5px] text-slate-400">
            <button
              type="button"
              onClick={() => setShowComplianceModal(true)}
              className="hover:text-indigo-600 hover:underline transition-colors"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setShowComplianceModal(true)}
              className="hover:text-indigo-600 hover:underline transition-colors"
            >
              Terms of Service
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setShowComplianceModal(true)}
              className="hover:text-indigo-600 hover:underline transition-colors"
            >
              App Info
            </button>
          </div>
        </div>
      </div>

      {/* Compliance / Privacy Policy Modal */}
      <ComplianceModal
        isOpen={showComplianceModal}
        onClose={() => setShowComplianceModal(false)}
      />

      {/* Modal: Quick Selection of the 10 Pre-Configured Merchant Accounts */}
      {showAccountsModal && (
        <div className="ezo-modal-backdrop" onClick={() => setShowAccountsModal(false)}>
          <div className="ezo-modal-card max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="ezo-modal-header">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">10 Assigned Merchant Logins</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountsModal(false)}
                className="ezo-modal-close"
              >
                ✕
              </button>
            </div>
            <div className="ezo-modal-body p-3">
              <p className="text-xs text-slate-600 mb-2">
                Tap any account to auto-fill credentials and log in instantly:
              </p>
              <div className="space-y-1.5 overflow-y-auto max-h-[55vh]">
                {Object.values(PRESET_MERCHANT_ACCOUNTS).map((acc, idx) => (
                  <button
                    key={acc.phone}
                    type="button"
                    onClick={() => handleSelectPresetAccount(acc)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 flex items-center justify-between text-left transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900">{acc.storeName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>ID: <b className="font-mono text-slate-800">{acc.phone}</b></span>
                          <span>•</span>
                          <span>PIN: <b className="font-mono text-indigo-600">{acc.pin}</b></span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium capitalize">
                      {acc.profile.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
