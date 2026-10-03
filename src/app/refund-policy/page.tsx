// app/refund-policy/page.tsx  (Next.js 14 App Router)
//
// Published as part of S5.1.8 (Razorpay live-mode cutover) — Razorpay and
// most Indian payment aggregators require a publicly linked refund /
// cancellation policy before enabling live mode. This page is the canonical
// source; `/terms` §7 and the pricing FAQ link here.

import type { Metadata } from "next";
import Link from "next/link";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata(
  "Refund & Cancellation Policy - DM Shiyam",
  "DM Shiyam's refund and cancellation policy. 7-day refund window, pro-rata refund rules, cancellation flow, and dispute process.",
  "/refund-policy",
  ["refund policy", "cancellation policy", "razorpay refund", "subscription refund"]
);

export default function RefundPolicy() {
  const lastUpdated = "October 3, 2026";

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Refund &amp; Cancellation Policy
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
          Last updated: {lastUpdated}
        </p>

        <Section title="1. Overview">
          <p>
            DM Shiyam is operated by <strong>DM Shiyam</strong>, a
            Udyam-registered proprietorship based in India. Subscription
            payments are processed by <strong>Razorpay</strong> in Indian
            Rupees (₹). This policy explains when you can request a refund,
            how cancellations work, and how long money takes to come back to
            you.
          </p>
          <p className="mt-2">
            This policy is part of our{" "}
            <Link
              href="/terms"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              Terms of Service
            </Link>
            . By subscribing you accept both.
          </p>
        </Section>

        <Section title="2. Free plan">
          <p>
            The Free plan is free forever and does not involve a payment.
            There is nothing to refund. You can stop using it at any time
            without notice.
          </p>
        </Section>

        <Section title="3. 7-day refund window on first paid subscription">
          <p>
            If you&apos;re not happy with your <em>first</em> paid subscription
            (Starter, Pro, Business, or Agency — monthly or yearly), email us
            at{" "}
            <a
              href="mailto:dmshiyamofficial@gmail.com"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              dmshiyamofficial@gmail.com
            </a>{" "}
            within <strong>7 calendar days</strong> of the first successful
            charge and we&apos;ll issue a full refund — no questions asked.
          </p>
          <p className="mt-2">
            Include your account email and the Razorpay payment ID (visible
            in your receipt email) so we can locate the charge quickly.
          </p>
        </Section>

        <Section title="4. Renewals (after the first charge)">
          <p>
            Subscriptions auto-renew. Renewal charges are generally
            non-refundable, but we always try to be fair. If you forgot to
            cancel before a renewal, email us within{" "}
            <strong>72 hours</strong> of the renewal charge and we&apos;ll
            review your request on a case-by-case basis. In most cases where
            no significant usage happened during that billing cycle, we
            refund in full.
          </p>
        </Section>

        <Section title="5. Pro-rata & partial refunds">
          <p>
            We do not pro-rate refunds for the unused portion of a billing
            cycle by default. When you cancel, your plan stays active until
            the end of the cycle you&apos;ve already paid for — you keep the
            paid-for days instead of getting a partial refund.
          </p>
          <p className="mt-2">
            Exceptions where we may issue a partial refund:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              <strong>Service outage &gt; 24 continuous hours</strong> caused
              by us (not Meta API outages, not your Instagram token
              expiring).
            </li>
            <li>
              <strong>Accidental double-charge</strong> or any charge after
              a confirmed cancellation.
            </li>
            <li>
              <strong>Downgrade mid-cycle</strong> on yearly plans where
              there are more than 3 months remaining — contact us for a
              credit against the lower-tier price.
            </li>
          </ul>
        </Section>

        <Section title="6. Non-refundable situations">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Charges where <strong>more than 7 days</strong> have passed
              since the first payment (except as described in sections 4 and
              5).
            </li>
            <li>
              Any plan cancelled solely because you violated our{" "}
              <Link
                href="/terms"
                className="text-indigo-600 dark:text-indigo-400 underline"
              >
                Terms of Service
              </Link>{" "}
              (spam, abuse, Meta policy violations, etc.).
            </li>
            <li>
              Charges after Meta or Instagram revokes your account&apos;s API
              access for reasons unrelated to DM Shiyam.
            </li>
            <li>
              Add-on consumption fees (if any) that have already been used.
            </li>
          </ul>
        </Section>

        <Section title="7. How to cancel">
          <p>You can cancel at any time, in two ways:</p>
          <ol className="list-decimal pl-5 space-y-2 mt-2">
            <li>
              <strong>Self-serve:</strong> open your{" "}
              <Link
                href="/dashboard"
                className="text-indigo-600 dark:text-indigo-400 underline"
              >
                dashboard
              </Link>{" "}
              → click your plan in the top-right → <strong>Cancel subscription</strong>.
              You&apos;ll keep access until the end of the current billing
              cycle, and you will not be charged again.
            </li>
            <li>
              <strong>By email:</strong> write to{" "}
              <a
                href="mailto:dmshiyamofficial@gmail.com"
                className="text-indigo-600 dark:text-indigo-400 underline"
              >
                dmshiyamofficial@gmail.com
              </a>{" "}
              from the email on your account. We confirm cancellations within
              24 hours.
            </li>
          </ol>
          <p className="mt-3">
            There are no cancellation fees and no lock-in period.
          </p>
        </Section>

        <Section title="8. How refunds reach you">
          <p>
            Approved refunds are initiated via Razorpay back to the original
            payment method:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li><strong>UPI:</strong> 2–3 business days</li>
            <li><strong>Credit / debit cards:</strong> 5–7 business days</li>
            <li><strong>Netbanking / wallets:</strong> up to 7 business days</li>
          </ul>
          <p className="mt-3">
            You&apos;ll receive an email from us the moment the refund is
            initiated (with the Razorpay refund ID), and your bank or UPI app
            will notify you separately when the funds land. If more than 10
            business days have passed and you still don&apos;t see the
            refund, forward our confirmation email to{" "}
            <a
              href="mailto:dmshiyamofficial@gmail.com"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              dmshiyamofficial@gmail.com
            </a>{" "}
            and we&apos;ll trace it with Razorpay for you.
          </p>
        </Section>

        <Section title="9. Chargebacks & disputes">
          <p>
            We&apos;d much rather you email us than open a chargeback —
            chargebacks cost both sides fees and take weeks to resolve. If
            you have any issue with a charge, write to{" "}
            <a
              href="mailto:dmshiyamofficial@gmail.com"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              dmshiyamofficial@gmail.com
            </a>{" "}
            first; we aim to resolve legitimate refund requests within 2
            business days.
          </p>
        </Section>

        <Section title="10. GST, invoices & tax">
          <p>
            All prices are inclusive of applicable Indian GST where mandated.
            Razorpay issues a tax invoice for every successful charge, sent
            to the email on your account. Refunds are issued inclusive of
            GST — the equivalent GST portion is returned by Razorpay to the
            tax authority on our behalf.
          </p>
        </Section>

        <Section title="11. Changes to this policy">
          <p>
            We may update this policy from time to time (for example, to
            reflect new regulations or payment methods). Material changes
            will be announced at least 14 days in advance via email to active
            subscribers. The &quot;Last updated&quot; date at the top of this
            page always reflects the current version.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            For any refund or cancellation question:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              Email:{" "}
              <a
                href="mailto:dmshiyamofficial@gmail.com"
                className="text-indigo-600 dark:text-indigo-400 underline"
              >
                dmshiyamofficial@gmail.com
              </a>
            </li>
            <li>Entity: DM Shiyam (Udyam-registered proprietorship, India)</li>
            <li>Response time: within 24 hours on business days</li>
          </ul>
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
