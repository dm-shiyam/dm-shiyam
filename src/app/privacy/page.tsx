import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-6 py-20">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Back to Home</Link>
          <h1 className="mt-6 text-4xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: June 25, 2025 · Effective: June 25, 2025</p>
          <p className="mt-4 text-gray-600">
            At DM Shiyam, we take your privacy seriously. This Privacy Policy explains what information
            we collect, how we use it, and your rights regarding your data.
          </p>
        </div>

        <div className="space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">1. Who We Are</h2>
            <p>
              DM Shiyam (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is an Instagram automation platform that helps businesses
              and creators automate Direct Messages triggered by keyword comments. We are the data
              controller for the personal data you provide to us.
            </p>
            <div className="mt-3 rounded-lg bg-gray-100 p-4 text-sm">
              <p><strong>Contact:</strong> <a href="mailto:dmshiyam41@gmail.com" className="text-blue-600 hover:underline">dmshiyam41@gmail.com</a></p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">2. Information We Collect</h2>

            <h3 className="mt-4 mb-2 font-semibold text-gray-800">2.1 Information You Provide</h3>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li><strong>Account information:</strong> Name, email address, and password when you register</li>
              <li><strong>Instagram credentials:</strong> Access tokens when you connect your Instagram Business or Creator account via Meta OAuth</li>
              <li><strong>Automation content:</strong> Keywords, DM templates, reply messages, and AI prompts you configure</li>
              <li><strong>Payment information:</strong> Processed entirely by Razorpay — we never store card numbers, CVV, or full payment details</li>
            </ul>

            <h3 className="mt-4 mb-2 font-semibold text-gray-800">2.2 Information Collected Automatically</h3>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li><strong>Activity logs:</strong> Which automations triggered, DM sent/failed status, matched keywords, timestamps</li>
              <li><strong>Instagram user IDs</strong> of commenters (stored to prevent duplicate DMs — not used for any other purpose)</li>
              <li><strong>Comment text</strong> processed in real-time for keyword matching (not stored permanently)</li>
              <li><strong>Webhook events</strong> received from Meta including event type and timestamp</li>
              <li><strong>Usage data:</strong> DMs sent this month, plan usage, feature access</li>
            </ul>

            <h3 className="mt-4 mb-2 font-semibold text-gray-800">2.3 Information We Do NOT Collect</h3>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>Full comment history or Instagram post content</li>
              <li>Private messages or existing DM conversations</li>
              <li>Location data, device identifiers, or IP addresses for tracking</li>
              <li>Any data from Instagram users who have not commented on your posts</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">3. How We Use Your Information</h2>
            <table className="w-full mt-3 text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-3 border border-gray-200 font-semibold">Purpose</th>
                  <th className="text-left p-3 border border-gray-200 font-semibold">Data Used</th>
                  <th className="text-left p-3 border border-gray-200 font-semibold">Legal Basis</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border border-gray-200">Provide the automation service</td>
                  <td className="p-3 border border-gray-200">Instagram tokens, automation config</td>
                  <td className="p-3 border border-gray-200">Contract performance</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200">Prevent duplicate DMs</td>
                  <td className="p-3 border border-gray-200">Instagram user IDs, automation IDs</td>
                  <td className="p-3 border border-gray-200">Legitimate interest</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200">Enforce plan limits & billing</td>
                  <td className="p-3 border border-gray-200">Usage counters, subscription status</td>
                  <td className="p-3 border border-gray-200">Contract performance</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200">Provide analytics & activity logs</td>
                  <td className="p-3 border border-gray-200">Activity log data</td>
                  <td className="p-3 border border-gray-200">Legitimate interest</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200">Send service & billing emails</td>
                  <td className="p-3 border border-gray-200">Email address</td>
                  <td className="p-3 border border-gray-200">Contract performance</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 border border-gray-200">AI Smart Replies (if enabled)</td>
                  <td className="p-3 border border-gray-200">Comment text sent to OpenAI</td>
                  <td className="p-3 border border-gray-200">Consent</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">4. Data Sharing & Third Parties</h2>
            <p>We do not sell, rent, or trade your personal data. We share data only with:</p>

            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800">Meta / Instagram Graph API</h3>
                <p className="mt-1 text-sm">Your access token is sent to Meta solely to send DMs and receive webhook events on your behalf. Subject to <a href="https://developers.facebook.com/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Meta Platform Terms</a>.</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800">Razorpay</h3>
                <p className="mt-1 text-sm">Payment processing. We share your name and email for billing. Card details are handled exclusively by Razorpay. Subject to <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Razorpay Privacy Policy</a>.</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800">OpenAI <span className="text-xs font-normal text-gray-500">(only if AI Smart Replies enabled)</span></h3>
                <p className="mt-1 text-sm">Comment text is sent to OpenAI to generate personalized DM replies. This feature is opt-in per automation and can be disabled at any time. Subject to <a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Privacy Policy</a>.</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800">Legal Requirements</h3>
                <p className="mt-1 text-sm">We may disclose data if required by law, court order, or government authority, or to protect the rights, property, or safety of DM Shiyam, our users, or the public.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">5. Data Security</h2>
            <p>We implement industry-standard security measures to protect your data:</p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>All data transmitted over HTTPS/TLS encryption</li>
              <li>Instagram access tokens masked in all API responses (shown as ••••••••)</li>
              <li>Passwords hashed using bcrypt (never stored in plain text)</li>
              <li>Database access restricted and not publicly exposed</li>
              <li>Webhook requests verified via HMAC-SHA256 signatures</li>
              <li>Session tokens are httpOnly cookies, not accessible to JavaScript</li>
            </ul>
            <p className="mt-3">
              Despite these measures, no system is 100% secure. In the event of a data breach that
              affects your personal data, we will notify you within 72 hours of becoming aware.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">6. Data Retention</h2>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li><strong>Account data:</strong> Retained while your account is active. Deleted within 30 days of account deletion request.</li>
              <li><strong>Activity logs:</strong> Retained for 12 months, then automatically purged.</li>
              <li><strong>Sent DM records:</strong> Retained for 90 days to prevent duplicates, then purged.</li>
              <li><strong>Payment records:</strong> Retained for 7 years as required by Indian financial regulations.</li>
              <li><strong>Comment text:</strong> Processed in memory only, not stored persistently.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">7. Your Rights & Choices</h2>
            <p>You have the following rights regarding your personal data:</p>
            <div className="mt-3 space-y-3">
              {[
                ["Access", "View all data we hold about you via your dashboard or by emailing us."],
                ["Export", "Download your activity logs as CSV from the dashboard at any time."],
                ["Correction", "Update your name, email, or automation content directly from the dashboard."],
                ["Deletion", "Delete your account and all associated data by emailing dmshiyam41@gmail.com. We process requests within 30 days."],
                ["Disconnect Instagram", "Remove any connected Instagram account from the Accounts tab at any time."],
                ["Opt out of AI", "Disable AI Smart Replies per automation from the automation settings."],
                ["Withdraw consent", "Cancel your subscription at any time from account settings."],
              ].map(([right, desc]) => (
                <div key={right} className="flex gap-3">
                  <span className="mt-0.5 text-blue-600 font-semibold text-sm min-w-[110px]">{right}</span>
                  <span className="text-sm text-gray-600">{desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">8. Cookies & Tracking</h2>
            <p>DM Shiyam uses a minimal cookie policy:</p>
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-semibold">Cookie</th>
                    <th className="text-left p-3 font-semibold">Purpose</th>
                    <th className="text-left p-3 font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200">
                    <td className="p-3 font-mono text-xs">next-auth.session-token</td>
                    <td className="p-3">Authentication session</td>
                    <td className="p-3">30 days</td>
                  </tr>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td className="p-3 font-mono text-xs">next-auth.csrf-token</td>
                    <td className="p-3">Security (CSRF protection)</td>
                    <td className="p-3">Session</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              We do <strong>not</strong> use advertising cookies, tracking pixels, Google Analytics,
              or any third-party analytics cookies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">9. Children&apos;s Privacy</h2>
            <p>
              DM Shiyam is not directed to individuals under the age of 18. We do not knowingly
              collect personal data from children. If you believe a child has provided us with
              personal information, please contact us immediately and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">10. International Data Transfers</h2>
            <p>
              DM Shiyam is operated from India. If you access the Service from outside India, your
              data may be transferred to and processed in India. By using the Service, you consent
              to such transfer. When we transfer data to third parties such as OpenAI or Razorpay,
              we rely on their published privacy policies and data processing agreements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. For significant changes, we will notify
              you via email or a prominent notice on the dashboard at least 14 days before the change
              takes effect. The &quot;Last updated&quot; date at the top reflects the most recent revision.
              Continued use after changes constitutes acceptance of the updated Policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">12. Contact & Data Requests</h2>
            <p>For any privacy-related questions, data access requests, or deletion requests:</p>
            <div className="mt-3 rounded-lg bg-gray-100 p-4 text-sm space-y-1">
              <p><strong>DM Shiyam — Privacy Team</strong></p>
              <p>Email: <a href="mailto:dmshiyam41@gmail.com" className="text-blue-600 hover:underline">dmshiyam41@gmail.com</a></p>
              <p>Response time: Within 2 business days for general queries, within 30 days for data requests</p>
            </div>
          </section>

        </div>

        <div className="mt-12 border-t pt-6 flex items-center justify-between text-sm text-gray-400">
          <div className="space-x-4">
            <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
            <Link href="/pricing" className="hover:text-gray-600">Pricing</Link>
            <Link href="/" className="hover:text-gray-600">Home</Link>
          </div>
          <span>© 2025 DM Shiyam</span>
        </div>
      </div>
    </div>
  );
}
