import { useBackHandler } from '../lib/navigation';
import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Store,
  Building2,
  CreditCard,
  QrCode,
  Star,
  FileText,
  Check,
  Upload,
  Trash2,
  Edit3,
} from 'lucide-react';
import { type ProfileDetails } from '../App';

interface Props {
  profileName: string;
  phone: string;
  address: string;
  gstin: string;
  fssai: string;
  upiVpa: string;
  onUpdateProfile: (updates: Partial<ProfileDetails & ExtraProfileFields>) => void;
  onBack?: () => void;
}

export interface ExtraProfileFields {
  contactEmail?: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifscCode?: string;
  googleReviewUrl?: string;
  customFooter?: string;
  customHeader?: string;
  termsAndConditions?: string;
  signatureDataUrl?: string;
  luckyImageUrl?: string;
}

const STORAGE_EXTRA_KEY = 'novapos:profile_extra_fields';

export const ProfileScreen: React.FC<Props> = ({
  profileName,
  phone,
  address,
  gstin,
  fssai,
  upiVpa,
  onUpdateProfile,
  onBack,
}) => {
  // Load extra profile details
  const [extra, setExtra] = useState<ExtraProfileFields>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_EXTRA_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // State for form fields
  const [contactEmail, setContactEmail] = useState(extra.contactEmail || 'merchant@gmail.com');
  const [activeModal, setActiveModal] = useState<
    'business' | 'bank' | 'upi' | 'review' | 'custom' | null
  >(null);

  useBackHandler(Boolean(activeModal), () => setActiveModal(null));

  // Business state
  const [bizName, setBizName] = useState(profileName);
  const [bizPhone, setBizPhone] = useState(phone);
  const [bizAddress, setBizAddress] = useState(address);
  const [bizGstin, setBizGstin] = useState(gstin);
  const [bizFssai, setBizFssai] = useState(fssai);
  const [bizPin, setBizPin] = useState(() => {
    try {
      const sess = localStorage.getItem('novapos:user_session');
      return sess ? JSON.parse(sess).pin || '1234' : '1234';
    } catch {
      return '1234';
    }
  });

  // Bank state
  const [bankName, setBankName] = useState(extra.bankName || 'State Bank of India');
  const [accountHolder, setAccountHolder] = useState(extra.accountHolder || profileName);
  const [accountNumber, setAccountNumber] = useState(extra.accountNumber || '389201004829');
  const [ifscCode, setIfscCode] = useState(extra.ifscCode || 'SBIN0004523');

  // UPI state
  const [vpa, setVpa] = useState(upiVpa || '9381563241@upi');

  // Review URL state
  const [googleReviewUrl, setGoogleReviewUrl] = useState(
    extra.googleReviewUrl || 'https://g.page/r/your-business/review',
  );

  // Custom fields state
  const [customHeader, setCustomHeader] = useState(
    extra.customHeader || 'Tax Invoice / Retail Receipt',
  );
  const [customFooter, setCustomFooter] = useState(
    extra.customFooter || 'Thank you for shopping with us! Visit again.',
  );
  const [terms, setTerms] = useState(
    extra.termsAndConditions || 'Goods once sold cannot be returned without original receipt.',
  );

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState<string | null>(
    extra.signatureDataUrl || null,
  );

  // Lucky Image
  const [luckyImage, setLuckyImage] = useState<string | null>(extra.luckyImageUrl || null);

  // Toast
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Save all profile settings
  const handleSaveAll = () => {
    const nextExtra: ExtraProfileFields = {
      contactEmail,
      bankName,
      accountHolder,
      accountNumber,
      ifscCode,
      googleReviewUrl,
      customHeader,
      customFooter,
      termsAndConditions: terms,
      signatureDataUrl: signatureSaved || undefined,
      luckyImageUrl: luckyImage || undefined,
    };

    try {
      localStorage.setItem(STORAGE_EXTRA_KEY, JSON.stringify(nextExtra));

      // Update registered accounts & session registry
      const cleanP = bizPhone.replace(/\D/g, '').slice(-10);
      const rawAccounts = localStorage.getItem('novapos:registered_accounts');
      const accounts = rawAccounts ? JSON.parse(rawAccounts) : {};
      accounts[cleanP] = {
        phone: cleanP,
        storeName: bizName,
        profile: 'kirana',
        pin: bizPin,
      };
      localStorage.setItem('novapos:registered_accounts', JSON.stringify(accounts));
      localStorage.setItem(
        'novapos:user_session',
        JSON.stringify({ phone: cleanP, storeName: bizName, profile: 'kirana', pin: bizPin })
      );
    } catch {
      // ignore
    }

    onUpdateProfile({
      profileName: bizName,
      phone: bizPhone,
      address: bizAddress,
      gstin: bizGstin,
      fssai: bizFssai,
      upiVpa: vpa,
      ...nextExtra,
    });

    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2500);
  };

  // Drawing signature
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1E293B';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureSaved(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setSignatureSaved(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setLuckyImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="ezo-screen-container">
      {/* Exact Ezo Purple App Bar */}
      <div className="ezo-app-bar">
        <button className="ezo-back-btn" onClick={onBack} title="Back">
          <ArrowLeft className="w-6 h-6 text-white" /><span>Back</span></button>
        <div className="ezo-title-group">
          <h1 className="ezo-bar-title">Profile</h1>
          <span className="ezo-bar-sub">FAST v39.31 {bizPhone ? `| +91 ${bizPhone}` : ''}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="ezo-screen-scroll">
        <div className="ezo-profile-content">
          {/* Saved Notification Banner */}
          {showSavedToast && (
            <div className="ezo-success-toast">
              <Check className="w-4 h-4 mr-2" />
              <span>Profile details saved successfully!</span>
            </div>
          )}

          {/* 1. Contact Person Email */}
          <div className="ezo-input-card">
            <input
              type="email"
              placeholder="Contact Person Email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="ezo-field-input"
            />
          </div>

          {/* 2. BUSINESS DETAILS Button Card */}
          <button
            type="button"
            className="ezo-outline-card-btn"
            onClick={() => setActiveModal('business')}
          >
            BUSINESS DETAILS
          </button>

          {/* 3. BANK DETAILS (ACCEPT ONLINE PAYMENTS) Button Card */}
          <button
            type="button"
            className="ezo-outline-card-btn"
            onClick={() => setActiveModal('bank')}
          >
            BANK DETAILS (ACCEPT ONLINE PAYMENTS)
          </button>

          {/* 4. UPI Button Card */}
          <button
            type="button"
            className="ezo-outline-card-btn"
            onClick={() => setActiveModal('upi')}
          >
            UPI
          </button>

          {/* 5. GOOGLE REVIEW LINK / URL Button Card */}
          <button
            type="button"
            className="ezo-outline-card-btn"
            onClick={() => setActiveModal('review')}
          >
            GOOGLE REVIEW LINK / URL
          </button>

          {/* 6. CUSTOM FIELDS Button Card */}
          <button
            type="button"
            className="ezo-outline-card-btn"
            onClick={() => setActiveModal('custom')}
          >
            CUSTOM FIELDS
          </button>

          {/* 7. Signature Box */}
          <div className="ezo-box-section">
            <div className="ezo-box-label-row">
              <label className="ezo-box-label">Signature</label>
              {signatureSaved && (
                <button type="button" onClick={clearSignature} className="ezo-box-action-link">
                  Clear
                </button>
              )}
            </div>
            <div className="ezo-box-surface">
              {signatureSaved ? (
                <div className="ezo-signature-preview-wrap">
                  <img src={signatureSaved} alt="Signature Preview" className="ezo-signature-img" />
                  <button type="button" onClick={clearSignature} className="ezo-btn-icon-clear">
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </button>
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={90}
                  className="ezo-signature-canvas"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              )}
              {!signatureSaved && (
                <span className="ezo-box-hint">Draw your signature here for printed receipts</span>
              )}
            </div>
          </div>

          {/* 8. Lucky Image Box */}
          <div className="ezo-box-section">
            <div className="ezo-box-label-row">
              <label className="ezo-box-label">Lucky Image</label>
              {luckyImage && (
                <button
                  type="button"
                  onClick={() => setLuckyImage(null)}
                  className="ezo-box-action-link"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="ezo-box-surface">
              {luckyImage ? (
                <div className="ezo-image-preview-wrap">
                  <img src={luckyImage} alt="Lucky Logo" className="ezo-lucky-img" />
                  <button
                    type="button"
                    onClick={() => setLuckyImage(null)}
                    className="ezo-btn-icon-clear"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </button>
                </div>
              ) : (
                <label className="ezo-image-upload-trigger">
                  <Upload className="w-6 h-6 text-indigo-400 mb-1" />
                  <span className="text-xs text-slate-500">Tap to upload store logo / image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating SAVE Button (Bottom Right) */}
      <div className="ezo-fab-container">
        <button type="button" onClick={handleSaveAll} className="ezo-save-fab">
          SAVE
        </button>
      </div>

      {/* Modals for Details */}
      {activeModal === 'business' && (
        <div className="ezo-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="ezo-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ezo-modal-header">
              <h3>Business Details</h3>
              <button onClick={() => setActiveModal(null)} className="ezo-modal-close">
                ✕
              </button>
            </div>
            <div className="ezo-modal-body">
              <div className="ezo-form-group">
                <label>Store / Business Name *</label>
                <input
                  type="text"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="ezo-modal-input"
                />
              </div>
              <div className="ezo-form-group">
                <label>Phone Number / User ID *</label>
                <input
                  type="tel"
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  className="ezo-modal-input"
                />
              </div>
              <div className="ezo-form-group">
                <label>4-Digit Store Login PIN *</label>
                <input
                  type="password"
                  maxLength={4}
                  value={bizPin}
                  onChange={(e) => setBizPin(e.target.value.replace(/\D/g, ''))}
                  className="ezo-modal-input font-bold tracking-widest text-center"
                  placeholder="e.g. 1234"
                />
              </div>
              <div className="ezo-form-group">
                <label>Store Address</label>
                <input
                  type="text"
                  value={bizAddress}
                  onChange={(e) => setBizAddress(e.target.value)}
                  className="ezo-modal-input"
                />
              </div>
              <div className="ezo-form-group">
                <label>GSTIN Number</label>
                <input
                  type="text"
                  value={bizGstin}
                  onChange={(e) => setBizGstin(e.target.value)}
                  className="ezo-modal-input"
                  placeholder="36AAAAA0000A1Z5"
                />
              </div>
              <div className="ezo-form-group">
                <label>FSSAI License No.</label>
                <input
                  type="text"
                  value={bizFssai}
                  onChange={(e) => setBizFssai(e.target.value)}
                  className="ezo-modal-input"
                  placeholder="13622011000123"
                />
              </div>
            </div>
            <div className="ezo-modal-footer">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  handleSaveAll();
                }}
                className="ezo-modal-save-btn"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'bank' && (
        <div className="ezo-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="ezo-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ezo-modal-header">
              <h3>Bank Details (Accept Online Payments)</h3>
              <button onClick={() => setActiveModal(null)} className="ezo-modal-close">
                ✕
              </button>
            </div>
            <div className="ezo-modal-body">
              <div className="ezo-form-group">
                <label>Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="ezo-modal-input"
                />
              </div>
              <div className="ezo-form-group">
                <label>Account Holder Name</label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  className="ezo-modal-input"
                />
              </div>
              <div className="ezo-form-group">
                <label>Bank Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="ezo-modal-input"
                />
              </div>
              <div className="ezo-form-group">
                <label>IFSC Code</label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  className="ezo-modal-input"
                />
              </div>
            </div>
            <div className="ezo-modal-footer">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  handleSaveAll();
                }}
                className="ezo-modal-save-btn"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'upi' && (
        <div className="ezo-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="ezo-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ezo-modal-header">
              <h3>UPI Configuration</h3>
              <button onClick={() => setActiveModal(null)} className="ezo-modal-close">
                ✕
              </button>
            </div>
            <div className="ezo-modal-body">
              <div className="ezo-form-group">
                <label>Merchant UPI VPA / ID *</label>
                <input
                  type="text"
                  value={vpa}
                  onChange={(e) => setVpa(e.target.value)}
                  className="ezo-modal-input"
                  placeholder="e.g. 9381563241@upi"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  Dynamic scannable QR code for this UPI ID will print on thermal receipts.
                </span>
              </div>
            </div>
            <div className="ezo-modal-footer">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  handleSaveAll();
                }}
                className="ezo-modal-save-btn"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'review' && (
        <div className="ezo-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="ezo-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ezo-modal-header">
              <h3>Google Review Link / URL</h3>
              <button onClick={() => setActiveModal(null)} className="ezo-modal-close">
                ✕
              </button>
            </div>
            <div className="ezo-modal-body">
              <div className="ezo-form-group">
                <label>Google Business Review URL</label>
                <input
                  type="url"
                  value={googleReviewUrl}
                  onChange={(e) => setGoogleReviewUrl(e.target.value)}
                  className="ezo-modal-input"
                  placeholder="https://g.page/r/your-shop/review"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  Customers can scan review QR code printed at the footer of invoices to rate your business.
                </span>
              </div>
            </div>
            <div className="ezo-modal-footer">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  handleSaveAll();
                }}
                className="ezo-modal-save-btn"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'custom' && (
        <div className="ezo-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="ezo-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ezo-modal-header">
              <h3>Custom Fields & Receipt Notes</h3>
              <button onClick={() => setActiveModal(null)} className="ezo-modal-close">
                ✕
              </button>
            </div>
            <div className="ezo-modal-body">
              <div className="ezo-form-group">
                <label>Invoice Header Note</label>
                <input
                  type="text"
                  value={customHeader}
                  onChange={(e) => setCustomHeader(e.target.value)}
                  className="ezo-modal-input"
                />
              </div>
              <div className="ezo-form-group">
                <label>Invoice Footer Note</label>
                <input
                  type="text"
                  value={customFooter}
                  onChange={(e) => setCustomFooter(e.target.value)}
                  className="ezo-modal-input"
                />
              </div>
              <div className="ezo-form-group">
                <label>Terms & Conditions</label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="ezo-modal-input ezo-modal-textarea"
                  rows={3}
                />
              </div>
            </div>
            <div className="ezo-modal-footer">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  handleSaveAll();
                }}
                className="ezo-modal-save-btn"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
