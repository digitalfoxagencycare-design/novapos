import { beforeEach, expect, it } from 'vitest';
import { loadStaffMembers, saveStaffMember, PERMISSION_GROUPS } from './staff';

beforeEach(() => localStorage.clear());

it('does not manufacture a full-access account for an empty store', () => {
  expect(loadStaffMembers()).toEqual([]);
});

it('saves staff members and enforces maximum 2 staff accounts limit', () => {
  const staff1 = { id: 's1', name: 'Cashier 1', phone: '9000000001', accessType: 'Cashier' as const, permissions: {}, createdAt: new Date().toISOString() };
  const res1 = saveStaffMember(staff1);
  expect(res1.success).toBe(true);
  expect(loadStaffMembers()).toHaveLength(1);

  const staff2 = { id: 's2', name: 'Cashier 2', phone: '9000000002', accessType: 'Manager' as const, permissions: {}, createdAt: new Date().toISOString() };
  const res2 = saveStaffMember(staff2);
  expect(res2.success).toBe(true);
  expect(loadStaffMembers()).toHaveLength(2);

  const staff3 = { id: 's3', name: 'Cashier 3', phone: '9000000003', accessType: 'Cashier' as const, permissions: {}, createdAt: new Date().toISOString() };
  const res3 = saveStaffMember(staff3);
  expect(res3.success).toBe(false);
  expect(res3.error).toContain('Maximum 2 staff');
  expect(loadStaffMembers()).toHaveLength(2);
});

it('retains the declared permission catalogue with 18 groups', () => {
  expect(PERMISSION_GROUPS).toHaveLength(18);
  expect(PERMISSION_GROUPS.find(group => group.id === 'report')?.options).toHaveLength(17);
});
