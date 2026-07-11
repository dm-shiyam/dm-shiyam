// "use client";
// import { useState } from "react";
// import Link from "next/link";
// import { Send, Mail, ArrowLeft, CheckCircle } from "lucide-react";
// import { Metadata } from "next";

// export const metadata: Metadata = {
//   title: "Login | DM Shiyam",
//   robots: "noindex, nofollow", // Don't index in search engines
// };


// export default function ForgotPasswordPage() {
//   const [email, setEmail] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [submitted, setSubmitted] = useState(false);
//   const [error, setError] = useState("");

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError("");
//     try {
//       const res = await fetch("/api/auth/forgot-password", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email }),
//       });
//       const data = await res.json();
//       if (data.success) {
//         setSubmitted(true);
//       } else {
//         setError(data.error || "Something went wrong");
//       }
//     } catch {
//       setError("Something went wrong. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center px-4 py-12"
//       style={{ background: "linear-gradient(180deg, #f8f9fb 0%, #eef0f4 100%)" }}>
//       <div className="w-full" style={{ maxWidth: 440 }}>
//         <div className="mb-5 text-center">
//           <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
//             <div className="flex items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600" style={{ width: 40, height: 40 }}>
//               <Send className="h-5 w-5 text-white" />
//             </div>
//             <span className="text-xl font-bold text-gray-900">DM Shiyam</span>
//           </Link>
//           <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
//           <p className="mt-1 text-sm text-gray-500">We'll send you a link to reset it</p>
//         </div>

//         <div className="rounded-2xl bg-white" style={{ border: "1px solid #d1d5db", padding: "28px 32px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
//           {submitted ? (
//             <div className="text-center py-4">
//               <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
//               <p className="font-semibold text-gray-900 mb-1">Check your email</p>
//               <p className="text-sm text-gray-500">
//                 If an account exists for <strong>{email}</strong>, you'll receive a reset link shortly.
//               </p>
//               <p className="text-xs text-gray-400 mt-3">(During dev, check your server console for the link)</p>
//             </div>
//           ) : (
//             <form onSubmit={handleSubmit} className="space-y-4">
//               <div>
//                 <label className="mb-1.5 block text-sm font-semibold text-gray-700">Email</label>
//                 <div className="relative">
//                   <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
//                   <input
//                     type="email"
//                     className="w-full text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-purple-200"
//                     style={{ border: "1.5px solid #9ca3af", borderRadius: 12, padding: "12px 16px 12px 40px", background: "#f9fafb" }}
//                     placeholder="you@example.com"
//                     value={email}
//                     onChange={(e) => setEmail(e.target.value)}
//                     required
//                   />
//                 </div>
//               </div>
//               {error && (
//                 <div style={{ border: "1px solid #fca5a5", borderRadius: 12, padding: "10px 16px", background: "#fef2f2" }} className="text-sm text-red-600">
//                   {error}
//                 </div>
//               )}
//               <button type="submit" disabled={loading} className="btn-primary w-full !rounded-xl !py-3 !text-sm" style={{ marginTop: 8 }}>
//                 {loading ? "Sending..." : "Send reset link"}
//               </button>
//             </form>
//           )}
//         </div>

//         <div className="mt-4 text-center">
//           <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
//             <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
//           </Link>
//         </div>
//       </div>
//     </div>
//   );
// }

import { Metadata } from "next";
import ForgotPasswordComponent from "@/components/auth/ForgotPasswordComponent";

export const metadata: Metadata = {
  title: "Forgot Password | DM Shiyam",
  description: "Reset your DM Shiyam password.",
  robots: "noindex, nofollow",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordComponent />;
}