"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

const TALLY_URL = "https://tally.so/r/Gx4xzZ";

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-purple-600 px-5 py-3 text-white shadow-lg transition hover:bg-purple-700"
      >
        <MessageCircle className="h-5 w-5" />
        Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
  <div className="relative h-[75vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">

    <div className="flex items-center justify-between border-b px-5 py-4">
      <h2 className="text-lg font-semibold">
        We'd love your feedback 💜
      </h2>

      <button onClick={() => setOpen(false)}>
        <X className="h-5 w-5" />
      </button>
    </div>

    <iframe
      src={TALLY_URL}
      title="Feedback"
      className="h-[calc(75vh-64px)] w-full border-0"
      loading="lazy"
    />
  </div>
</div>
      )}
    </>
  );
}