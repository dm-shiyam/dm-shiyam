"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { RefreshCw, TrendingUp, Clock, Target, PieChart as PieIcon } from "lucide-react";
import type { AnalyticsData } from "@/types";

const COLORS = ["#ec4899", "#8b5cf6", "#6366f1", "#3b82f6", "#14b8a6", "#f59e0b", "#ef4444", "#10b981"];

export default function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?days=${days}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16 text-gray-400">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading analytics...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card py-16 text-center text-gray-500">
        Failed to load analytics data.
      </div>
    );
  }

  const successRate = data?.success_rate ?? {
  sent: 0,
  failed: 0,
};

const totalDms =
  successRate.sent + successRate.failed;

  const successPercent =
  totalDms === 0
    ? 0
    : Math.round((successRate.sent / totalDms) * 100);

    const dmsOverTime = data?.dms_over_time ?? [];
const topKeywords = data?.top_keywords ?? [];
const hourlyDistribution = data?.hourly_distribution ?? [];
const perAccount = data?.per_account ?? [];


  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Analytics</h2>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                days === d ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card !p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Total DMs</p>
          <p className="mt-1 text-2xl font-bold">{successRate.sent}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Success Rate</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{successPercent}%</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">AI-Generated</p>
          <p className="mt-1 text-2xl font-bold text-purple-600">
            {dmsOverTime.reduce((sum, d) => sum + d.ai_count, 0)}
          </p>
        </div>
        <div className="card !p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Top Keyword</p>
          <p className="mt-1 text-2xl font-bold text-pink-600">
            {topKeywords[0]?.keyword ?? "—"}
          </p>
        </div>
      </div>

      {/* DMs Over Time Chart */}
      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-pink-500" />
          <h3 className="font-semibold">DMs Sent Over Time</h3>
        </div>
        {data.dms_over_time.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.dms_over_time}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(d) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                labelFormatter={(d) => new Date(d).toLocaleDateString("en", { month: "long", day: "numeric" })}
              />
              <Line type="monotone" dataKey="count" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 3 }} name="Total DMs" />
              <Line type="monotone" dataKey="ai_count" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} name="AI Generated" />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-12 text-center text-sm text-gray-400">No data yet for this period.</p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Keywords */}
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-500" />
            <h3 className="font-semibold">Top Keywords</h3>
          </div>
          {topKeywords.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topKeywords} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="keyword" type="category" tick={{ fontSize: 12 }} width={80} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "13px" }} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 6, 6, 0]} name="Triggers" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-gray-400">No keyword data yet.</p>
          )}
        </div>

        {/* Success Rate Pie */}
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-emerald-500" />
            <h3 className="font-semibold">Delivery Success Rate</h3>
          </div>
          {totalDms > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Sent", value: successRate.sent },
                    { name: "Failed", value: successRate.failed },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "13px" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-gray-400">No delivery data yet.</p>
          )}
        </div>
      </div>

      {/* Hourly Activity Heatmap */}
      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold">Activity by Hour (UTC)</h3>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourlyDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10 }}
              tickFormatter={(h) => `${h}:00`}
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "13px" }}
              labelFormatter={(h) => `${h}:00 — ${(h as number) + 1}:00 UTC`}
            />
            <Bar dataKey="count" name="DMs Sent" radius={[4, 4, 0, 0]}>
              {hourlyDistribution.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per Account Breakdown */}
      {perAccount.length > 0 && (
        <div className="card">
          <h3 className="mb-3 font-semibold">DMs by Account</h3>
          <div className="space-y-2">
            {perAccount.map((a, i) => {
              const maxCount = perAccount[0]?.count || 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-28 truncate text-sm font-medium">@{a.username}</span>
                  <div className="flex-1 h-6 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all"
                      style={{ width: `${(a.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-12 text-right">{a.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
