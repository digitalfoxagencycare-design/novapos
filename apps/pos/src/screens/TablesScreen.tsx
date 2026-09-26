import { useBackHandler } from '../lib/navigation';
import React, { useState } from 'react';
import {
  UtensilsCrossed,
  Flame,
  CheckCircle2,
  Clock,
  User,
  Plus,
  Printer,
  X,
  CreditCard,
  ChefHat,
  DoorOpen,
  ArrowLeft,
} from 'lucide-react';
import {
  RestaurantTable,
  loadTables,
  saveTables,
  occupyTable,
  fireKotForTable,
  freeTable,
  TableOrderLine,
} from '../lib/restaurant';
import { TRANSLATIONS, type SupportedLanguage } from '../lib/translations';
import { printKotViaBrowser, type KotData } from '../lib/thermalPrinter';

interface Props {
  language: SupportedLanguage;
  profileName: string;
  onTableSelectedForBilling?: (table: RestaurantTable) => void;
  onBack?: () => void;
}

export const TablesScreen: React.FC<Props> = ({
  language,
  profileName,
  onTableSelectedForBilling,
  onBack,
}) => {
  const t = TRANSLATIONS[language];
  const [tables, setTables] = useState<RestaurantTable[]>(loadTables());
  const [activeSection, setActiveSection] = useState<'ALL' | 'AC' | 'Non-AC' | 'Parcel'>('ALL');
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [waiterInput, setWaiterInput] = useState<string>('Captain 1');
  const [customerInput, setCustomerInput] = useState<string>('');

  useBackHandler(Boolean(selectedTable), () => setSelectedTable(null));

  const filteredTables = tables.filter((table) => {
    if (activeSection === 'ALL') return true;
    return table.section === activeSection;
  });

  const handleTableClick = (table: RestaurantTable) => {
    setSelectedTable(table);
    if (table.activeOrder) {
      setWaiterInput(table.activeOrder.waiterName || 'Captain 1');
      setCustomerInput(table.activeOrder.customerName || '');
    }
  };

  const handleOccupy = () => {
    if (!selectedTable) return;
    const updated = occupyTable(selectedTable.id, waiterInput, customerInput);
    if (updated) {
      setTables(loadTables());
      setSelectedTable(updated);
    }
  };

  const handleFireKot = () => {
    if (!selectedTable) return;
    const res = fireKotForTable(selectedTable.id);
    if (res && res.kot) {
      // Print KOT
      const kotData: KotData = {
        restaurantName: profileName || 'NovaPOS Restaurant',
        kotNo: res.kot.kotNo,
        date: new Date().toLocaleDateString('en-IN'),
        time: res.kot.time,
        tableNo: res.table.name,
        orderType: res.table.section === 'Parcel' ? 'Takeaway' : 'Dine-In',
        items: res.kot.items,
      };

      try {
        printKotViaBrowser(kotData, '58mm');
      } catch {
        // ignore
      }

      setTables(loadTables());
      setSelectedTable(res.table);
    }
  };

  const handleSettle = () => {
    if (!selectedTable) return;
    if (onTableSelectedForBilling) {
      onTableSelectedForBilling(selectedTable);
    }
  };

  const handleFreeTable = () => {
    if (!selectedTable) return;
    freeTable(selectedTable.id);
    setTables(loadTables());
    setSelectedTable(null);
  };

  return (
    <div className="tables-screen">
      {/* Top Filter Bar */}
      <div className="tables-header">
        <div className="tables-title-group">
          {onBack && (
            <button
              onClick={onBack}
              className="ezo-back-btn mr-2"
              title="Back to Dashboard"
              aria-label="Back to Dashboard"
            >
              <ArrowLeft className="w-6 h-6 text-white stroke-[2.5]" /><span>Back</span></button>
          )}
          <UtensilsCrossed className="w-6 h-6 text-emerald-400" />
          <div>
            <h2>{t.tables.title}</h2>
            <p className="tables-sub">
              {tables.filter((t) => t.status === 'occupied').length} {t.tables.occupied} ·{' '}
              {tables.filter((t) => t.status === 'vacant').length} {t.tables.vacant}
            </p>
          </div>
        </div>

        <div className="section-tabs">
          {(['ALL', 'AC', 'Non-AC', 'Parcel'] as const).map((sec) => (
            <button
              key={sec}
              onClick={() => setActiveSection(sec)}
              className={`btn-sec-tab ${activeSection === sec ? 'active' : ''}`}
            >
              {sec === 'ALL'
                ? t.billing.categoryAll
                : sec === 'AC'
                ? t.tables.acSection
                : sec === 'Non-AC'
                ? t.tables.nonAcSection
                : t.tables.parcelSection}
            </button>
          ))}
        </div>
      </div>

      {/* Tables Grid */}
      <div className="tables-grid">
        {filteredTables.map((table) => {
          const isOccupied = table.status === 'occupied';
          const isBilled = table.status === 'billed';
          const linesCount = table.activeOrder?.lines.length || 0;
          const kotsCount = table.activeOrder?.kots.length || 0;

          return (
            <div
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`table-card ${table.status}`}
            >
              <div className="table-card-top">
                <span className="table-name">{table.name}</span>
                <span className={`table-badge badge-${table.status}`}>
                  {table.status === 'vacant'
                    ? t.tables.vacant
                    : table.status === 'occupied'
                    ? t.tables.occupied
                    : t.tables.billed}
                </span>
              </div>

              <div className="table-meta">
                <span className="table-sec-pill">{table.section}</span>
                <span className="table-cap">
                  <User className="w-3 h-3 inline mr-1" />
                  {table.capacity}
                </span>
              </div>

              {isOccupied && table.activeOrder && (
                <div className="table-active-summary">
                  <div className="table-timer">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {table.activeOrder.seatedAt}
                  </div>
                  <div className="table-kot-stat">
                    <span>{linesCount} {t.billing.itemsCount}</span> ·{' '}
                    <span>{kotsCount} KOTs</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Table Modal */}
      {selectedTable && (
        <div className="table-modal-overlay">
          <div className="table-modal">
            <div className="modal-header">
              <div className="modal-title-group">
                <h3>{selectedTable.name} ({selectedTable.section})</h3>
                <span className={`table-badge badge-${selectedTable.status}`}>
                  {selectedTable.status === 'vacant'
                    ? t.tables.vacant
                    : selectedTable.status === 'occupied'
                    ? t.tables.occupied
                    : t.tables.billed}
                </span>
              </div>
              <button onClick={() => setSelectedTable(null)} className="btn-close-modal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              {selectedTable.status === 'vacant' ? (
                <div className="vacant-form">
                  <p className="vacant-prompt">
                    Assign a captain and seat guests to begin table order:
                  </p>
                  <div className="form-group">
                    <label>{t.tables.waiter}</label>
                    <input
                      type="text"
                      value={waiterInput}
                      onChange={(e) => setWaiterInput(e.target.value)}
                      placeholder="e.g. Captain 1"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t.billing.customerDetails}</label>
                    <input
                      type="text"
                      value={customerInput}
                      onChange={(e) => setCustomerInput(e.target.value)}
                      placeholder="Customer Name / Mobile (Optional)"
                    />
                  </div>
                  <button onClick={handleOccupy} className="btn-start-order">
                    <DoorOpen className="w-4 h-4 mr-2" />
                    Seat Guests & Take Order
                  </button>
                </div>
              ) : (
                <div className="occupied-view">
                  <div className="order-top-stats">
                    <div>
                      <span className="stat-label">{t.tables.seated}:</span>{' '}
                      <b>{selectedTable.activeOrder?.seatedAt}</b>
                    </div>
                    <div>
                      <span className="stat-label">{t.tables.waiter}:</span>{' '}
                      <b>{selectedTable.activeOrder?.waiterName}</b>
                    </div>
                  </div>

                  {/* KOT History */}
                  <div className="kots-container">
                    <h4>
                      <ChefHat className="w-4 h-4 inline mr-1 text-amber-400" />
                      Kitchen KOTs ({selectedTable.activeOrder?.kots.length || 0})
                    </h4>
                    {selectedTable.activeOrder?.kots.length === 0 ? (
                      <p className="no-kots-text">{t.tables.noActiveOrders}</p>
                    ) : (
                      selectedTable.activeOrder?.kots.map((kot) => (
                        <div key={kot.kotNo} className="kot-item-card">
                          <div className="kot-card-header">
                            <b>{kot.kotNo}</b>
                            <span className="kot-time">{kot.time}</span>
                          </div>
                          <div className="kot-lines-list">
                            {kot.items.map((i, idx) => (
                              <div key={idx} className="kot-line-row">
                                <span>{i.name}</span>
                                <b>x {i.quantity}</b>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Table Action Buttons */}
                  <div className="occupied-actions">
                    <button onClick={handleFireKot} className="btn-action-fire">
                      <Flame className="w-4 h-4 mr-1.5" />
                      {t.tables.fireKot}
                    </button>

                    <button onClick={handleSettle} className="btn-action-settle">
                      <CreditCard className="w-4 h-4 mr-1.5" />
                      {t.tables.settle}
                    </button>

                    <button onClick={handleFreeTable} className="btn-action-free">
                      Free Table
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
