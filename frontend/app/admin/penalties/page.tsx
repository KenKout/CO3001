"use client";

import { useAuth } from "@/app/contexts/AuthContext";
import { env } from "@/app/config/env";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Penalty {
  id: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
  type: string;
  points: number;
  description: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  reservation_id: number | null;
}

interface PenaltiesResponse {
  success: boolean;
  data: {
    penalties: Penalty[];
    total: number;
    page: number;
    per_page: number;
  };
}

export default function PenaltiesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [type, setType] = useState(searchParams.get("type") || "");
  const [isActive, setIsActive] = useState<boolean | null>(
    searchParams.get("is_active") === "true"
      ? true
      : searchParams.get("is_active") === "false"
      ? false
      : null
  );
  const [userId, setUserId] = useState(searchParams.get("user_id") || "");

  // Pagination
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [perPage] = useState(10);

  useEffect(() => {
    const fetchPenalties = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (type) params.append("type", type);
        if (isActive !== null) params.append("is_active", String(isActive));
        if (userId) params.append("user_id", userId);
        params.append("page", String(page));
        params.append("per_page", String(perPage));

        const response = await axios.get<PenaltiesResponse>(
          `${env.API_URL}/admin/penalties?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success) {
          setPenalties(response.data.data.penalties);
          setTotal(response.data.data.total);
        }
      } catch (err) {
        setError("Failed to fetch penalties");
        console.error("Penalties fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPenalties();
  }, [token, type, isActive, userId, page, perPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const params = new URLSearchParams();
    if (type) params.append("type", type);
    if (isActive !== null) params.append("is_active", String(isActive));
    if (userId) params.append("user_id", userId);
    router.push(`/admin/penalties?${params.toString()}`);
  };

  const clearFilters = () => {
    setType("");
    setIsActive(null);
    setUserId("");
    setPage(1);
    router.push("/admin/penalties");
  };

  const getPenaltyTypeColor = (type: string) => {
    switch (type) {
      case "no_show":
        return "bg-red-100 text-red-700";
      case "late_arrival":
        return "bg-yellow-100 text-yellow-700";
      case "damage":
        return "bg-orange-100 text-orange-700";
      case "noise":
        return "bg-yellow-100 text-yellow-700";
      case "unauthorized":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-primary rounded-full animate-spin"></div>
          <p className="text-muted">Loading penalties...</p>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Penalties</h1>
        <p className="text-muted">Manage user penalties and restrictions</p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-muted mb-1">
                Type
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">All types</option>
                <option value="no_show">No Show</option>
                <option value="late_arrival">Late Arrival</option>
                <option value="damage">Damage</option>
                <option value="noise">Noise</option>
                <option value="unauthorized">Unauthorized Access</option>
              </select>
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-muted mb-1">
                Status
              </label>
              <select
                id="status"
                value={isActive === null ? "" : String(isActive)}
                onChange={(e) => setIsActive(e.target.value === "" ? null : e.target.value === "true")}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">All status</option>
                <option value="true">Active</option>
                <option value="false">Expired</option>
              </select>
            </div>
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-muted mb-1">
                User ID
              </label>
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Filter by user ID"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-muted hover:text-foreground"
            >
              Clear filters
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Penalties List */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Points</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Expiry</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {penalties.map((penalty) => (
                <tr key={penalty.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div>
                      <Link
                        href={`/admin/users/${penalty.user.id}`}
                        className="font-medium hover:underline"
                      >
                        {penalty.user.name}
                      </Link>
                      <div className="text-sm text-muted">{penalty.user.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getPenaltyTypeColor(penalty.type)}`}>
                      {penalty.type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{penalty.points}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{penalty.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      penalty.is_active
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {penalty.is_active ? "Active" : "Expired"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {new Date(penalty.expires_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {penalty.reservation_id && (
                        <Link
                          href={`/admin/reservations/${penalty.reservation_id}`}
                          className="text-sm text-muted hover:text-foreground"
                        >
                          View Reservation
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-muted">
            Showing{" "}
            <span className="font-medium">
              {Math.min((page - 1) * perPage + 1, total)}
            </span>{" "}
            to{" "}
            <span className="font-medium">
              {Math.min(page * perPage, total)}
            </span>{" "}
            of <span className="font-medium">{total}</span> penalties
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 px-3 hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page * perPage >= total}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 px-3 hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
