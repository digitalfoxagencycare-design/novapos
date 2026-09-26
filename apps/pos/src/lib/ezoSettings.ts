/**
 * The 34 Ezo Billing Settings (2.1 to 2.34)
 * Fully typed, persisted to localStorage, 100% clean English.
 */

export interface EzoSettingDefinition {
  id: string;
  code: string; // e.g. "2.1"
  title: string;
  desc: string;
  category: 'billing' | 'selector' | 'inventory' | 'payment' | 'hardware' | 'security';
  type: 'boolean' | 'select' | 'number';
  options?: { value: string; label: string }[];
  defaultValue: boolean | string | number;
}

export const EZO_34_SETTINGS: EzoSettingDefinition[] = [
  {
    id: 'itemSelectorStyle',
    code: '2.1',
    title: 'Item Selector Style',
    desc: 'Choose how items are displayed during billing (Grid, List, or Compact).',
    category: 'selector',
    type: 'select',
    options: [
      { value: 'grid', label: 'Grid Cards (Visual)' },
      { value: 'list', label: 'List View (Detailed)' },
      { value: 'compact', label: 'Compact Rows (Fast)' },
    ],
    defaultValue: 'grid',
  },
  {
    id: 'itemBarcodeScanner',
    code: '2.2',
    title: 'Item Barcode Scanner',
    desc: 'Enable automatic hardware/camera barcode scanning for adding items.',
    category: 'hardware',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'calculatorBilling',
    code: '2.3',
    title: 'Calculator Billing For Retail',
    desc: 'Direct fast keypad mode (e.g. 50 + 20 = 70) without requiring predefined item lookup.',
    category: 'billing',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'cashSaleByDefault',
    code: '2.4',
    title: 'Cash Sale by Default',
    desc: 'Assume Cash payment mode immediately so 1-tap print completes the sale.',
    category: 'payment',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'amountReceivedByDefault',
    code: '2.5',
    title: 'Amount Received by Default',
    desc: 'Pre-fill the received cash amount with the bill grand total.',
    category: 'payment',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'roundOffAmount',
    code: '2.6',
    title: 'Round Off Amount',
    desc: 'Round bill amounts mathematically to the nearest Rupee (e.g. ₹49.80 -> ₹50.00).',
    category: 'billing',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'askToPrintBill',
    code: '2.7',
    title: 'Ask to Print Bill',
    desc: 'Prompt before triggering the thermal printer, or print automatically upon payment.',
    category: 'hardware',
    type: 'boolean',
    defaultValue: false,
  },
  {
    id: 'askToShareBillOnWhatsApp',
    code: '2.8',
    title: 'Ask to Share Bill on WhatsApp',
    desc: 'Show 1-tap WhatsApp invoice popup when customer phone number is entered.',
    category: 'billing',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'askPaymentModeEveryTime',
    code: '2.9',
    title: 'Ask Payment Mode Every Time',
    desc: 'Explicitly prompt to choose Cash, UPI, Card, or Khata for every bill.',
    category: 'payment',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'printKOTStatus',
    code: '2.10',
    title: 'Print KOT Status',
    desc: 'Automatically route food & beverage orders to kitchen KOT printers.',
    category: 'hardware',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'askKOTPrintEveryTime',
    code: '2.11',
    title: 'Ask KOT Print Every Time',
    desc: 'Prompt cashier before printing duplicate KOT slips on order changes.',
    category: 'billing',
    type: 'boolean',
    defaultValue: false,
  },
  {
    id: 'saveBillAsDraft',
    code: '2.12',
    title: 'Save Bill as Draft',
    desc: 'Hold/park unfinished customer carts and resume them later.',
    category: 'billing',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'printDraftBill',
    code: '2.13',
    title: 'Print Draft Bill (Proforma)',
    desc: 'Allow printing an unconfirmed estimate or table check bill before final settlement.',
    category: 'hardware',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'clearBillOnBackPress',
    code: '2.14',
    title: 'Clear Bill on Back Press',
    desc: 'Warn or automatically clear active cart lines when navigating away.',
    category: 'billing',
    type: 'boolean',
    defaultValue: false,
  },
  {
    id: 'dailyBillNoPrefix',
    code: '2.15',
    title: 'Daily Bill No. Prefix (Reset Token #1 Daily)',
    desc: 'Reset serial invoice tokens back to #1 at start of each business day.',
    category: 'billing',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'allowZeroPriceItem',
    code: '2.16',
    title: 'Allow ₹0 Price Item Billing',
    desc: 'Permit billing promotional samples, gifts, or zero-cost items.',
    category: 'billing',
    type: 'boolean',
    defaultValue: false,
  },
  {
    id: 'allowZeroQuantityItem',
    code: '2.17',
    title: 'Allow 0 Quantity Item',
    desc: 'Prevent cart lines with 0 or negative quantities.',
    category: 'billing',
    type: 'boolean',
    defaultValue: false,
  },
  {
    id: 'enableNegativeStockBilling',
    code: '2.18',
    title: 'Enable Negative Stock Billing',
    desc: 'Continue selling even if inventory level drops below zero.',
    category: 'inventory',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'showStockInBilling',
    code: '2.19',
    title: 'Show Available Stock Count in Billing',
    desc: 'Display real-time remaining inventory badges on each catalog item card.',
    category: 'inventory',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'showCategoryColorInBilling',
    code: '2.20',
    title: 'Show Category Color in Billing',
    desc: 'Color-code category pills and item badges for quick visual distinction.',
    category: 'selector',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'showImageInBilling',
    code: '2.21',
    title: 'Show Item Images in Billing',
    desc: 'Display thumbnail photos on item cards in the catalog grid.',
    category: 'selector',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'showCodeInBilling',
    code: '2.22',
    title: 'Show Short Item Code in Billing',
    desc: 'Display numeric or short alphanumeric codes on item tiles for fast keypad entry.',
    category: 'selector',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'showCustomerInfoDialog',
    code: '2.23',
    title: 'Show Customer Info Dialog',
    desc: 'Prompt for customer phone/name popup on every new bill.',
    category: 'billing',
    type: 'boolean',
    defaultValue: false,
  },
  {
    id: 'alwaysShowPreviousBalance',
    code: '2.24',
    title: 'Always Show Previous Due Balance',
    desc: 'Highlight outstanding Khata credit due prominently when customer phone matches.',
    category: 'payment',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'hideCategoriesFromBilling',
    code: '2.25',
    title: 'Hide Categories Bar from Billing',
    desc: 'Hide category tabs to maximize the grid screen area for high-density item view.',
    category: 'selector',
    type: 'boolean',
    defaultValue: false,
  },
  {
    id: 'lockPriceEditing',
    code: '2.26',
    title: 'Lock Price Editing for Cashiers',
    desc: 'Prevent cashiers from manually altering catalog unit selling prices without PIN.',
    category: 'security',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'lockTaxRateEditing',
    code: '2.27',
    title: 'Lock GST Tax Rate Editing',
    desc: 'Protect GST percentage rates from unauthorized changes during checkout.',
    category: 'security',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'allowDecimalQuantity',
    code: '2.28',
    title: 'Allow Fractional / Decimal Quantity',
    desc: 'Enable fractional quantities (e.g. 0.250 kg, 1.500 liters) for weighed goods.',
    category: 'billing',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'enableBatchExpirySelection',
    code: '2.29',
    title: 'Enable Batch / Expiry Selection',
    desc: 'Prompt to pick specific batch numbers and expiration dates during billing.',
    category: 'inventory',
    type: 'boolean',
    defaultValue: false,
  },
  {
    id: 'enableServiceCharge',
    code: '2.30',
    title: 'Enable Dine-In Service Charge',
    desc: 'Auto-apply optional 5% or 10% restaurant service charge on AC table orders.',
    category: 'billing',
    type: 'boolean',
    defaultValue: false,
  },
  {
    id: 'itemSearchPriority',
    code: '2.31',
    title: 'Item Search Priority',
    desc: 'Determines whether search matches Name, Item Short Code, or Barcode first.',
    category: 'selector',
    type: 'select',
    options: [
      { value: 'name', label: 'Item Name first' },
      { value: 'code', label: 'Item Short Code first' },
      { value: 'barcode', label: 'Barcode first' },
    ],
    defaultValue: 'name',
  },
  {
    id: 'restrictPaymentMode',
    code: '2.32',
    title: 'Restrict Payment Modes for Staff',
    desc: 'Restrict Cashiers from offering Khata (Credit) without manager permission.',
    category: 'security',
    type: 'boolean',
    defaultValue: false,
  },
  {
    id: 'getItemDetailsFromBarcode',
    code: '2.33',
    title: 'Get Item Details from Barcode',
    desc: 'Auto-lookup FMCG item name, brand, and MRP when scanning standard EAN/UPC barcodes.',
    category: 'hardware',
    type: 'boolean',
    defaultValue: true,
  },
  {
    id: 'restrictDiscountsForStaff',
    code: '2.34',
    title: 'Restrict Discounts for Staff',
    desc: 'Require Admin PIN if discount exceeds allowed percentage (e.g. >10%).',
    category: 'security',
    type: 'boolean',
    defaultValue: true,
  },
];

const STORAGE_KEY = 'novapos:ezo_settings';

export type EzoSettingsMap = Record<string, boolean | string | number>;

export function loadEzoSettings(): EzoSettingsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaults: EzoSettingsMap = {};
      for (const s of EZO_34_SETTINGS) {
        defaults[s.id] = s.defaultValue;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    for (const s of EZO_34_SETTINGS) {
      if (parsed[s.id] === undefined) {
        parsed[s.id] = s.defaultValue;
      }
    }
    return parsed;
  } catch {
    const fallback: EzoSettingsMap = {};
    for (const s of EZO_34_SETTINGS) {
      fallback[s.id] = s.defaultValue;
    }
    return fallback;
  }
}

export function saveEzoSettings(settings: EzoSettingsMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to persist ezo settings', err);
  }
}

export function updateEzoSetting(id: string, value: boolean | string | number): EzoSettingsMap {
  const current = loadEzoSettings();
  current[id] = value;
  saveEzoSettings(current);
  return current;
}
