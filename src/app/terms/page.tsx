import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-6 py-20">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Back to Home</Link>
          <h1 className="mt-6 text-4xl font-bold text-gray-900">Terms of Service</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: June 25, 2025 · Effective: June 25, 2025</p>
          <p className="mt-4 text-gray-600">
            Please read these Terms of Service carefully before using DM Shiyam. By creating an account or
            using our Service, you agree to be bound by these Terms.
          </p>
        </div>

        <div className="space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">1. Acceptance of Terms</h2>
            <p>
              These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;User&quot;,
              &quot;you&quot;, or &quot;your&quot;) and DM Shiyam (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) governing your access to and
              use of the DM Shiyam platform, website, and related services (collectively, the &quot;Service&quot;).
            </p>
            <p className="mt-3">
              By clicking &quot;Sign Up&quot;, accessing, or using the Service, you confirm that you have read,
              understood, and agree to be bound by these Terms and our{" "}
              <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
              If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">2. Description of Service</h2>
            <p>
              DM Shiyam is an Instagram automation platform that enables businesses and creators to
              automatically send Direct Messages (DMs) when users comment specific keywords on their
              Instagram posts, stories, or reels. The Service operates exclusively through the official
              Meta Instagram Graph API.
            </p>
            <p className="mt-3">Key features include:</p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>Keyword-triggered automated DM sending</li>
              <li>Comment reply automation</li>
              <li>AI-powered message personalization (optional)</li>
              <li>Multi-account Instagram management</li>
              <li>Activity logging, analytics, and CSV exports</li>
              <li>Scheduled automation windows</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">3. Eligibility & Account Requirements</h2>
            <p>To use DM Shiyam, you must:</p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>Be at least 18 years of age</li>
              <li>Have the legal capacity to enter into a binding contract</li>
              <li>Own or have authorization to manage the Instagram Business or Creator account(s) you connect</li>
              <li>Comply with Instagram&apos;s <a href="https://help.instagram.com/581066165581870" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Platform Policy</a> and <a href="https://help.instagram.com/477434105621119" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Community Guidelines</a></li>
              <li>Comply with Meta&apos;s <a href="https://developers.facebook.com/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Platform Terms</a> and <a href="https://developers.facebook.com/devpolicy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Developer Policies</a></li>
              <li>Not be located in a country subject to applicable trade sanctions or embargoes</li>
            </ul>
            <p className="mt-3">
              You are responsible for maintaining the confidentiality of your account credentials and for all
              activity that occurs under your account.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">4. Acceptable Use Policy</h2>
            <p>You agree to use the Service only for lawful purposes. You must not:</p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>Send unsolicited, spammy, or bulk DMs that violate Meta&apos;s messaging policies</li>
              <li>Use the Service to harass, stalk, threaten, defraud, or abuse any individual</li>
              <li>Automate messages that contain illegal content, hate speech, or adult content</li>
              <li>Attempt to bypass Instagram&apos;s rate limits, API restrictions, or security measures</li>
              <li>Use the Service to collect or harvest personal data of Instagram users without consent</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation</li>
              <li>Resell, sublicense, white-label, or redistribute the Service without written permission</li>
              <li>Reverse-engineer, decompile, disassemble, or attempt to extract source code</li>
              <li>Introduce malware, viruses, or any malicious code into the Service</li>
              <li>Use automated bots to access the Service beyond normal API usage</li>
            </ul>
            <p className="mt-3">
              Violation of this Acceptable Use Policy may result in immediate account suspension or termination
              without refund.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">5. Plans, Billing & Subscriptions</h2>
            <h3 className="mt-4 mb-2 font-semibold">5.1 Plans</h3>
            <p>
              DM Shiyam offers a free tier and paid subscription plans (Starter, Pro, Business, Agency).
              Plan details including DM limits, features, and pricing are described on the{" "}
              <Link href="/pricing" className="text-blue-600 hover:underline">Pricing page</Link>.
            </p>
            <h3 className="mt-4 mb-2 font-semibold">5.2 Payment</h3>
            <p>
              Paid plans are billed on a monthly recurring basis through Razorpay, our payment processor.
              By subscribing, you authorize DM Shiyam to charge your payment method automatically at the
              start of each billing period. All prices are in Indian Rupees (INR) and inclusive of applicable taxes.
            </p>
            <h3 className="mt-4 mb-2 font-semibold">5.3 Cancellation</h3>
            <p>
              You may cancel your subscription at any time from your account settings. Cancellation takes
              effect at the end of your current billing period. You will retain access to paid features
              until the period ends. We do not provide prorated refunds for partial months.
            </p>
            <h3 className="mt-4 mb-2 font-semibold">5.4 Refunds</h3>
            <p>
              Refunds are considered on a case-by-case basis. If you believe you were charged in error,
              or the Service was materially unavailable for an extended period, contact us within 7 days
              of the charge at <strong>dmshiyam41@gmail.com</strong>.
            </p>
            <h3 className="mt-4 mb-2 font-semibold">5.5 Plan Limits</h3>
            <p>
              Each plan includes a monthly DM limit. Usage resets on the 1st of each calendar month.
              Exceeding your plan limit will pause automated DMs until the next reset or until you upgrade.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">6. Instagram API & Meta Compliance</h2>
            <p>
              DM Shiyam operates as a Meta-approved third-party tool using the Instagram Graph API. Your use
              of the Service is subject to Meta&apos;s Platform Terms. You acknowledge that:
            </p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>Meta may change its API, policies, or terms at any time, which may affect Service functionality</li>
              <li>You are solely responsible for ensuring your automations comply with Meta&apos;s policies</li>
              <li>DM Shiyam is not affiliated with, endorsed by, or sponsored by Meta Platforms, Inc.</li>
              <li>Your Instagram access tokens are stored securely and used only to operate your automations</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">7. AI Features</h2>
            <p>
              DM Shiyam optionally offers AI-powered message generation via OpenAI. When enabled on an
              automation, comment text from Instagram users may be sent to OpenAI to generate personalized
              replies. By enabling AI features, you:
            </p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>Consent to sending comment content to OpenAI for processing</li>
              <li>Acknowledge that AI-generated messages may occasionally be inaccurate or inappropriate</li>
              <li>Accept responsibility for reviewing and configuring AI prompts appropriately</li>
            </ul>
            <p className="mt-3">
              You can disable AI features at any time per automation from your dashboard.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">8. Service Availability & SLA</h2>
            <p>
              We target 99.9% monthly uptime for core automation features. However, we do not guarantee
              uninterrupted or error-free service. Scheduled maintenance will be announced with at least
              24 hours notice where possible. Downtime caused by:
            </p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>Meta / Instagram API outages or policy changes</li>
              <li>Force majeure events (natural disasters, government actions, etc.)</li>
              <li>Third-party infrastructure failures (cloud providers, payment processors)</li>
            </ul>
            <p className="mt-2">...is excluded from SLA calculations.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">9. Intellectual Property</h2>
            <p>
              The Service, including its design, code, features, trademarks, and content, is owned by
              DM Shiyam and protected under applicable intellectual property laws. You are granted a
              limited, non-exclusive, non-transferable license to use the Service for its intended purpose
              during your subscription period.
            </p>
            <p className="mt-3">
              You retain ownership of all content you create or provide (automation messages, templates,
              prompts). By using the Service, you grant DM Shiyam a limited license to process this content
              solely to deliver the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">10. Data & Privacy</h2>
            <p>
              Your use of the Service is governed by our{" "}
              <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>,
              which is incorporated into these Terms by reference. By using the Service, you consent to
              the collection and use of information as described in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">11. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR
              A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE.
            </p>
            <p className="mt-3">
              DM Shiyam does not warrant that: (a) the Service will function uninterrupted or error-free;
              (b) any errors will be corrected; (c) the Service is free from viruses or harmful components;
              or (d) results obtained from using the Service will be accurate or reliable.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">12. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, DM SHIYAM SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED
              TO LOSS OF PROFITS, DATA, GOODWILL, BUSINESS OPPORTUNITIES, OR OTHER INTANGIBLE LOSSES,
              ARISING FROM:
            </p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>Your use of or inability to use the Service</li>
              <li>Any unauthorized access to or alteration of your data</li>
              <li>Conduct of third parties including Meta, Razorpay, or OpenAI</li>
              <li>Any content sent via automated DMs</li>
              <li>Account suspension by Meta due to policy violations</li>
            </ul>
            <p className="mt-3">
              Our total cumulative liability shall not exceed the amount you paid to DM Shiyam in the
              three (3) months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">13. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless DM Shiyam and its officers, directors,
              employees, and agents from any claims, damages, losses, liabilities, costs, or expenses
              (including legal fees) arising from: (a) your use of the Service; (b) your violation of
              these Terms; (c) your violation of any third-party rights including Meta&apos;s policies;
              or (d) the content of your automated messages.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">14. Termination</h2>
            <p>
              Either party may terminate the agreement at any time. We reserve the right to suspend or
              permanently terminate your account without notice if you:
            </p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>Violate these Terms or our Acceptable Use Policy</li>
              <li>Engage in fraudulent, abusive, or illegal conduct</li>
              <li>Fail to pay subscription fees</li>
              <li>Have your Instagram account suspended by Meta</li>
            </ul>
            <p className="mt-3">
              Upon termination, your right to access the Service ceases immediately. You may request
              an export of your data within 30 days of termination.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">15. Changes to Terms</h2>
            <p>
              We may update these Terms periodically. For material changes, we will notify you via email
              or a prominent notice within the dashboard at least 14 days before the change takes effect.
              Your continued use of the Service after the effective date constitutes acceptance of the
              revised Terms. If you disagree with the changes, you must stop using the Service and cancel
              your subscription before the effective date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">16. Governing Law & Dispute Resolution</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India, without
              regard to conflict of law principles. Any disputes arising under or related to these Terms
              shall first be attempted to be resolved through good-faith negotiation. If unresolved within
              30 days, disputes shall be subject to the exclusive jurisdiction of courts in India.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">17. Contact Us</h2>
            <p>If you have questions about these Terms, please contact us:</p>
            <div className="mt-3 rounded-lg bg-gray-100 p-4 text-sm">
              <p><strong>DM Shiyam</strong></p>
              <p>Email: <a href="mailto:dmshiyam41@gmail.com" className="text-blue-600 hover:underline">dmshiyam41@gmail.com</a></p>
              <p>Response time: Within 2 business days</p>
            </div>
          </section>

        </div>

        <div className="mt-12 border-t pt-6 flex items-center justify-between text-sm text-gray-400">
          <div className="space-x-4">
            <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
            <Link href="/pricing" className="hover:text-gray-600">Pricing</Link>
            <Link href="/" className="hover:text-gray-600">Home</Link>
          </div>
          <span>© 2025 DM Shiyam</span>
        </div>
      </div>
    </div>
  );
}
