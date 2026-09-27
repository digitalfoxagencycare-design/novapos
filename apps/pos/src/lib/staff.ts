/**
 * Staff Management & Permissions Storage (Max 2 Staff accounts per tenant)
 */

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  password?: string;
  accessType: 'Full Access' | 'Custom Access' | 'Cashier' | 'Manager';
  permissions: Record<string, string[]>;
  createdAt: string;
}

export const PERMISSION_GROUPS = [
  {
    id: 'profile',
    title: 'Profile Permissions',
    options: ['Edit', 'View'],
  },
  {
    id: 'partyPage',
    title: 'Select Party Page Permissions',
    options: ['Hide Phone'],
  },
  {
    id: 'party',
    title: 'Party Permissions',
    options: ['Delete', 'Edit', 'View', 'Create'],
  },
  {
    id: 'partyCategory',
    title: 'Party Category Permissions',
    options: ['Delete', 'Edit', 'View', 'Create'],
  },
  {
    id: 'item',
    title: 'Item Permissions',
    options: ['Delete', 'Edit', 'View', 'Create'],
  },
  {
    id: 'itemCategory',
    title: 'Item Category Permissions',
    options: ['Delete', 'Edit', 'View', 'Create'],
  },
  {
    id: 'itemStockAdjust',
    title: 'Item Stock Adjust Permissions',
    options: ['Adjust'],
  },
  {
    id: 'moneyIn',
    title: 'Money In Permissions',
    options: ['Delete', 'Edit', 'View', 'Create', 'Reprint'],
  },
  {
    id: 'moneyOut',
    title: 'Money Out Permissions',
    options: ['Delete', 'Edit', 'View', 'Create', 'Reprint'],
  },
  {
    id: 'estimate',
    title: 'Estimate Permissions',
    options: ['Delete', 'Edit', 'View', 'Create', 'Reprint'],
  },
  {
    id: 'expense',
    title: 'Expense Permissions',
    options: ['Delete', 'Edit', 'View', 'Create', 'Reprint'],
  },
  {
    id: 'purchase',
    title: 'Purchase Permissions',
    options: ['Delete', 'Edit', 'View', 'Create', 'Reprint'],
  },
  {
    id: 'purchaseReturn',
    title: 'Purchase Return Permissions',
    options: ['Delete', 'View', 'Create', 'Reprint'],
  },
  {
    id: 'sale',
    title: 'Sale Permissions',
    options: ['Delete', 'Edit', 'View', 'Create', 'Reprint'],
  },
  {
    id: 'saleReturn',
    title: 'Sale Return Permissions',
    options: ['Delete', 'View', 'Create', 'Reprint'],
  },
  {
    id: 'kot',
    title: 'Kot Permissions',
    options: ['View'],
  },
  {
    id: 'dashboard',
    title: 'Dashboard Permissions',
    options: [
      'View Sales Total',
      'View Money Ins Total',
      'View Purchases Total',
      'View Money Outs Total',
      'View Receivable Total',
      'View Payable Total',
      'Item Low Stock Count',
      "View Today's Customer",
      "View Today's Loyal Customer",
      "View Today's New Customer",
    ],
  },
  {
    id: 'report',
    title: 'Report Permissions',
    options: [
      'Sale Report',
      'Sale Wise Profit And Loss Report',
      'Purchase Report',
      'Expense Report',
      'Estimate Report',
      'Money In Report',
      'Money Out Report',
      'Party Ledger',
      'Party Details Report',
      'Party Receivable/Payable Report',
      'Stock Summary Report',
      'Item Sale Report',
      'Item Category wise Sale Report',
      'Item Report',
      'Item Details Report',
      'Day Book Report',
      'Cut Off Day Report',
    ],
  },
];

export const FULL_ACCESS_PERMISSIONS: Record<string, string[]> = PERMISSION_GROUPS.reduce(
  (acc, g) => {
    acc[g.id] = [...g.options];
    return acc;
  },
  {} as Record<string, string[]>
);

export const CASHIER_PERMISSIONS: Record<string, string[]> = {
  profile: ['View'],
  partyPage: [],
  party: ['View', 'Create'],
  partyCategory: ['View'],
  item: ['View'],
  itemCategory: ['View'],
  itemStockAdjust: [],
  moneyIn: ['View', 'Create', 'Reprint'],
  moneyOut: ['View'],
  estimate: ['View', 'Create', 'Reprint'],
  expense: ['View', 'Create'],
  purchase: [],
  purchaseReturn: [],
  sale: ['View', 'Create', 'Reprint'],
  saleReturn: ['View', 'Create', 'Reprint'],
  kot: ['View'],
  dashboard: ['View Sales Total', 'View Today\'s Customer'],
  report: ['Sale Report', 'Day Book Report'],
};

const STAFF_STORAGE_KEY = 'novapos:staff_members';

export function loadStaffMembers(): StaffMember[] {
  try {
    const raw = localStorage.getItem(STAFF_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }

  // Initial seed staff
  const initial: StaffMember[] = [
    {
      id: 'staff-1',
      name: 'Vijay',
      phone: '9550249998',
      accessType: 'Full Access',
      permissions: FULL_ACCESS_PERMISSIONS,
      createdAt: new Date().toISOString(),
    },
  ];
  saveStaffMembers(initial);
  return initial;
}

export function saveStaffMembers(staff: StaffMember[]): void {
  try {
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staff.slice(0, 2))); // max 2 staff
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to save staff members', e);
  }
}

export function saveStaffMember(member: StaffMember): { success: boolean; error?: string } {
  const all = loadStaffMembers();
  const existingIdx = all.findIndex((s) => s.id === member.id);

  if (existingIdx >= 0) {
    all[existingIdx] = member;
    saveStaffMembers(all);
    return { success: true };
  }

  if (all.length >= 2) {
    return {
      success: false,
      error: 'Maximum 2 Staff accounts allowed per store subscription. Please edit or delete an existing staff member.',
    };
  }

  all.push(member);
  saveStaffMembers(all);
  return { success: true };
}

export function deleteStaffMember(id: string): void {
  const all = loadStaffMembers();
  const filtered = all.filter((s) => s.id !== id);
  saveStaffMembers(filtered);
}
