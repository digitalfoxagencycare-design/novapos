import React from 'react';
import {
  Home,
  BookOpen,
  Package,
  Plus,
  BarChart3,
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
  return (
    <nav className="ezo-bottom-nav">
      {/* 1. Dashboard */}
      <button
        onClick={() => onSelectTab('dashboard')}
        className={`ezo-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
      >
        <div className="ezo-nav-icon-wrap">
          <Home className="w-5 h-5" />
        </div>
        <span className="ezo-nav-label">Dashboard</span>
      </button>

      {/* 2. Khata / Party */}
      <button
        onClick={() => onSelectTab('party')}
        className={`ezo-nav-item ${activeTab === 'party' ? 'active' : ''}`}
      >
        <div className="ezo-nav-icon-wrap">
          <BookOpen className="w-5 h-5" />
        </div>
        <span className="ezo-nav-label">Khata</span>
      </button>

      {/* 3. Center Vibrant New Bill (+) Action */}
      <button
        onClick={() => onSelectTab('billing')}
        className={`ezo-nav-item ezo-nav-center-bill ${activeTab === 'billing' ? 'active' : ''}`}
        title="Create New Bill"
        aria-label="New Bill"
      >
        <div className="ezo-center-bill-bubble">
          <Plus className="w-6 h-6 text-white stroke-[3]" />
        </div>
        <span className="ezo-nav-label font-bold text-indigo-600">New Bill</span>
      </button>

      {/* 4. Items (formerly Inventory) */}
      <button
        onClick={() => onSelectTab('inventory')}
        className={`ezo-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
      >
        <div className="ezo-nav-icon-wrap">
          <Package className="w-5 h-5" />
        </div>
        <span className="ezo-nav-label">Items</span>
      </button>

      {/* 5. Reports & Analytics */}
      <button
        onClick={() => onSelectTab('reports')}
        className={`ezo-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
      >
        <div className="ezo-nav-icon-wrap">
          <BarChart3 className="w-5 h-5" />
        </div>
        <span className="ezo-nav-label">Reports</span>
      </button>
    </nav>
  );
};
