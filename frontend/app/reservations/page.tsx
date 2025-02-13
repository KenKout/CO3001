"use client";

import { useEffect, useState } from "react";
import { env } from "../config/env";
import { useAuth, withAuth } from "@/app/contexts/AuthContext";

interface Space {
  id: number;
  name: string;
  location: string;
}

interface Reservation {
  id: number;
  space: Space;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show";
  qr_code?: string;
  check_in_time?: string;
  check_out_time?: string;
  notes?: string;
  is_rated: boolean;
}

interface ReservationResponse {
  success: boolean;
  data: {
    reservations: Reservation[];
    total: number;
    page: number;
    per_page: number;
  };
}

function ReservationsPage() {
  const { token } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      let url = `${env.API_URL}/reservations?page=${page}`;
      if (selectedStatus) url += `&status=${selectedStatus}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to fetch reservations");
      }

      const data: ReservationResponse = await response.json();
      setReservations(data.data.reservations);
      setTotalPages(Math.ceil(data.data.total / data.data.per_page));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [page, selectedStatus, token]);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: Reservation["status"]) => {
    switch (status) {
      case "confirmed":
        return "text-blue-500 bg-blue-50 dark:bg-blue-950 dark:text-blue-400";
      case "checked_in":
        return "text-green-500 bg-green-50 dark:bg-green-950 dark:text-green-400";
      case "completed":
        return "text-purple-500 bg-purple-50 dark:bg-purple-950 dark:text-purple-400";
      case "cancelled":
        return "text-red-500 bg-red-50 dark:bg-red-950 dark:text-red-400";
      case "no_show":
        return "text-yellow-500 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400";
      default:
        return "text-muted bg-muted/10";
    }
  };

  const handleAction = async (action: 'check-in' | 'check-out' | 'cancel') => {
    if (!selectedReservation) return;

    try {
      setActionLoading(true);
      setActionError(null);
      setActionSuccess(false);

      const method = action === 'cancel' ? 'DELETE' : 'POST';
      const endpoint = action === 'cancel' 
        ? `${env.API_URL}/reservations/${selectedReservation.id}`
        : `${env.API_URL}/reservations/${selectedReservation.id}/${action}`;

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || `Failed to ${action} reservation`);
      }

      setActionSuccess(true);
      // Close modal after a short delay to show success state
      setTimeout(() => {
        setIsModalOpen(false);
        fetchReservations();
      }, 1500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} reservation`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReservationClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setIsModalOpen(true);
    setActionError(null);
    setActionSuccess(false);
  };

  const closeModal = () => {
    if (!actionLoading) {
      setIsModalOpen(false);
      setActionError(null);
      setActionSuccess(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="flex items-center justify-center">
          <svg 
            className="animate-spin h-8 w-8 text-muted" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-h-[calc(100vh-3.5rem)] px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold">My Reservations</h1>
        <select
          className="h-11 px-3 rounded-[var(--radius)] border bg-background text-foreground"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="checked_in">Checked In</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
      </div>

      {/* Reservations List */}
      <div className="space-y-4">
        {reservations.map((reservation) => (
          <div
            key={reservation.id}
            onClick={() => handleReservationClick(reservation)}
            className="border rounded-[var(--radius)] p-6 bg-background hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-foreground">{reservation.space.name}</h3>
              <span
                className={`px-3 py-1 rounded-full text-sm ${getStatusColor(
                  reservation.status
                )}`}
              >
                {reservation.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Location:</span>{" "}
                <span className="text-muted">{reservation.space.location}</span>
              </p>
              <p>
                <span className="font-medium">Start:</span>{" "}
                <span className="text-muted">{formatDateTime(reservation.start_time)}</span>
              </p>
              <p>
                <span className="font-medium">End:</span>{" "}
                <span className="text-muted">{formatDateTime(reservation.end_time)}</span>
              </p>
              {reservation.check_in_time && (
                <p>
                  <span className="font-medium">Checked In:</span>{" "}
                  <span className="text-muted">{formatDateTime(reservation.check_in_time)}</span>
                </p>
              )}
              {reservation.check_out_time && (
                <p>
                  <span className="font-medium">Checked Out:</span>{" "}
                  <span className="text-muted">{formatDateTime(reservation.check_out_time)}</span>
                </p>
              )}
            </div>
          </div>
        ))}

        {reservations.length === 0 && (
          <div className="text-center py-8 text-muted">
            No reservations found
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-11 px-4 rounded-[var(--radius)] border bg-background text-foreground disabled:opacity-50 hover:bg-accent hover:text-accent-foreground disabled:hover:bg-background disabled:hover:text-foreground transition-colors"
          >
            Previous
          </button>
          <span className="h-11 px-4 flex items-center text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="h-11 px-4 rounded-[var(--radius)] border bg-background text-foreground disabled:opacity-50 hover:bg-accent hover:text-accent-foreground disabled:hover:bg-background disabled:hover:text-foreground transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Reservation Details Modal */}
      {isModalOpen && selectedReservation && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={closeModal}
        >
          <div 
            className="bg-background rounded-[var(--radius)] p-6 max-w-md w-full shadow-lg animate-slideIn"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-4 text-foreground">
              {actionSuccess ? "Action Completed!" : "Reservation Details"}
            </h3>
            
            <div className="space-y-4 text-foreground">
              <p><span className="font-medium">Space:</span> {selectedReservation.space.name}</p>
              <p><span className="font-medium">Location:</span> {selectedReservation.space.location}</p>
              <p><span className="font-medium">Start:</span> {formatDateTime(selectedReservation.start_time)}</p>
              <p><span className="font-medium">End:</span> {formatDateTime(selectedReservation.end_time)}</p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                <span className={`px-2 py-0.5 rounded-full text-sm ${getStatusColor(selectedReservation.status)}`}>
                  {selectedReservation.status.replace('_', ' ').toUpperCase()}
                </span>
              </p>
              {selectedReservation.notes && (
                <p><span className="font-medium">Notes:</span> {selectedReservation.notes}</p>
              )}
              {selectedReservation.qr_code && selectedReservation.status === "confirmed" && (
                <div>
                  <p className="font-medium mb-2">QR Code for Check-in:</p>
                  <img 
                    src={selectedReservation.qr_code} 
                    alt="Check-in QR Code"
                    className="mx-auto"
                  />
                </div>
              )}
            </div>

            {actionError && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-[var(--radius)] animate-shake">
                {actionError}
              </div>
            )}

            {actionSuccess ? (
              <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-[var(--radius)] animate-fadeIn">
                Action completed successfully!
              </div>
            ) : (
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-[var(--radius)] border hover:bg-accent/10 transition-colors"
                  disabled={actionLoading}
                >
                  Close
                </button>
                {selectedReservation.status === "confirmed" && (
                  <button
                    onClick={() => handleAction('check-in')}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-[var(--radius)] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    Check In
                  </button>
                )}
                {selectedReservation.status === "checked_in" && (
                  <button
                    onClick={() => handleAction('check-out')}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-[var(--radius)] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    Check Out
                  </button>
                )}
                {selectedReservation.status === "confirmed" && (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-[var(--radius)] bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 animate-fadeIn z-50"
          onClick={() => setShowCancelConfirm(false)}
        >
          <div
            className="bg-background rounded-[var(--radius)] p-6 max-w-sm w-full shadow-lg animate-slideIn"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-4 text-foreground">
              Cancel Reservation
            </h3>
            
            <p className="text-foreground mb-6">
              Are you sure you want to cancel this reservation? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 rounded-[var(--radius)] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                No, Keep It
              </button>
              <button
                onClick={() => {
                  setShowCancelConfirm(false);
                  handleAction('cancel');
                }}
                className="px-4 py-2 rounded-[var(--radius)] bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Yes, Cancel It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(ReservationsPage);