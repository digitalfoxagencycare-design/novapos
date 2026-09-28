import React, { useEffect, useState } from 'react';
import { redactLegacyStaffCredentials } from '../lib/staff';

export const StaffScreen: React.FC<{ phone?: string; onBack?: () => void }> = ({ onBack }) => {
  const [error, setError] = useState('');
  useEffect(() => {
    try { redactLegacyStaffCredentials(); }
    catch { setError('Legacy staff credentials could not be cleared from this device. Contact support.'); }
  }, []);
  return <section className="ezo-screen-container p-4 space-y-4">
    <button type="button" onClick={onBack}>Back</button>
    <h1 className="text-xl font-bold">Staff access</h1>
    <p role="status">Staff account setup is unavailable. The authenticated staff service and granular permission enforcement are not connected yet.</p>
    <p>Previously saved local profiles did not create working staff logins. No new account or permission changes will be saved on this device.</p>
    {error && <p role="alert">{error}</p>}
    <a href="tel:+919381563241">Call support: +91 9381563241</a>
  </section>;
};
