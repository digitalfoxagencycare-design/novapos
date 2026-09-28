import { beforeEach, expect, it } from 'vitest';
import { loadStaffMembers, saveStaffMember, PERMISSION_GROUPS } from './staff';
beforeEach(() => localStorage.clear());
it('does not manufacture a full-access account for an empty store', () => {
  expect(loadStaffMembers()).toEqual([]);
});
it('does not claim to provision login credentials in local storage', () => {
  const result = saveStaffMember({ id: 'a', name: 'Cashier', phone: '9000000001', password: '1234', accessType: 'Cashier', permissions: {}, createdAt: new Date().toISOString() });
  expect(result.success).toBe(false);
  expect(localStorage.getItem('novapos:staff_members')).toBeNull();
});
it('retains the declared permission catalogue for the pending server integration', () => {
  expect(PERMISSION_GROUPS).toHaveLength(18);
  expect(PERMISSION_GROUPS.find(group => group.id === 'report')?.options).toHaveLength(17);
});
