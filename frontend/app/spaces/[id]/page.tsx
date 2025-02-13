"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { env } from "../../config/env";
import { useAuth, withAuth } from "@/app/contexts/AuthContext";

interface TimeSlot {
  start: string;
  end: string;
}

interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}

interface Space {
  id: number;
  name: string;
  capacity: number;
  type: "individual" | "group" | "meeting" | "quiet";
  status: "available" | "occupied" | "maintenance" | "reserved";
  equipment: string[];
  location: string;
  description: string | null;
  average_rating: number;
  total_ratings: number;
}

interface APIError {
  success: false;
  error: {
    code: number;
    message: string;
  };
}

interface SpaceResponse {
  success: true;
  data: {
    space: Space;
  };
}

interface AvailabilityResponse {
  success: true;
  data: {
    availabilities: DayAvailability[];
  };
}

type APIResponse<T> = T | APIError;

function SpaceDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const [space, setSpace] = useState<Space | null>(null);
  const [availabilities, setAvailabilities] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Reservation modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [reservationSuccess, setReservationSuccess] = useState(false);

  const fetchSpaceDetails = async () => {
    try {
      setLoading(true);
      const [spaceResponse, availabilityResponse] = await Promise.all([
        fetch(`${env.API_URL}/spaces/${params.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        fetch(`${env.API_URL}/spaces/${params.id}/availability`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      ]);
      
      const spaceData: APIResponse<SpaceResponse> = await spaceResponse.json();
      const availabilityData: APIResponse<AvailabilityResponse> = await availabilityResponse.json();

      if (!spaceResponse.ok || !availabilityResponse.ok || !spaceData.success || !availabilityData.success) {
        if (!spaceData.success) {
          throw new Error(spaceData.error.message);
        }
        if (!availabilityData.success) {
          throw new Error(availabilityData.error.message);
        }
        throw new Error("Failed to fetch space details");
      }
      
      setSpace(spaceData.data.space);
      setAvailabilities(availabilityData.data.availabilities);
      
      // Set selected date to first available date
      if (availabilityData.data.availabilities.length > 0) {
        setSelectedDate(availabilityData.data.availabilities[0].date);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaceDetails();
  }, [params.id, token]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  const getSelectedDaySlots = () => {
    const dayAvailability = availabilities.find(a => a.date === selectedDate);
    return dayAvailability?.slots || [];
  };

  const getStatusColor = (status: Space["status"]) => {
    switch (status) {
      case "available":
        return "text-green-500 bg-green-50 dark:bg-green-950 dark:text-green-400";
      case "occupied":
        return "text-red-500 bg-red-50 dark:bg-red-950 dark:text-red-400";
      case "maintenance":
        return "text-yellow-500 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400";
      case "reserved":
        return "text-blue-500 bg-blue-50 dark:bg-blue-950 dark:text-blue-400";
      default:
        return "text-muted bg-muted/10";
    }
  };

  const handleReservation = async () => {
    if (!space || !selectedSlot) return;

    try {
      setReservationLoading(true);
      setReservationError(null);
      setReservationSuccess(false);

      const response = await fetch(`${env.API_URL}/reservations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          space_id: space.id,
          start_time: selectedSlot.start,
          end_time: selectedSlot.end
        })
      });

      const data: APIResponse<{ success: true }> = await response.json();

      if (!response.ok || !data.success) {
        if (!data.success) {
          throw new Error(data.error.message);
        }
        throw new Error('Failed to create reservation');
      }

      setReservationSuccess(true);
      // Close modal after a short delay to show success state
      setTimeout(() => {
        setIsModalOpen(false);
        fetchSpaceDetails(); // Refresh availability
      }, 1500);
    } catch (err) {
      setReservationError(err instanceof Error ? err.message : "Failed to create reservation");
    } finally {
      setReservationLoading(false);
    }
  };

  const handleSlotClick = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setIsModalOpen(true);
    setReservationError(null);
    setReservationSuccess(false);
  };

  const closeModal = () => {
    if (!reservationLoading) {
      setIsModalOpen(false);
      setReservationError(null);
      setReservationSuccess(false);
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

  if (error || !space) {
    return (
      <div className="container mx-auto min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          <span className="block sm:inline">{error || "Space not found"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-h-[calc(100vh-3.5rem)] px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Space Details */}
        <div className="mb-8 p-6 border rounded-[var(--radius)] bg-background">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl font-semibold text-foreground">{space.name}</h1>
            <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(space.status)}`}>
              {space.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="mb-2">
                <span className="font-medium">Location:</span>{" "}
                <span className="text-muted">{space.location}</span>
              </p>
              <p className="mb-2">
                <span className="font-medium">Capacity:</span>{" "}
                <span className="text-muted">{space.capacity} people</span>
              </p>
            </div>
            <div>
              <p className="mb-2">
                <span className="font-medium">Type:</span>{" "}
                <span className="text-muted">
                  {space.type.charAt(0).toUpperCase() + space.type.slice(1)}
                </span>
              </p>
              {space.equipment.length > 0 && (
                <p className="mb-2">
                  <span className="font-medium">Equipment:</span>{" "}
                  <span className="text-muted">{space.equipment.join(", ")}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Calendar Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Available Time Slots</h2>
          
          {/* Date Selection */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {availabilities.map((availability) => (
              <button
                key={availability.date}
                onClick={() => setSelectedDate(availability.date)}
                className={`px-4 py-2 rounded-[var(--radius)] border whitespace-nowrap ${
                  selectedDate === availability.date ? 
                  'bg-primary text-primary-foreground' : 
                  'bg-background hover:bg-accent/10'
                }`}
              >
                {formatDate(availability.date)}
              </button>
            ))}
          </div>

          {/* Time Slots */}
          <div className="border rounded-[var(--radius)] bg-background p-6">
            <h3 className="font-medium mb-4">
              Time Slots for {formatDate(selectedDate)}
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {getSelectedDaySlots().map((slot, index) => (
                <button
                  key={index}
                  onClick={() => handleSlotClick(slot)}
                  className="px-4 py-2 text-sm rounded-[var(--radius)] bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                >
                  {formatTime(slot.start)} - {formatTime(slot.end)}
                </button>
              ))}
              {getSelectedDaySlots().length === 0 && (
                <p className="text-sm text-muted col-span-full">
                  No available slots for this date
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Reservation Modal */}
        {isModalOpen && space && selectedSlot && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 animate-fadeIn"
            onClick={closeModal}
          >
            <div 
              className="bg-background rounded-[var(--radius)] p-6 max-w-md w-full shadow-lg animate-slideIn"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold mb-4 text-foreground">
                {reservationSuccess ? "Reservation Confirmed!" : "Confirm Reservation"}
              </h3>
              
              <div className="space-y-4 text-foreground">
                <p><span className="font-medium">Space:</span> {space.name}</p>
                <p><span className="font-medium">Time:</span> {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}</p>
                <p><span className="font-medium">Date:</span> {formatDate(selectedDate)}</p>
                <p><span className="font-medium">Location:</span> {space.location}</p>
              </div>

              {reservationError && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-[var(--radius)] animate-shake">
                  {reservationError}
                </div>
              )}

              {reservationSuccess ? (
                <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-[var(--radius)] animate-fadeIn">
                  Your reservation has been confirmed successfully!
                </div>
              ) : (
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 rounded-[var(--radius)] border hover:bg-accent/10 transition-colors"
                    disabled={reservationLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReservation}
                    disabled={reservationLoading}
                    className="px-4 py-2 rounded-[var(--radius)] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors relative"
                  >
                    {reservationLoading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Confirming...
                      </span>
                    ) : (
                      "Confirm Reservation"
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(SpaceDetailPage);