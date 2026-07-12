/**
 * Public data-deletion status page.
 *
 * Displayed at /deletion-status/<confirmation_code> — the URL returned by
 * the Meta data-deletion callback. Users (and Meta reviewers) visit this
 * page to verify their deletion request was processed.
 *
 * Deliberately public: Meta requires it to be reachable without auth so
 * that an ex-user (who has already had their access revoked) can still
 * confirm their data was removed.
 */
import { notFound } from "next/navigation";
import { getDeletionRequest } from "@/lib/db";

// Do not cache — status updates over time from pending → completed.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  not_found: "No data found",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "#d97706", // amber
  completed: "#059669", // emerald
  not_found: "#6b7280", // gray
};

const STATUS_DESCRIPTION: Record<string, string> = {
  pending:
    "Your deletion request has been received and is being processed. This usually completes within a few seconds. Please refresh this page in a moment.",
  completed:
    "All Platform Data associated with your Instagram account has been permanently deleted from DM Shiyam servers.",
  not_found:
    "We received your deletion request, but no DM Shiyam data was found for your Instagram account. Nothing further needs to be deleted.",
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }) + " UTC";
  } catch {
    return iso;
  }
}

export default async function DeletionStatusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Basic sanity — the code we emit is 24 chars alphanumeric. Reject weird
  // inputs early so we don't hit the DB on obvious noise.
  if (!/^[A-Za-z0-9]{8,64}$/.test(code)) {
    notFound();
  }

  const record = await getDeletionRequest(code);
  if (!record) {
    notFound();
  }

  const color = STATUS_COLOR[record.status] ?? "#6b7280";
  const label = STATUS_LABEL[record.status] ?? record.status;
  const description = STATUS_DESCRIPTION[record.status] ?? "";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        color: "#374151",
        padding: "3rem 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "560px",
          margin: "0 auto",
          background: "#fff",
          borderRadius: "12px",
          padding: "2.5rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: "1.4rem",
            fontWeight: 600,
            color: "#111827",
            marginBottom: "0.25rem",
          }}
        >
          Data Deletion Request
        </h1>
        <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "2rem" }}>
          DM Shiyam · Instagram Platform Data
        </p>

        <div
          style={{
            display: "inline-block",
            padding: "0.35rem 0.85rem",
            borderRadius: "999px",
            background: `${color}18`,
            color,
            fontSize: "0.85rem",
            fontWeight: 600,
            marginBottom: "1.25rem",
          }}
        >
          Status: {label}
        </div>

        <p style={{ fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.75rem" }}>
          {description}
        </p>

        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            paddingTop: "1.25rem",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "0.6rem 1rem",
            fontSize: "0.85rem",
          }}
        >
          <span style={{ color: "#9ca3af" }}>Confirmation code</span>
          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
            {record.code}
          </span>

          <span style={{ color: "#9ca3af" }}>Requested at</span>
          <span>{formatTimestamp(record.requested_at)}</span>

          <span style={{ color: "#9ca3af" }}>Completed at</span>
          <span>{formatTimestamp(record.completed_at)}</span>

          {record.status === "completed" && (
            <>
              <span style={{ color: "#9ca3af" }}>Automations removed</span>
              <span>{record.automations_deleted}</span>
              <span style={{ color: "#9ca3af" }}>Activity records removed</span>
              <span>{record.activity_rows_deleted}</span>
            </>
          )}
        </div>

        <p
          style={{
            marginTop: "2rem",
            fontSize: "0.8rem",
            color: "#9ca3af",
            lineHeight: 1.5,
          }}
        >
          For any questions about how your data was handled, contact{" "}
          <a href="mailto:dmshiyamofficial@gmail.com" style={{ color: "#6366f1" }}>
            dmshiyamofficial@gmail.com
          </a>
          . For details on what data we store and process, see our{" "}
          <a href="/privacy" style={{ color: "#6366f1" }}>
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export const metadata = {
  title: "Data Deletion Status | DM Shiyam",
  description:
    "Verify the status of your Instagram data deletion request on DM Shiyam.",
  robots: { index: false, follow: false },
};
