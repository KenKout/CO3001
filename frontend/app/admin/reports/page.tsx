"use client";

import { useAuth } from "@/app/contexts/AuthContext";
import { env } from "@/app/config/env";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface SpaceUtilization {
  space_id: number;
  name: string;
  total_reservations: number;
  reserved_hours: number;
  utilization_rate: number;
}

interface UtilizationReport {
  period: {
    start: string;
    end: string;
  };
  space_utilization: SpaceUtilization[];
  summary: {
    total_spaces: number;
    average_utilization: number;
  };
}

export default function ReportsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<UtilizationReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range
  const [startDate, setStartDate] = useState(
    searchParams.get("start_date") || 
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    searchParams.get("end_date") || 
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    const fetchUtilizationReport = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(
          `${env.API_URL}/admin/reports/utilization`,
          {
            params: {
              start_date: new Date(startDate).toISOString(),
              end_date: new Date(endDate).toISOString(),
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success) {
          setData(response.data.data);
        }
      } catch (err) {
        setError("Failed to fetch utilization report");
        console.error("Report fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUtilizationReport();
  }, [token, startDate, endDate]);

  const handleGenerateReport = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.append("start_date", startDate);
    params.append("end_date", endDate);
    router.push(`/admin/reports?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-muted">Generating report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Space Utilization Report</h1>
        <p className="text-muted">View space usage statistics and generate reports</p>
      </div>

      {/* Date Range Selector */}
      <div className="rounded-lg border bg-card p-4">
        <form onSubmit={handleGenerateReport} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-muted mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-muted mb-1">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Generate Report
            </button>
          </div>
        </form>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted">Total Spaces</div>
          <div className="mt-2 text-2xl font-semibold">
            {data.summary.total_spaces}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted">Average Utilization</div>
          <div className="mt-2 text-2xl font-semibold">
            {data.summary.average_utilization.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Space Utilization Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Space</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Total Reservations</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Reserved Hours</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Utilization Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.space_utilization.map((space) => (
                <tr key={space.space_id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{space.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    {space.total_reservations}
                  </td>
                  <td className="px-4 py-3">
                    {space.reserved_hours.toFixed(1)} hours
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-accent/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${space.utilization_rate}%` }}
                        />
                      </div>
                      <span className="text-sm">
                        {space.utilization_rate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Period */}
      <div className="text-sm text-muted text-center">
        Report period: {new Date(data.period.start).toLocaleDateString()} to{" "}
        {new Date(data.period.end).toLocaleDateString()}
      </div>
    </div>
  );
}
