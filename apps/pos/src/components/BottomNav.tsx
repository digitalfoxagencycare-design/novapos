import React from 'react';
import {
  Home,
  User,
  Package,
  Sparkles,
  Sliders,
} from 'lucide-react';

export type MainTab =
  | 'dashboard'
  | 'party'
  | 'inventory'
  | 'settings'
  | 'billing'
  | 'calculator'
  | 'tables'
  | 'reports'
  | 'profile';

interface Props {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  cartCount?: number;
}

export const BottomNav: React.FC<Props> = ({
  activeTab,
  onSelectTab,
}) => {
  // 4 Core POS Tabs: Dashboard, Party, Inventory, Settings
  const navTabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home className="w-5 h-5" />,
    },
    {
      id: 'party',
      label: 'Party',
      icon: <User className="w-5 h-5" />,
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: <Package className="w-5 h-5" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Sliders className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="ezo-bottom-nav">
      {navTabs.map((tab) => {
        // If subscreen is active, map appropriately or keep clean
        const isActive =
          activeTab === tab.id ||
          (tab.id === 'party' && activeTab === 'party') ||
          (tab.id === 'inventory' && activeTab === 'inventory') ||
          (tab.id === 'settings' && (activeTab === 'settings' || activeTab === 'profile'));

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`ezo-nav-item ${isActive ? 'active' : ''}`}
          >
            <div className="ezo-nav-icon-wrap">
              {tab.icon}
            </div>
            <span className="ezo-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
