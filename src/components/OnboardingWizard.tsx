"use client";

import { useState } from "react";
import { Send, Instagram, Zap, ArrowRight, X, CheckCircle2 } from "lucide-react";

interface Props {
  onClose: () => void;
  onGoToAccounts: () => void;
  onGoToAutomations: () => void;
}

export default function OnboardingWizard({ onClose, onGoToAccounts, onGoToAutomations }: Props) {
  const [step, setStep] = useState(0);

  const finish = async () => {
    try {
      await fetch("/api/onboarding", { method: "POST" });
    } catch {
      // non-blocking, ignore failure
    }
    onClose();
  };

  const steps = [
    {
      icon: Send,
      title: "Welcome to DM Shiyam",
      description:
        "Turn Instagram comments into personalized DMs automatically. Let's get your first automation running in under 2 minutes.",
      action: { label: "Get started", onClick: () => setStep(1) },
    },
    {
  icon: Instagram,
  title: "Connect your Instagram account",
  description:
    "Link your Instagram Business or Creator account so DM Shiyam can detect comments and send DMs on your behalf.",
  action: {
    label: "Connect account",
    onClick: () => {
      onGoToAccounts();
      onClose(); // close the wizard so the user can actually use the Accounts tab
    },
  },
  secondaryAction: { label: "I'll do this later", onClick: () => setStep(2) },
},
    {
      icon: Zap,
      title: "Create your first automation",
      description:
        "Pick a template like \"Lead Magnet\" or \"Discount Code\", set a trigger keyword, and you're live.",
      action: {
  label: "Create automation",
  onClick: () => {
    onGoToAutomations();
    finish();
  },
},
      secondaryAction: { label: "Skip for now", onClick: finish },
    },
  ];

  const current = steps[step];
  const Icon = current.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      style={{ backdropFilter: "blur(2px)" }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-8 shadow-2xl">
        <button
          onClick={finish}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          aria-label="Close onboarding"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress dots */}
        <div className="mb-6 flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-gradient-to-r from-pink-500 to-purple-500" : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 mb-4">
          <Icon className="h-6 w-6 text-white" />
        </div>

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{current.title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{current.description}</p>

        <div className="flex items-center gap-3">
          <button onClick={current.action.onClick} className="btn-primary flex-1">
            {current.action.label} <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {current.secondaryAction && (
          <button
            onClick={current.secondaryAction.onClick}
            className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {current.secondaryAction.label}
          </button>
        )}

        {step === steps.length - 1 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Almost there — this is the last step!
          </div>
        )}
      </div>
    </div>
  );
}