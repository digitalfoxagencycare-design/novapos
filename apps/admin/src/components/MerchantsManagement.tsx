/** Platform features must not run using a merchant's tenant credentials. */
export function MerchantsManagement({ onError: _onError }: { onError: (message: string) => void }) {
  return (
    <section className="workspace-state" role="status">
      <h1>Platform administration unavailable</h1>
      <p>Merchant onboarding, license extensions and suspension require a separate platform administrator session.</p>
      <p>This portal currently supports store accounts. No merchant changes have been made.</p>
    </section>
  );
}
