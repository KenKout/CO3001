"use client";

import { useAuth } from "@/app/contexts/AuthContext";
import { env } from "@/app/config/env";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Notification {
  id: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
  type: string;
  message: string;
  created_at: string;
  is_read: boolean;
  reference_id: number | null;
  reference_type: string | null;
}

interface NotificationsResponse {
  success: boolean;
  data: {
    notifications: Notification[];
    total: number;
    page: number;
    per_page: number;
  };
}

export default function NotificationsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [type, setType] = useState(searchParams.get("type") || "");
  const [isRead, setIsRead] = useState<boolean | null>(
    searchParams.get("is_read") === "true"
      ? true
      : searchParams.get("is_read") === "false"
      ? false
      : null
  );
  const [userId, setUserId] = useState(searchParams.get("user_id") || "");

  // Pagination
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [perPage] = useState(10);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (type) params.append("type", type);
        if (isRead !== null) params.append("is_read", String(isRead));
        if (userId) params.append("user_id", userId);
        params.append("page", String(page));
        params.append("per_page", String(perPage));

        const response = await axios.get<NotificationsResponse>(
          `${env.API_URL}/admin/notifications?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success) {
          setNotifications(response.data.data.notifications);
          setTotal(response.data.data.total);
        }
      } catch (err) {
        setError("Failed to fetch notifications");
        console.error("Notifications fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
  }, [token, type, isRead, userId, page, perPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const params = new URLSearchParams();
    if (type) params.append("type", type);
    if (isRead !== null) params.append("is_read", String(isRead));
    if (userId) params.append("user_id", userId);
    router.push(`/admin/notifications?${params.toString()}`);
  };

  const clearFilters = () => {
    setType("");
    setIsRead(null);
    setUserId("");
    setPage(1);
    router.push("/admin/notifications");
  };

  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case "RESERVATION_CONFIRMATION":
        return "bg-blue-100 text-blue-700";
      case "RESERVATION_CANCELLED":
        return "bg-yellow-100 text-yellow-700";
      case "PENALTY_NOTIFICATION":
        return "bg-red-100 text-red-700";
      case "RATING_RECEIVED":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-muted">Loading notifications...</p>
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
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-muted">Manage system notifications</p>
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
                <option value="RESERVATION_CONFIRMATION">Reservation Confirmation</option>
                <option value="RESERVATION_CANCELLED">Reservation Cancelled</option>
                <option value="PENALTY_NOTIFICATION">Penalty</option>
                <option value="RATING_RECEIVED">Rating</option>
              </select>
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-muted mb-1">
                Status
              </label>
              <select
                id="status"
                value={isRead === null ? "" : String(isRead)}
                onChange={(e) => setIsRead(e.target.value === "" ? null : e.target.value === "true")}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">All status</option>
                <option value="true">Read</option>
                <option value="false">Unread</option>
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

      {/* Notifications List */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Message</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Date</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notification) => (
                <tr key={notification.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{notification.user.name}</div>
                      <div className="text-sm text-muted">{notification.user.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getNotificationTypeColor(notification.type)}`}>
                      {notification.type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{notification.message}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      notification.is_read
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {notification.is_read ? "Read" : "Unread"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {new Date(notification.created_at).toLocaleString()}
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
            of <span className="font-medium">{total}</span> notifications
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
