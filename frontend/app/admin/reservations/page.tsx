"use client";

import { useAuth } from "@/app/contexts/AuthContext";
import { env } from "@/app/config/env";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Reservation {
  id: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
  space: {
    id: number;
    name: string;
    location: string;
  };
  start_time: string;
  end_time: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  created_at: string;
}

interface ReservationsResponse {
  success: boolean;
  data: {
    reservations: Reservation[];
    total: number;
    page: number;
    per_page: number;
  };
}

export default function ReservationsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [userId, setUserId] = useState(searchParams.get("user_id") || "");
  const [spaceId, setSpaceId] = useState(searchParams.get("space_id") || "");

  // Pagination
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [perPage] = useState(10);

  useEffect(() => {
    const fetchReservations = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (status) params.append("status", status);
        if (userId) params.append("user_id", userId);
        if (spaceId) params.append("space_id", spaceId);
        params.append("page", String(page));
        params.append("per_page", String(perPage));

        const response = await axios.get<ReservationsResponse>(
          `${env.API_URL}/admin/reservations?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success) {
          setReservations(response.data.data.reservations);
          setTotal(response.data.data.total);
        }
      } catch (err) {
        setError("Failed to fetch reservations");
        console.error("Reservations fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservations();
  }, [token, status, userId, spaceId, page, perPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (userId) params.append("user_id", userId);
    if (spaceId) params.append("space_id", spaceId);
    router.push(`/admin/reservations?${params.toString()}`);
  };

  const clearFilters = () => {
    setStatus("");
    setUserId("");
    setSpaceId("");
    setPage(1);
    router.push("/admin/reservations");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-700";
      case "CHECKED_IN":
        return "bg-blue-100 text-blue-700";
      case "CONFIRMED":
        return "bg-blue-100 text-blue-700";
      case "CANCELLED":
        return "bg-yellow-100 text-yellow-700";
      case "NO_SHOW":
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
          <p className="text-muted">Loading reservations...</p>
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
        <h1 className="text-2xl font-semibold">Reservations</h1>
        <p className="text-muted">Manage space reservations</p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-muted mb-1">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">All status</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CHECKED_IN">Checked In</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="NO_SHOW">No Show</option>
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
            <div>
              <label htmlFor="spaceId" className="block text-sm font-medium text-muted mb-1">
                Space ID
              </label>
              <input
                type="text"
                id="spaceId"
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                placeholder="Filter by space ID"
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

      {/* Reservations List */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Space</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Time</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Check-in/out</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div>
                      <Link
                        href={`/admin/users/${reservation.user.id}`}
                        className="font-medium hover:underline"
                      >
                        {reservation.user.name}
                      </Link>
                      <div className="text-sm text-muted">{reservation.user.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{reservation.space.name}</div>
                      <div className="text-sm text-muted">{reservation.space.location}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div>{new Date(reservation.start_time).toLocaleString()}</div>
                      <div className="text-muted">to</div>
                      <div>{new Date(reservation.end_time).toLocaleString()}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(reservation.status)}`}>
                      {reservation.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      {reservation.check_in_time && (
                        <div>
                          In: {new Date(reservation.check_in_time).toLocaleTimeString()}
                        </div>
                      )}
                      {reservation.check_out_time && (
                        <div>
                          Out: {new Date(reservation.check_out_time).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/reservations/${reservation.id}`}
                        className="text-sm text-muted hover:text-foreground"
                      >
                        View details
                      </Link>
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
            of <span className="font-medium">{total}</span> reservations
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
