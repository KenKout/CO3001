"use client";

import { useAuth } from "@/app/contexts/AuthContext";
import { env } from "@/app/config/env";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface UserDetails {
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    penalty_points: number;
    average_rating: number;
    created_at: string;
    last_login: string;
    is_active: boolean;
    profile_picture: string | null;
  };
  statistics: {
    total_reservations: number;
    completed_reservations: number;
    cancelled_reservations: number;
    no_show_reservations: number;
    completion_rate: number;
    total_penalties: number;
    active_penalties: number;
    total_ratings: number;
    has_restrictions: boolean;
  };
  reservations: {
    recent: Array<{
      id: number;
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
      rating: {
        rating: number;
        comment: string;
      } | null;
    }>;
    total: number;
  };
  penalties: {
    active: Array<{
      id: number;
      type: string;
      points: number;
      description: string;
      created_at: string;
      expires_at: string;
    }>;
    expired: Array<{
      id: number;
      type: string;
      points: number;
      description: string;
      created_at: string;
      expires_at: string;
    }>;
  };
  ratings: {
    received: Array<{
      id: number;
      rating: number;
      comment: string;
      created_at: string;
      reservation_id: number;
    }>;
    total: number;
  };
}

export default function UserDetailsPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [data, setData] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(
          `${env.API_URL}/admin/users/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (response.data.success) {
          setData(response.data.data);
        }
      } catch (err) {
        setError("Failed to fetch user details");
        console.error("User details fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserDetails();
  }, [token, userId]);

  const updateUserRole = async (newRole: string) => {
    try {
      setIsUpdating(true);
      await axios.put(
        `${env.API_URL}/admin/users/${userId}/role`,
        { role: newRole },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      // Refresh data
      router.refresh();
    } catch (err) {
      console.error("Failed to update user role:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const updateUserStatus = async (isActive: boolean) => {
    try {
      setIsUpdating(true);
      await axios.put(
        `${env.API_URL}/admin/users/${userId}/status`,
        { is_active: isActive },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      // Refresh data
      router.refresh();
    } catch (err) {
      console.error("Failed to update user status:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const resetPenalties = async () => {
    try {
      setIsUpdating(true);
      await axios.put(
        `${env.API_URL}/admin/users/${userId}/reset-penalties`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      // Refresh data
      router.refresh();
    } catch (err) {
      console.error("Failed to reset penalties:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-primary rounded-full animate-spin"></div>
          <p className="text-muted">Loading user details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-muted">{error || "Failed to load user details"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{data.user.name}</h1>
          <p className="text-muted">{data.user.email}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 px-3 hover:bg-accent hover:text-accent-foreground"
        >
          Back to users
        </button>
      </div>

      {/* User Actions */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Role
            </label>
            <select
              value={data.user.role}
              onChange={(e) => updateUserRole(e.target.value)}
              disabled={isUpdating}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="STUDENT">Student</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Status
            </label>
            <select
              value={data.user.is_active ? "active" : "inactive"}
              onChange={(e) => updateUserStatus(e.target.value === "active")}
              disabled={isUpdating}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Penalties
            </label>
            <button
              onClick={resetPenalties}
              disabled={isUpdating || data.statistics.active_penalties === 0}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 px-3 bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Reset Penalties
            </button>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-muted text-sm">Reservations</div>
          <div className="mt-2 text-2xl font-semibold">
            {data.statistics.total_reservations}
          </div>
          <div className="mt-1 text-sm text-muted">
            {data.statistics.completion_rate}% completion rate
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-muted text-sm">Active Penalties</div>
          <div className="mt-2 text-2xl font-semibold">
            {data.statistics.active_penalties}
          </div>
          <div className="mt-1 text-sm text-muted">
            {data.statistics.total_penalties} total penalties
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-muted text-sm">Average Rating</div>
          <div className="mt-2 text-2xl font-semibold flex items-center gap-1">
            {data.user.average_rating.toFixed(1)}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-yellow-400">
              <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="mt-1 text-sm text-muted">
            {data.statistics.total_ratings} total ratings
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-muted text-sm">Account Status</div>
          <div className="mt-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                data.user.is_active
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {data.user.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="mt-1 text-sm text-muted">
            Last login:{" "}
            {data.user.last_login
              ? new Date(data.user.last_login).toLocaleDateString()
              : "Never"}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Reservations */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold mb-4">Recent Reservations</h2>
          <div className="space-y-4">
            {data.reservations.recent.map((reservation) => (
              <div key={reservation.id} className="flex items-start justify-between border-b pb-4 last:border-0">
                <div>
                  <p className="font-medium">{reservation.space.name}</p>
                  <p className="text-sm text-muted">{reservation.space.location}</p>
                  <p className="text-sm text-muted">
                    {new Date(reservation.start_time).toLocaleString()} -{" "}
                    {new Date(reservation.end_time).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                    reservation.status === "COMPLETED"
                      ? "bg-green-100 text-green-700"
                      : reservation.status === "CANCELLED"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {reservation.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Penalties */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold mb-4">Active Penalties</h2>
          <div className="space-y-4">
            {data.penalties.active.map((penalty) => (
              <div key={penalty.id} className="flex items-start justify-between border-b pb-4 last:border-0">
                <div>
                  <p className="font-medium">{penalty.type}</p>
                  <p className="text-sm text-muted">{penalty.description}</p>
                  <p className="text-sm text-muted">
                    Expires: {new Date(penalty.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-red-100 text-red-700">
                  {penalty.points} points
                </span>
              </div>
            ))}
            {data.penalties.active.length === 0 && (
              <p className="text-sm text-muted">No active penalties</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Ratings */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold mb-4">Recent Ratings</h2>
        <div className="space-y-4">
          {data.ratings.received.map((rating) => (
            <div key={rating.id} className="flex items-start justify-between border-b pb-4 last:border-0">
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-medium">{rating.rating}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-yellow-400">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm mt-1">{rating.comment}</p>
                <p className="text-sm text-muted mt-1">
                  {new Date(rating.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
          {data.ratings.received.length === 0 && (
            <p className="text-sm text-muted">No ratings received</p>
          )}
        </div>
      </div>
    </div>
  );
}
