"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { env } from "../config/env";
import { useAuth, withAuth } from "@/app/contexts/AuthContext";

interface TimeSlot {
  start: string;
  end: string;
}

interface SpaceAvailability {
  next_available: string | null;
  today_slots: TimeSlot[];
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
  availability: SpaceAvailability;
}

interface SpaceResponse {
  success: boolean;
  data: {
    spaces: Space[];
    total: number;
    page: number;
    per_page: number;
  };
}

function SpacesPage() {
  const { token } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedCapacity, setSelectedCapacity] = useState<string>("");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("");

  const fetchSpaces = async () => {
    try {
      setLoading(true);
      let url = `${env.API_URL}/spaces?page=${page}`;
      
      if (selectedType) url += `&type=${selectedType}`;
      if (selectedCapacity) url += `&capacity=${selectedCapacity}`;
      if (selectedEquipment) url += `&equipment=${selectedEquipment}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch spaces");
      }

      const data: SpaceResponse = await response.json();
      setSpaces(data.data.spaces);
      setTotalPages(Math.ceil(data.data.total / data.data.per_page));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, [page, selectedType, selectedCapacity, selectedEquipment, token]);

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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
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
      {/* Filters */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <select
          className="w-full h-11 px-3 rounded-[var(--radius)] border bg-background text-foreground"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="individual">Individual</option>
          <option value="group">Group</option>
          <option value="meeting">Meeting</option>
          <option value="quiet">Quiet</option>
        </select>

        <select
          className="w-full h-11 px-3 rounded-[var(--radius)] border bg-background text-foreground"
          value={selectedCapacity}
          onChange={(e) => setSelectedCapacity(e.target.value)}
        >
          <option value="">Any Capacity</option>
          <option value="1">1 Person</option>
          <option value="2">2+ People</option>
          <option value="4">4+ People</option>
          <option value="6">6+ People</option>
        </select>

        <select
          className="w-full h-11 px-3 rounded-[var(--radius)] border bg-background text-foreground"
          value={selectedEquipment}
          onChange={(e) => setSelectedEquipment(e.target.value)}
        >
          <option value="">Any Equipment</option>
          <option value="whiteboard">Whiteboard</option>
          <option value="projector">Projector</option>
          <option value="computer">Computer</option>
        </select>
      </div>

      {/* Spaces Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {spaces.map((space) => (
          <Link
            href={`/spaces/${space.id}`}
            key={space.id}
            className="block border rounded-[var(--radius)] p-6 bg-background hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-foreground">{space.name}</h3>
              <span
                className={`px-3 py-1 rounded-full text-sm ${getStatusColor(
                  space.status
                )}`}
              >
                {space.status}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Location:</span>{" "}
                <span className="text-muted">{space.location}</span>
              </p>
              <p>
                <span className="font-medium">Capacity:</span>{" "}
                <span className="text-muted">{space.capacity} people</span>
              </p>
              <p>
                <span className="font-medium">Type:</span>{" "}
                <span className="text-muted">
                  {space.type.charAt(0).toUpperCase() + space.type.slice(1)}
                </span>
              </p>
              {space.equipment.length > 0 && (
                <p>
                  <span className="font-medium">Equipment:</span>{" "}
                  <span className="text-muted">{space.equipment.join(", ")}</span>
                </p>
              )}
            </div>

            {/* Availability Section */}
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium mb-2">Today&apos;s Availability</h4>
              {space.availability.today_slots.length > 0 ? (
                <div className="space-y-1">
                  {space.availability.today_slots.map((slot, index) => (
                    <div
                      key={index}
                      className="w-full text-sm px-3 py-1.5 rounded-[var(--radius)] bg-accent/10 text-accent"
                    >
                      {formatTime(slot.start)} - {formatTime(slot.end)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No available slots today</p>
              )}
            </div>
          </Link>
        ))}
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
    </div>
  );
}

export default withAuth(SpacesPage);