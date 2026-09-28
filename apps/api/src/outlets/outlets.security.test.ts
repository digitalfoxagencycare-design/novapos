import { expect, it, vi } from 'vitest';
import { OutletsService } from './outlets.controller';

it('does not expose privileged merchant operations through the legacy tenant service', async () => {
  const system = vi.fn().mockResolvedValue([]);
  const service = new OutletsService({ system } as any);
  await expect(service.listAllMerchants()).rejects.toMatchObject({ status: 403 });
  await expect(service.activateMerchant('another-tenant')).rejects.toMatchObject({ status: 403 });
  await expect(service.deactivateMerchant('another-tenant')).rejects.toMatchObject({ status: 403 });
  expect(system).not.toHaveBeenCalled();
});
