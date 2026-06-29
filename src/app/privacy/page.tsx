export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-4 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="space-y-6 text-gray-700 leading-relaxed">
        <section>
          <h2 className="mb-2 text-xl font-semibold">1. Information We Collect</h2>
          <p>DM Shiyam collects the following information when you use our service:</p>
          <ul className="ml-6 mt-2 list-disc space-y-1">
            <li>Instagram account information (username, account ID) via the official Instagram Graph API</li>
            <li>Comment data on your Instagram posts (for keyword matching)</li>
            <li>Email address and name (for account creation)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">2. How We Use Your Information</h2>
          <p>We use the collected information to:</p>
          <ul className="ml-6 mt-2 list-disc space-y-1">
            <li>Detect keyword matches in Instagram comments</li>
            <li>Send automated Direct Messages on your behalf</li>
            <li>Provide analytics and activity logs</li>
            <li>Manage your account and automations</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">3. Data Storage</h2>
          <p>Your data is stored securely and is not shared with third parties. We use the official Instagram Graph API and comply with Meta&apos;s Platform Terms.</p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">4. Data Deletion</h2>
          <p>You can request deletion of your data at any time by contacting us. When you delete your account, all associated data is permanently removed.</p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">5. Contact</h2>
          <p>For privacy-related questions, contact us at: <strong>dmshiyam41@gmail.com</strong></p>
        </section>
      </div>
    </div>
  );
}
