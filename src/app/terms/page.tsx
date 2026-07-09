// app/terms/page.tsx  (Next.js 14 App Router)

export const metadata = {
  title: "Terms of Service | DM Shiyam",
  description: "Terms of Service for DM Shiyam Instagram automation platform.",
};

export default function TermsOfService() {
  const lastUpdated = "July 9, 2025";

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
          Last updated: {lastUpdated}
        </p>

        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using DM Shiyam ("the Service"), operated by{" "}
            <strong>DM Shiyam</strong>, you agree to be bound by these Terms of
            Service. If you do not agree, do not use the Service.
          </p>
          <p className="mt-2">
            For questions, contact us at{" "}
            <a
              href="mailto:dmshiyamofficial@gmail.com"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              dmshiyamofficial@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="2. Description of Service">
          <p>
            DM Shiyam is an Instagram automation platform that enables users to
            automatically send direct messages in response to comments,
            keywords, or triggers on their Instagram account. The Service
            integrates with Meta's Graph API and Messenger API.
          </p>
        </Section>

        <Section title="3. Eligibility">
          <ul className="list-disc pl-5 space-y-2">
            <li>You must be at least 13 years old (16 in the EU) to use the Service.</li>
            <li>You must have a valid Instagram Business or Creator account.</li>
            <li>
              You must comply with Meta's Terms of Service and Community
              Standards at all times.
            </li>
            <li>
              You represent that all information you provide is accurate and
              complete.
            </li>
          </ul>
        </Section>

        <Section title="4. Account Registration">
          <p>
            You are responsible for maintaining the confidentiality of your
            account credentials. You are liable for all activity that occurs
            under your account. Notify us immediately at{" "}
            <a
              href="mailto:dmshiyamofficial@gmail.com"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              dmshiyamofficial@gmail.com
            </a>{" "}
            if you suspect unauthorised access.
          </p>
        </Section>

        <Section title="5. Acceptable Use">
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>Send spam, unsolicited, or bulk messages.</li>
            <li>
              Harass, abuse, threaten, or impersonate any person or entity.
            </li>
            <li>
              Violate Meta's Platform Policies, Terms of Service, or Community
              Standards.
            </li>
            <li>
              Distribute malware, phishing links, or fraudulent content.
            </li>
            <li>
              Circumvent, disable, or interfere with security features of the
              Service.
            </li>
            <li>
              Use the Service for any unlawful purpose or in violation of any
              applicable law or regulation.
            </li>
            <li>
              Resell, sublicense, or redistribute the Service without written
              consent.
            </li>
          </ul>
          <p className="mt-3">
            We reserve the right to suspend or terminate accounts that violate
            these terms without notice.
          </p>
        </Section>

        <Section title="6. Instagram & Meta Platform Compliance">
          <p>
            DM Shiyam operates via Meta's official APIs. You acknowledge that:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              Your use of Instagram features through our Service is subject to
              Meta's Terms and Policies.
            </li>
            <li>
              We are not affiliated with, endorsed by, or sponsored by Meta
              Platforms, Inc.
            </li>
            <li>
              Meta may revoke API access at any time, which may affect Service
              availability. We are not liable for disruptions caused by Meta
              policy changes.
            </li>
            <li>
              You are solely responsible for the content of messages sent
              through your automations.
            </li>
          </ul>
        </Section>

        <Section title="7. Subscriptions & Payments">
          <p>
            Certain features require a paid subscription processed via
            Razorpay. By subscribing:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              You authorise us to charge your payment method on a recurring
              basis at the selected billing interval.
            </li>
            <li>
              Subscriptions auto-renew unless cancelled before the renewal
              date.
            </li>
            <li>
              Refunds are handled on a case-by-case basis. Contact{" "}
              <a
                href="mailto:dmshiyamofficial@gmail.com"
                className="text-indigo-600 dark:text-indigo-400 underline"
              >
                dmshiyamofficial@gmail.com
              </a>{" "}
              within 7 days of a charge to request a review.
            </li>
            <li>
              Prices are subject to change with 14 days' notice via email.
            </li>
          </ul>
        </Section>

        <Section title="8. Data & Privacy">
          <p>
            Your use of the Service is also governed by our{" "}
            <a
              href="/privacy"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              Privacy Policy
            </a>
            , which is incorporated into these Terms by reference. Activity
            logs are retained for <strong>90 days</strong> and then
            automatically deleted.
          </p>
        </Section>

        <Section title="9. Intellectual Property">
          <p>
            All content, branding, and software comprising the Service are the
            property of DM Shiyam and are protected by applicable intellectual
            property laws. You are granted a limited, non-exclusive,
            non-transferable licence to use the Service for its intended
            purpose.
          </p>
          <p className="mt-2">
            You retain ownership of all content and data you input into the
            Service. By using the Service, you grant us a limited licence to
            process that content solely to operate the Service on your behalf.
          </p>
        </Section>

        <Section title="10. Disclaimers">
          <p>
            The Service is provided "as is" and "as available" without
            warranties of any kind, express or implied. We do not warrant that:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>The Service will be uninterrupted or error-free.</li>
            <li>
              Results obtained from the Service will be accurate or reliable.
            </li>
            <li>
              The Service will meet your specific requirements.
            </li>
          </ul>
        </Section>

        <Section title="11. Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law, DM Shiyam shall
            not be liable for any indirect, incidental, special, consequential,
            or punitive damages arising from your use of or inability to use the
            Service, including but not limited to loss of profits, data, or
            goodwill.
          </p>
          <p className="mt-2">
            Our total liability to you for any claim arising from the Service
            shall not exceed the amount you paid us in the 3 months preceding
            the claim.
          </p>
        </Section>

        <Section title="12. Indemnification">
          <p>
            You agree to indemnify and hold harmless DM Shiyam, its operators,
            and affiliates from any claims, losses, damages, or expenses
            (including legal fees) arising from your use of the Service, your
            violation of these Terms, or your violation of any third-party
            rights.
          </p>
        </Section>

        <Section title="13. Termination">
          <p>
            We may suspend or terminate your access to the Service at any time,
            with or without cause. You may terminate your account at any time by
            contacting{" "}
            <a
              href="mailto:dmshiyamofficial@gmail.com"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              dmshiyamofficial@gmail.com
            </a>
            . Upon termination, your data will be deleted per our{" "}
            <a
              href="/privacy"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              Privacy Policy
            </a>
            .
          </p>
        </Section>

        <Section title="14. Governing Law">
          <p>
            These Terms are governed by and construed in accordance with the
            laws of India. Any disputes shall be subject to the exclusive
            jurisdiction of the courts of India, without prejudice to any
            mandatory consumer protection rights you may have under the laws of
            your country of residence.
          </p>
        </Section>

        <Section title="15. Changes to Terms">
          <p>
            We reserve the right to update these Terms at any time. We will
            notify you of material changes via email or an in-app notice at
            least 14 days before they take effect. Continued use after that
            date constitutes acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="16. Contact">
          <p>
            For any questions about these Terms, contact{" "}
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