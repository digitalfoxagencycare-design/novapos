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
import { cloudApi } from '../lib/cloudSession';
import { refreshSubscription } from '../lib/subscription';
import { ComplianceModal } from '../components/ComplianceModal';

interface Props {
  onLoginSuccess: (details: {
    phone: string;
    storeName: string;
    profile: BusinessProfile;
    token?: string;
    tenantId?: string;
    outletId?: string;
  }) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  // Mode: 'signin' or 'signup'
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [signInMethod, setSignInMethod] = useState<'pin' | 'otp'>('pin');
  const [showComplianceModal, setShowComplianceModal] = useState(false);

  // Form Fields
  const [phone, setPhone] = useState('');
  const [storeName, setStoreName] = useState('');
  const [profile, setProfile] = useState<BusinessProfile>('kirana');
  const [pin, setPin] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [dealerCode, setDealerCode] = useState('');
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

    try {
      const result = await cloudApi.loginPhonePin(cleanPhone, pin);
      await refreshSubscription();
      onLoginSuccess({ phone: cleanPhone, storeName: result.tenant.name, profile, tenantId: result.tenant.id, outletId: result.staff?.outletId });
    } catch (err) {
      setErrorMessage((err as Error).message || 'Sign in online with your merchant PIN.');
    } finally { setIsLoading(false); }
  };

  // Dispatch an OTP that the backend can verify.
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

      // Check if phone number is already registered
      try {
        setIsLoading(true);
        const check = await cloudApi.checkPhone(cleanPhone);
        if (check.exists) {
          setIsLoading(false);
          setErrorMessage(`This mobile number is already registered with '${check.storeName || 'NovaPOS'}'. Please Sign In using your 4-digit PIN or SMS OTP.`);
          setAuthMode('signin');
          setSignInMethod('pin');
          return;
        }
      } catch {
        // Continue if offline / fallback
      }
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const fbRes = await cloudApi.sendOtp(cleanPhone);
      if (fbRes.success) {
        setSuccessMessage(`SMS OTP sent to +91 ${cleanPhone}`);
        setOtpStep(true);
        setCountdown(60);
        setOtp('');
      } else {
        setErrorMessage(fbRes.message || 'Failed to dispatch SMS OTP. Please retry.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error while sending SMS OTP. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify SMS OTP on the backend and provision the merchant.
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    if (!/^\d{6}$/.test(otp.trim())) {
      setErrorMessage('Please enter the 6-digit code received via SMS.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 2. Provision Tenant/User in Supabase & issue JWT session
      const result = await cloudApi.verifyOtp({
        phone: cleanPhone,
        otp: otp.trim(),
        ...(authMode === 'signup' ? { storeName: storeName.trim(), profile, pin, couponCode: couponCode.trim(), ...(dealerCode.trim() ? { dealerCode: dealerCode.trim().toUpperCase() } : {}) } : {}),
      });
      await refreshSubscription();
      onLoginSuccess({ phone: cleanPhone, storeName: result.tenant.name, profile, tenantId: result.tenant.id, outletId: result.staff?.outletId });
    } catch (err) {
      setErrorMessage((err as Error).message || 'Verification failed. Please retry.');
    } finally { setIsLoading(false); }
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
            Merchant Terminal • Secure SMS Sign-In
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
                  ? 'bg-white text-orange-600 shadow-xs'
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
                  ? 'bg-white text-orange-600 shadow-xs'
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

            <div className="ezo-login-field"><label htmlFor="dealer-code">Dealer Code (Optional)</label><input id="dealer-code" className="ezo-login-input" value={dealerCode} maxLength={32} placeholder="e.g. DLR101" onChange={e=>setDealerCode(e.target.value.toUpperCase())}/></div>
            {/* Promo / Coupon Code */}
            <div className="ezo-login-field">
              <label className="flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5 text-orange-600" />
                <span>Referral / Coupon Code (Optional)</span>
              </label>
              <input
                type="text"
                placeholder="Enter Partner or Referral Code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="ezo-login-input uppercase font-mono font-bold placeholder:normal-case placeholder:font-normal"
              />
              <span className="text-[10.5px] text-slate-500 mt-0.5 block">
                Instant activation upon mobile verification.
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
                    className="text-[11px] text-orange-600 hover:underline font-semibold"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm tracking-widest text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
            ) : (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setSignInMethod('pin')}
                  className="text-[11px] text-orange-600 hover:underline font-semibold"
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

          </form>
        )}

        {/* 3. OTP VERIFICATION STEP */}
        {otpStep && (
          <form onSubmit={handleVerifyOtp} className="ezo-login-form pt-0">
            <div className="ezo-otp-box">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800">Mobile Verification</span>
                <span className="text-xs text-orange-600 font-mono font-bold">+91 {phone}</span>
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
                    className="text-orange-600 font-semibold hover:underline flex items-center gap-1"
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
            <span>Secure merchant sign-in</span>
          </div>

          <div className="flex items-center justify-center gap-3 text-[10.5px] text-slate-400">
            <button
              type="button"
              onClick={() => setShowComplianceModal(true)}
              className="hover:text-orange-600 hover:underline transition-colors"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setShowComplianceModal(true)}
              className="hover:text-orange-600 hover:underline transition-colors"
            >
              Terms of Service
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setShowComplianceModal(true)}
              className="hover:text-orange-600 hover:underline transition-colors"
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


    </div>
  );
};

