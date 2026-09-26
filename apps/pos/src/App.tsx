import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PrintPreview } from './components/PrintPreview';
import { closeTopPanel } from './lib/navigation';
import { mergeCatalog } from './lib/catalog';
import { loadEzoSettings } from './lib/ezoSettings';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { BottomNav, type MainTab } from './components/BottomNav';
import { SideDrawer } from './components/SideDrawer';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { BillingScreen, type CartLine } from './screens/BillingScreen';
import { CalculatorBillingScreen } from './screens/CalculatorBillingScreen';
import { TablesScreen } from './screens/TablesScreen';
import { KhataScreen } from './screens/KhataScreen';
import { InventoryScreen, type CatalogItem } from './screens/InventoryScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ProfileScreen } from './screens/ProfileScreen';

import {
  type BusinessProfile,
  PROFILES,
  presetCatalog,
} from './lib/business';
import { setupBarcodeScanner } from './lib/hardwareBridge';
import { RestaurantTable } from './lib/restaurant';

const SESSION_KEY = 'novapos:user_session';
const PROFILE_KEY = 'novapos:business_profile';
const PROFILE_DETAILS_KEY = 'novapos:profile_details';
const CUSTOM_ITEMS_KEY = 'novapos:custom_catalog';
const CART_STORAGE_KEY = 'novapos:current_cart';

export interface ProfileDetails {
  profileName: string;
  phone: string;
  address: string;
  gstin: string;
  fssai: string;
  upiVpa: string;
}

interface UserSession {
  phone: string;
  storeName: string;
  profile: BusinessProfile;
  loggedInAt: string;
}

export function App() {
  // 0. User Login / Opening Session (Clear legacy test demo session)
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // If it's the old hardcoded demo account, force fresh login
      if (parsed.phone === '9381563241' && parsed.storeName?.includes('Sri Balaji Kirana')) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  // 1. Active Tab (default Dashboard)
  const [activeTab, setActiveTab] = useState<MainTab>('dashboard');

  // 2. Side Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 3. Business Profile & Details
  const [profile, setProfile] = useState<BusinessProfile>(() => {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      return saved && saved in PROFILES ? (saved as BusinessProfile) : session?.profile || 'kirana';
    } catch {
      return 'kirana';
    }
  });

  const [profileDetails, setProfileDetails] = useState<ProfileDetails>(() => {
    const defaultDetails: ProfileDetails = {
      profileName: session?.storeName || 'My Store',
      phone: session?.phone || '',
      address: '',
      gstin: '',
      fssai: '',
      upiVpa: session?.phone ? `${session.phone}@upi` : '',
    };
    try {
      const raw = localStorage.getItem(PROFILE_DETAILS_KEY);
      return raw ? { ...defaultDetails, ...JSON.parse(raw) } : defaultDetails;
    } catch {
      return defaultDetails;
    }
  });

  // 4. Custom Items Catalog
  const [customItems, setCustomItems] = useState<CatalogItem[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_ITEMS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // 5. Shared Cart State
  const [cart, setCart] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Table context for active restaurant table billing
  const [activeTableContext, setActiveTableContext] = useState<{
    tableNo: string;
    orderType: string;
  } | null>(null);

  // Network State
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const screenRef = useRef(activeTab);
  const drawerRef = useRef(isDrawerOpen);
  screenRef.current = activeTab;
  drawerRef.current = isDrawerOpen;

  const handleNavigate = useCallback((tab: MainTab) => {
    screenRef.current = tab;
    setActiveTab(tab);
    setIsDrawerOpen(false);
  }, []);

  const handleBack = useCallback(() => {
    // 1. Close any open modal or bottom sheet first
    if (closeTopPanel()) return;
    // 2. Close side drawer if open
    if (drawerRef.current) {
      setIsDrawerOpen(false);
      return;
    }
    // 3. Immediately return to Dashboard
    if (screenRef.current !== 'dashboard') {
      screenRef.current = 'dashboard';
      setActiveTab('dashboard');
    }
  }, []);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleBack();
    };
    window.addEventListener('keydown', escape);

    let disposed = false;
    let subscription: { remove: () => Promise<void> } | undefined;

    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('backButton', () => {
        // Priority 1: Top-most modal / sheet
        if (closeTopPanel()) return;
        // Priority 2: Side menu drawer
        if (drawerRef.current) {
          setIsDrawerOpen(false);
          return;
        }
        // Priority 3: Return to Dashboard from any subscreen
        if (screenRef.current !== 'dashboard') {
          screenRef.current = 'dashboard';
          setActiveTab('dashboard');
          return;
        }
        // Priority 4: If already on Dashboard, exit the Android app
        void CapApp.exitApp();
      }).then((listener) => {
        if (disposed) void listener.remove();
        else subscription = listener;
      }).catch(console.error);
    }

    return () => {
      disposed = true;
      void subscription?.remove();
      window.removeEventListener('keydown', escape);
    };
  }, [handleBack]);

  // Login handler
  const handleLoginSuccess = (details: {
    phone: string;
    storeName: string;
    profile: BusinessProfile;
  }) => {
    const newSession: UserSession = {
      phone: details.phone,
      storeName: details.storeName,
      profile: details.profile,
      loggedInAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    } catch {
      // ignore
    }
    setSession(newSession);
    setProfile(details.profile);
    localStorage.setItem(PROFILE_KEY, details.profile);
    handleUpdateProfile({
      profileName: details.storeName,
      phone: details.phone,
    });
    handleNavigate('dashboard');
  };

  // Logout handler
  const handleLogout = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    setSession(null);
    setIsDrawerOpen(false);
  };

  // Save Cart Changes
  const handleUpdateCart = (lines: CartLine[]) => {
    setCart(lines);
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // ignore
    }
  };

  const handleClearCart = () => {
    setCart([]);
    setActiveTableContext(null);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // Switch Business Profile
  const handleProfileChange = (newProfile: BusinessProfile) => {
    if (cart.length && !window.confirm('Changing business type will clear the current unfinished bill. Continue?')) return;
    handleClearCart();
    setProfile(newProfile);
    if (session) {
      const updated = { ...session, profile: newProfile };
      setSession(updated); localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    }
    try {
      localStorage.setItem(PROFILE_KEY, newProfile);
    } catch {
      // ignore
    }

    if (newProfile === 'restaurant' && profileDetails.profileName.includes('Kirana')) {
      handleUpdateProfile({ profileName: 'Hyderabad Biryani & Cafe' });
    } else if (newProfile === 'bakery' && profileDetails.profileName.includes('Kirana')) {
      handleUpdateProfile({ profileName: 'Karachi Bakery & Sweets' });
    } else if (newProfile === 'retail' && profileDetails.profileName.includes('Kirana')) {
      handleUpdateProfile({ profileName: 'Sri Laxmi Garments & Textiles' });
    }
  };

  // Update Profile Details
  const handleUpdateProfile = (updates: Partial<ProfileDetails>) => {
    setProfileDetails((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(PROFILE_DETAILS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Update Custom Items
  const handleUpdateItems = (items: CatalogItem[]) => {
    setCustomItems(items);
    try {
      localStorage.setItem(CUSTOM_ITEMS_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  };

  // Merge preset items with custom items
  const presets = presetCatalog(profile);
  const allCatalogItems = mergeCatalog<CatalogItem>(presets.items, customItems, profile);

  // Handler for settling a restaurant table
  const handleTableSelectedForBilling = (table: RestaurantTable) => {
    if (!table.activeOrder) return;
    const tableLines: CartLine[] = table.activeOrder.lines.map((tl) => ({
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: tl.itemId,
      name: tl.name,
      category: tl.category,
      price: tl.price,
      quantity: tl.quantity,
      uom: (tl.uom as any) || 'pcs',
      isVeg: tl.isVeg,
      notes: tl.notes,
    }));

    handleUpdateCart(tableLines);
    setActiveTableContext({
      tableNo: table.name,
      orderType: table.section === 'Parcel' ? 'Takeaway' : 'Dine-In',
    });
    handleNavigate('billing');
  };

  // If user is not logged in, show the Mobile Login / Opening flow first!
  if (!session) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="pos-app-wrapper">
      {/* Side Slide-Over Navigation Drawer */}
      <SideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeScreen={activeTab}
        onNavigate={(screen) => handleNavigate(screen as MainTab)}
        profile={profile}
        profileName={profileDetails.profileName}
        phone={profileDetails.phone}
        onOpenPrinterModal={() => handleNavigate('settings')}
        onLogout={handleLogout}
      />

      {/* Main Viewport */}
      <main className={`pos-main-content ${['billing', 'calculator', 'tables'].includes(activeTab) ? 'full-screen-flow' : 'has-bottom-nav'}`}>
        {activeTab === 'dashboard' && (
          <DashboardScreen
            profile={profile}
            profileName={profileDetails.profileName}
            phone={profileDetails.phone}
            onOpenMenu={() => setIsDrawerOpen(true)}
            onNavigate={(screen) => handleNavigate(screen as MainTab)}
            onOpenPrinterModal={() => handleNavigate('settings')}
          />
        )}

        {activeTab === 'billing' && (
          <BillingScreen
            language="en"
            profile={profile}
            profileName={profileDetails.profileName}
            phone={profileDetails.phone}
            address={profileDetails.address}
            gstin={profileDetails.gstin}
            fssai={profileDetails.fssai}
            upiVpa={profileDetails.upiVpa}
            items={allCatalogItems}
            cart={cart}
            onUpdateCart={handleUpdateCart}
            onClearCart={handleClearCart}
            tableContext={activeTableContext}
            onBack={handleBack}
          />
        )}

        {activeTab === 'calculator' && (
          <CalculatorBillingScreen
            language="en"
            profileName={profileDetails.profileName}
            phone={profileDetails.phone}
            address={profileDetails.address}
            upiVpa={profileDetails.upiVpa}
            onSaleCompleted={() => {
              // sale completed
            }}
            onBack={handleBack}
          />
        )}

        {activeTab === 'tables' && (
          <TablesScreen
            language="en"
            profileName={profileDetails.profileName}
            onTableSelectedForBilling={handleTableSelectedForBilling}
            onBack={handleBack}
          />
        )}

        {activeTab === 'party' && (
          <KhataScreen
            language="en"
            merchantName={profileDetails.profileName}
            upiVpa={profileDetails.upiVpa}
            onBack={handleBack}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryScreen
            language="en"
            profile={profile}
            onProfileChange={handleProfileChange}
            customItems={customItems}
            onUpdateItems={handleUpdateItems}
            onBack={handleBack}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsScreen
            profileName={profileDetails.profileName}
            phone={profileDetails.phone}
            items={allCatalogItems}
            onBack={handleBack}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            profileName={profileDetails.profileName}
            phone={profileDetails.phone}
            address={profileDetails.address}
            gstin={profileDetails.gstin}
            fssai={profileDetails.fssai}
            upiVpa={profileDetails.upiVpa}
            onUpdateProfile={handleUpdateProfile}
            onBack={handleBack}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsScreen
            profileName={profileDetails.profileName}
            phone={profileDetails.phone}
            address={profileDetails.address}
            gstin={profileDetails.gstin}
            fssai={profileDetails.fssai}
            upiVpa={profileDetails.upiVpa}
            onUpdateProfile={handleUpdateProfile}
            onBack={handleBack}
          />
        )}
      </main>

      <PrintPreview />

      {/* Mobile Bottom Navigation Bar (4 Core Tabs) - Only on primary navigation screens */}
      {['dashboard', 'party', 'inventory', 'settings', 'reports', 'profile'].includes(activeTab) && (
        <BottomNav
          activeTab={activeTab}
          onSelectTab={handleNavigate}
          cartCount={cart.length}
        />
      )}
    </div>
  );
}

export default App;
