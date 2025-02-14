"use client";

import { useAuth } from "@/app/contexts/AuthContext";
import { env } from "@/app/config/env";
import axios from "axios";
import { useEffect, useState } from "react";

interface DashboardData {
  overview: {
    total_spaces: number;
    occupied_spaces: number;
    total_reservations_today: number;
    active_users: number;
  };
  penalty_statistics: {
    total_active_penalties: number;
    penalties_by_type: Record<string, number>;
    users_with_restrictions: number;
  };
  rating_statistics: {
    average_rating: number;
    total_ratings: number;
    rating_distribution: Record<string, number>;
  };
  usage_statistics: {
    daily: Array<{
      date: string;
      reservations: number;
      occupancy_rate: number;
    }>;
    popular_spaces: Array<{
      space_id: number;
      name: string;
      usage_count: number;
      average_rating: number;
    }>;
  };
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(`${env.API_URL}/admin/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.data.success) {
          setData(response.data.data);
        }
      } catch (err) {
        setError("Failed to fetch dashboard data");
        console.error("Dashboard fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [token]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-primary rounded-full animate-spin"></div>
          <p className="text-muted">Loading dashboard data...</p>
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
        <h1 className="text-2xl font-semibold">Dashboard Overview</h1>
        <p className="text-muted">Welcome to the admin dashboard</p>
      </div>

      {/* Overview Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
            <span>Total Spaces</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">{data.overview.total_spaces}</p>
          <p className="mt-1 text-sm text-muted">
            {data.overview.occupied_spaces} currently occupied
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span>Today's Reservations</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">
            {data.overview.total_reservations_today}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            <span>Active Users</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">{data.overview.active_users}</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span>Active Penalties</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">
            {data.penalty_statistics.total_active_penalties}
          </p>
          <p className="mt-1 text-sm text-muted">
            {data.penalty_statistics.users_with_restrictions} users restricted
          </p>
        </div>
      </div>

      {/* Rating Statistics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold mb-4">Rating Overview</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted">Average Rating</span>
                <span className="font-medium">{data.rating_statistics.average_rating.toFixed(1)}/5.0</span>
              </div>
              <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${(data.rating_statistics.average_rating / 5) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(data.rating_statistics.rating_distribution)
                .sort((a, b) => Number(b[0]) - Number(a[0]))
                .map(([rating, count]) => (
                  <div key={rating} className="flex items-center gap-2">
                    <span className="text-sm text-muted w-8">{rating}★</span>
                    <div className="flex-1 h-2 bg-accent/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full"
                        style={{
                          width: `${(count / data.rating_statistics.total_ratings) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-muted w-12">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold mb-4">Popular Spaces</h2>
          <div className="space-y-4">
            {data.usage_statistics.popular_spaces.map((space) => (
              <div key={space.space_id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{space.name}</p>
                  <p className="text-sm text-muted">
                    {space.usage_count} reservations • {space.average_rating.toFixed(1)}★
                  </p>
                </div>
                <div className="h-2 w-24 bg-accent/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full"
                    style={{
                      width: `${(space.usage_count / Math.max(...data.usage_statistics.popular_spaces.map(s => s.usage_count))) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Usage Statistics */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold mb-4">Daily Usage</h2>
        <div className="space-y-4">
          {data.usage_statistics.daily.map((day) => (
            <div key={day.date} className="flex items-center gap-4">
              <div className="w-24 text-sm text-muted">
                {new Date(day.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">
                    {day.reservations} reservations
                  </span>
                  <span className="text-sm text-muted">
                    {day.occupancy_rate.toFixed(1)}% occupancy
                  </span>
                </div>
                <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full"
                    style={{
                      width: `${day.occupancy_rate}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
