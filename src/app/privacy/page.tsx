// app/privacy/page.tsx  (Next.js 14 App Router)

export const metadata = {
  title: "Privacy Policy | DM Shiyam",
  description: "Privacy Policy for DM Shiyam Instagram automation platform.",
};

export default function PrivacyPolicy() {
  const lastUpdated = "July 9, 2025";

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
          Last updated: {lastUpdated}
        </p>

        <Section title="1. About Us">
          <p>
            This Privacy Policy applies to <strong>DM Shiyam</strong> ("we",
            "our", or "us"), an Instagram DM automation platform. For any
            privacy-related queries, contact us at{" "}
            <a
              href="mailto:dmshiyamofficial@gmail.com"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              dmshiyamofficial@gmail.com
            </a>
            .
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Business address: Available upon request.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Account data:</strong> Your name, email address, and
              password (hashed) when you register.
            </li>
            <li>
              <strong>Instagram data:</strong> Your Instagram account ID, access
              tokens, and page connections authorised through Meta's OAuth flow.
            </li>
            <li>
              <strong>Automation data:</strong> Keywords, DM templates, and
              automation rules you configure.
            </li>
            <li>
              <strong>Activity logs:</strong> Records of DMs sent, comments
              triggered, and webhook events processed.
            </li>
            <li>
              <strong>Payment data:</strong> Subscription status processed via
              Razorpay. We do not store card details.
            </li>
            <li>
              <strong>Usage data:</strong> IP address, browser type, and pages
              visited, collected via server logs and cookies.
            </li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul className="list-disc pl-5 space-y-2">
            <li>To provide and operate the DM Shiyam service.</li>
            <li>To authenticate your identity and secure your account.</li>
            <li>
              To send automated DMs on Instagram on your behalf, as configured
              by you.
            </li>
            <li>To process subscription payments.</li>
            <li>
              To send transactional emails (e.g. account alerts, password
              resets).
            </li>
            <li>To comply with legal obligations.</li>
          </ul>
        </Section>

        <Section title="4. Data Retention & Deletion">
          <p>
            We retain your data for as long as your account is active. Activity
            logs (DM history, webhook events) are automatically deleted after{" "}
            <strong>90 days</strong>.
          </p>
          <p className="mt-3">
            You may request full deletion of your account and all associated
            data at any time by emailing{" "}
            <a
              href="mailto:dmshiyamofficial@gmail.com"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              dmshiyamofficial@gmail.com
            </a>
            . We will process deletion requests within <strong>30 days</strong>.
          </p>
          <p className="mt-3">
            Upon account deletion, we remove your personal data, Instagram
            tokens, automations, and activity logs. Anonymised aggregate
            statistics may be retained for internal analytics.
          </p>
        </Section>

        <Section title="5. Cookies & Tracking">
          <p>We use the following types of cookies:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              <strong>Strictly necessary cookies:</strong> Session cookies
              required for authentication and security. These cannot be
              disabled.
            </li>
            <li>
              <strong>Functional cookies:</strong> Cookies that remember your
              preferences (e.g. dark mode). You may disable these via browser
              settings.
            </li>
            <li>
              <strong>Analytics cookies:</strong> We may use anonymised usage
              analytics to improve the platform. No third-party advertising
              cookies are used.
            </li>
          </ul>
          <p className="mt-3">
            On your first visit, you will be shown a cookie consent banner. You
            can withdraw consent at any time by clearing your browser cookies or
            adjusting browser settings.
          </p>
        </Section>

        <Section title="6. Third-Party Services">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Meta (Instagram/Facebook):</strong> We interact with
              Meta's Graph API on your behalf. Your use is subject to{" "}
              <a
                href="https://www.facebook.com/privacy/policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 underline"
              >
                Meta's Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Razorpay:</strong> Payment processing. Subject to{" "}
              <a
                href="https://razorpay.com/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 underline"
              >
                Razorpay's Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Google OAuth:</strong> If you sign in with Google, subject
              to{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 underline"
              >
                Google's Privacy Policy
              </a>
              .
            </li>
          </ul>
        </Section>

        <Section title="7. International Transfers">
          <p>
            DM Shiyam serves users globally. Your data may be processed on
            servers outside your country of residence. Where data is transferred
            from the European Economic Area (EEA), we ensure appropriate
            safeguards are in place in accordance with GDPR Chapter V.
          </p>
        </Section>

        <Section title="8. Your Rights (GDPR & Global)">
          <p>
            Depending on your location, you may have the following rights
            regarding your personal data:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              <strong>Access:</strong> Request a copy of data we hold about you.
            </li>
            <li>
              <strong>Rectification:</strong> Correct inaccurate data.
            </li>
            <li>
              <strong>Erasure:</strong> Request deletion of your data ("right to
              be forgotten").
            </li>
            <li>
              <strong>Restriction:</strong> Ask us to limit how we process your
              data.
            </li>
            <li>
              <strong>Portability:</strong> Receive your data in a
              machine-readable format.
            </li>
            <li>
              <strong>Objection:</strong> Object to processing based on
              legitimate interests.
            </li>
            <li>
              <strong>Withdraw consent:</strong> Where processing is
              consent-based, you may withdraw at any time.
            </li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, email{" "}
            <a
              href="mailto:dmshiyamofficial@gmail.com"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              dmshiyamofficial@gmail.com
            </a>
            . We will respond within 30 days.
          </p>
        </Section>

        <Section title="9. Data Security">
          <p>
            We use industry-standard measures to protect your data including
            HTTPS encryption, hashed passwords, and access-controlled
            infrastructure. However, no system is completely secure and we
            cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="10. Children's Privacy">
          <p>
            DM Shiyam is not intended for users under the age of 13 (or 16 in
            the EU). We do not knowingly collect data from children. If you
            believe a child has provided us data, contact us for immediate
            deletion.
          </p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>
            We may update this policy from time to time. We will notify you of
            significant changes via email or an in-app notice. Continued use of
            the service after changes constitutes acceptance.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            For any privacy concerns, contact{" "}
            <a
              href="mailto:dmshiyamofficial@gmail.com"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              dmshiyamofficial@gmail.com
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 pb-1 border-b border-gray-200 dark:border-gray-800">
        {title}
      </h2>
      <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}