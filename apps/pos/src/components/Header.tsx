import React from 'react';
import {
  Store,
  Printer,
  Wifi,
  WifiOff,
  User,
} from 'lucide-react';
import { TRANSLATIONS } from '../lib/translations';
import { PROFILES, type BusinessProfile } from '../lib/business';

interface Props {
  profile: BusinessProfile;
  onProfileChange: (p: BusinessProfile) => void;
  profileName: string;
  phone?: string;
  online: boolean;
  printerConnected: boolean;
  onOpenPrinterModal: () => void;
  onOpenProfile?: () => void;
}

export const Header: React.FC<Props> = ({
  profile,
  onProfileChange,
  profileName,
  phone = '9381563241',
  online,
  printerConnected,
  onOpenPrinterModal,
  onOpenProfile,
}) => {
  const t = TRANSLATIONS.en;

  return (
    <header className="ezo-main-header">
      {/* Top Mobile Bar Style */}
      <div className="ezo-header-top">
        <div className="ezo-header-brand" onClick={onOpenProfile} title="View Business Profile">
          <Store className="w-5 h-5 text-white mr-2" />
          <div className="ezo-header-brand-info">
            <h1 className="ezo-header-title">{profileName || t.appName}</h1>
            <span className="ezo-header-subtitle">
              FAST v39.31 | {phone} | {PROFILES[profile]}
            </span>
          </div>
        </div>

        <div className="ezo-header-actions">
          {/* Profile Selector */}
          <select
            value={profile}
            onChange={(e) => onProfileChange(e.target.value as BusinessProfile)}
            className="ezo-hdr-select"
            title="Switch Business Profile"
          >
            {Object.entries(PROFILES).map(([k, name]) => (
              <option key={k} value={k}>
                {name}
              </option>
            ))}
          </select>

          {/* Printer Badge */}
          <button
            onClick={onOpenPrinterModal}
            className={`ezo-hdr-pill ${printerConnected ? 'ezo-pill-active' : ''}`}
            title="Thermal Printer Setup"
          >
            <Printer className="w-3.5 h-3.5 mr-1 text-white" />
            <span>58mm</span>
          </button>

          {/* Online Sync Badge */}
          <div className="ezo-hdr-pill" title={online ? 'Online Sync Active' : 'Offline Mode'}>
            {online ? (
              <Wifi className="w-3.5 h-3.5 mr-1 text-emerald-300" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 mr-1 text-rose-300" />
            )}
            <span>{online ? 'Sync' : 'Offline'}</span>
          </div>

          {/* Profile Shortcut */}
          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className="ezo-hdr-pill ezo-pill-icon-only"
              title="Profile Settings"
            >
              <User className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
