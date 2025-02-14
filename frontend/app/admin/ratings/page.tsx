"use client";

import { useAuth } from "@/app/contexts/AuthContext";
import { env } from "@/app/config/env";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Rating {
  id: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
  rating: number;
  comment: string;
  created_at: string;
  reservation_id: number;
  rated_by: {
    id: number;
    name: string;
  } | null;
}

interface RatingsResponse {
  success: boolean;
  data: {
    ratings: Rating[];
    total: number;
    page: number;
    per_page: number;
  };
}

export default function RatingsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [ratings, setRatings] = useState<Rating[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [ratingValue, setRatingValue] = useState(searchParams.get("rating") || "");
  const [userId, setUserId] = useState(searchParams.get("user_id") || "");

  // Pagination
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [perPage] = useState(10);

  useEffect(() => {
    const fetchRatings = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (ratingValue) params.append("rating_value", ratingValue);
        if (userId) params.append("user_id", userId);
        params.append("page", String(page));
        params.append("per_page", String(perPage));

        const response = await axios.get<RatingsResponse>(
          `${env.API_URL}/admin/ratings?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success) {
          setRatings(response.data.data.ratings);
          setTotal(response.data.data.total);
        }
      } catch (err) {
        setError("Failed to fetch ratings");
        console.error("Ratings fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRatings();
  }, [token, ratingValue, userId, page, perPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const params = new URLSearchParams();
    if (ratingValue) params.append("rating", ratingValue);
    if (userId) params.append("user_id", userId);
    router.push(`/admin/ratings?${params.toString()}`);
  };

  const clearFilters = () => {
    setRatingValue("");
    setUserId("");
    setPage(1);
    router.push("/admin/ratings");
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "bg-green-100 text-green-700";
    if (rating >= 3) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-primary rounded-full animate-spin"></div>
          <p className="text-muted">Loading ratings...</p>
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
        <h1 className="text-2xl font-semibold">Ratings</h1>
        <p className="text-muted">Manage user ratings and reviews</p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rating" className="block text-sm font-medium text-muted mb-1">
                Rating
              </label>
              <select
                id="rating"
                value={ratingValue}
                onChange={(e) => setRatingValue(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">All ratings</option>
                <option value="5">5 stars</option>
                <option value="4">4 stars</option>
                <option value="3">3 stars</option>
                <option value="2">2 stars</option>
                <option value="1">1 star</option>
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

      {/* Ratings List */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Rating</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Comment</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Rated By</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Date</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ratings.map((rating) => (
                <tr key={rating.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div>
                      <Link
                        href={`/admin/users/${rating.user.id}`}
                        className="font-medium hover:underline"
                      >
                        {rating.user.name}
                      </Link>
                      <div className="text-sm text-muted">{rating.user.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getRatingColor(rating.rating)}`}>
                        {rating.rating}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-yellow-400">
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{rating.comment}</p>
                  </td>
                  <td className="px-4 py-3">
                    {rating.rated_by ? (
                      <Link
                        href={`/admin/users/${rating.rated_by.id}`}
                        className="text-sm text-muted hover:text-foreground"
                      >
                        {rating.rated_by.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {new Date(rating.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/reservations/${rating.reservation_id}`}
                        className="text-sm text-muted hover:text-foreground"
                      >
                        View Reservation
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
            of <span className="font-medium">{total}</span> ratings
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
