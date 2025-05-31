"use client";

import { useAuth } from "@/app/contexts/AuthContext";
import { env } from "@/app/config/env";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";

interface ReservationDetails {
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
  rating: {
    id: number;
    rating: number;
    comment: string;
    created_at: string;
  } | null;
  penalties?: Array<{
    id: number;
    type: string;
    points: number;
    description: string;
    created_at: string;
    expires_at: string;
    is_active: boolean;
  }>;
}

export default function ReservationDetailsPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const reservationId = params.id as string;

  const [data, setData] = useState<ReservationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [showPenaltyForm, setShowPenaltyForm] = useState(false);
  const [ratingData, setRatingData] = useState({
    rating: 5,
    comment: "",
  });
  const [penaltyData, setPenaltyData] = useState({
    type: "no_show",
    description: "",
  });

  useEffect(() => {
    const fetchReservationDetails = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(
          `${env.API_URL}/admin/reservations/${reservationId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (response.data.success) {
          setData(response.data.data.reservation);
        }
      } catch (err) {
        setError("Failed to fetch reservation details");
        console.error("Reservation details fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservationDetails();
  }, [token, reservationId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-700";
      case "CHECKED_IN":
        return "bg-blue-100 text-blue-700";
      case "PENDING":
        return "bg-blue-100 text-blue-700";
      case "CANCELLED":
        return "bg-yellow-100 text-yellow-700";
      case "NO_SHOW":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
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
          <p className="text-muted">Loading reservation details...</p>
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
          <p className="text-muted">{error || "Failed to load reservation details"}</p>
        </div>
      </div>
    );
  }

  const handleRatingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const response = await axios.post(
        `${env.API_URL}/ratings/admin/ratings`,
        {
          reservation_id: data.id,
          user_id: data.user.id,
          ...ratingData,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setSuccessMessage("Rating submitted successfully");
        setShowRatingForm(false);
        // Refresh reservation data to show new rating
        const updatedResponse = await axios.get(
          `${env.API_URL}/admin/reservations/${reservationId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (updatedResponse.data.success) {
          setData(updatedResponse.data.data.reservation);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to submit rating");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePenaltySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const response = await axios.post(
        `${env.API_URL}/penalties/admin/penalties`,
        {
          user_id: data.user.id,
          reservation_id: data.id,
          ...penaltyData,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setSuccessMessage("Penalty assigned successfully");
        setShowPenaltyForm(false);
        // Refresh reservation data to show new penalty
        const updatedResponse = await axios.get(
          `${env.API_URL}/admin/reservations/${reservationId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (updatedResponse.data.success) {
          setData(updatedResponse.data.data.reservation);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to assign penalty");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{successMessage}</span>
          <button
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setSuccessMessage(null)}
          >
            <svg className="fill-current h-6 w-6 text-green-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <title>Close</title>
              <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
            </svg>
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reservation Details</h1>
          <p className="text-muted">View reservation information and related data</p>
        </div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 px-3 hover:bg-accent hover:text-accent-foreground"
        >
          Back to reservations
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        {data?.status.toUpperCase() === "COMPLETED" && (
          <button
            onClick={() => setShowRatingForm(true)}
            disabled={data?.rating !== null}
            className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              data?.rating
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            }`}
            title={data?.rating ? "This reservation has already been rated" : "Rate this user"}
          >
            {data?.rating ? "Already Rated" : "Rate User"}
          </button>
        )}
        <button
          onClick={() => setShowPenaltyForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Give Penalty
        </button>
      </div>

      {/* Rating Form */}
      {showRatingForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Rate User</h3>
              <form onSubmit={handleRatingSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Rating</label>
                  <select
                    value={ratingData.rating}
                    onChange={(e) => setRatingData({ ...ratingData, rating: parseInt(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>
                        {value} Star{value !== 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Comment</label>
                  <textarea
                    value={ratingData.comment}
                    onChange={(e) => setRatingData({ ...ratingData, comment: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
                    rows={3}
                    placeholder="Add a comment..."
                  />
                </div>
                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => setShowRatingForm(false)}
                    className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Rating"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Penalty Form */}
      {showPenaltyForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Give Penalty</h3>
              <form onSubmit={handlePenaltySubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={penaltyData.type}
                    onChange={(e) => setPenaltyData({ ...penaltyData, type: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="no_show">No Show</option>
                    <option value="late_arrival">Late Arrival</option>
                    <option value="damage">Damage</option>
                    <option value="noise">Noise</option>
                    <option value="unauthorized">Unauthorized Access</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={penaltyData.description}
                    onChange={(e) => setPenaltyData({ ...penaltyData, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
                    rows={3}
                    placeholder="Describe the reason for the penalty..."
                  />
                </div>
                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => setShowPenaltyForm(false)}
                    className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    {isSubmitting ? "Submitting..." : "Give Penalty"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Overview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* User Information */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold mb-4">User Information</h2>
          <div className="space-y-2">
            <div>
              <Link
                href={`/admin/users/${data.user.id}`}
                className="font-medium hover:underline text-lg"
              >
                {data.user.name}
              </Link>
              <div className="text-muted">{data.user.email}</div>
            </div>
          </div>
        </div>

        {/* Space Information */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold mb-4">Space Information</h2>
          <div className="space-y-2">
            <div>
              <div className="font-medium text-lg">{data.space.name}</div>
              <div className="text-muted">{data.space.location}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Details */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold mb-4">Reservation Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-sm text-muted">Status</div>
            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium mt-1 ${getStatusColor(data.status)}`}>
              {data.status.replace(/_/g, " ")}
            </span>
          </div>
          <div>
            <div className="text-sm text-muted">Start Time</div>
            <div className="mt-1">{new Date(data.start_time).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted">End Time</div>
            <div className="mt-1">{new Date(data.end_time).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted">Created At</div>
            <div className="mt-1">{new Date(data.created_at).toLocaleString()}</div>
          </div>
        </div>

        {/* Check-in/out Times */}
        {(data.check_in_time || data.check_out_time) && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="font-medium mb-2">Check-in/out Times</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {data.check_in_time && (
                <div>
                  <div className="text-sm text-muted">Check-in Time</div>
                  <div className="mt-1">
                    {new Date(data.check_in_time).toLocaleString()}
                  </div>
                </div>
              )}
              {data.check_out_time && (
                <div>
                  <div className="text-sm text-muted">Check-out Time</div>
                  <div className="mt-1">
                    {new Date(data.check_out_time).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rating */}
      {data.rating && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold mb-4">Rating</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <span className="font-medium text-lg">{data.rating.rating}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-yellow-400">
                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm">{data.rating.comment}</p>
            <p className="text-sm text-muted">
              Rated on {new Date(data.rating.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Penalties */}
      {data.penalties && data.penalties.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold mb-4">Penalties</h2>
          <div className="space-y-4">
            {data.penalties.map((penalty) => (
              <div key={penalty.id} className="flex items-start justify-between border-b pb-4 last:border-0">
                <div>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getPenaltyTypeColor(penalty.type)}`}>
                    {penalty.type.replace(/_/g, " ")}
                  </span>
                  <p className="mt-1 text-sm">{penalty.description}</p>
                  <p className="text-sm text-muted">
                    Created: {new Date(penalty.created_at).toLocaleDateString()}
                    {" • "}
                    Expires: {new Date(penalty.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  penalty.is_active
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-700"
                }`}>
                  {penalty.points} points
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
