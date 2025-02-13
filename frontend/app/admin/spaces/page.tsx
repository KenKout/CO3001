"use client";

import { useAuth } from "@/app/contexts/AuthContext";
import { env } from "@/app/config/env";
import axios from "axios";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Space {
  id: number;
  name: string;
  capacity: number;
  type: "individual" | "group";
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";
  equipment: string[];
  location: string;
  description?: string;
  availability: {
    next_available: string | null;
    today_slots: Array<{
      start: string;
      end: string;
    }>;
  };
}

interface SpacesResponse {
  spaces: Space[];
  total: number;
  page: number;
  per_page: number;
}

export default function AdminSpaces() {
  const { token } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    type: "",
    capacity: "",
    equipment: "",
    status: "",
  });
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    spaceId: number | null;
    spaceName: string;
  }>({
    isOpen: false,
    spaceId: null,
    spaceName: "",
  });

  const fetchSpaces = async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.append("page", page.toString());
      
      if (filters.type) queryParams.append("type", filters.type);
      if (filters.capacity) queryParams.append("capacity", filters.capacity);
      if (filters.equipment) queryParams.append("equipment", filters.equipment);
      if (filters.status) queryParams.append("status", filters.status);

      const response = await axios.get<{ success: boolean; data: SpacesResponse }>(
        `${env.API_URL}/spaces?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setSpaces(response.data.data.spaces);
        setTotalPages(Math.ceil(response.data.data.total / response.data.data.per_page));
      }
    } catch (err) {
      setError("Failed to fetch spaces");
      console.error("Spaces fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, [token, page, filters]);

  const handleDelete = async () => {
    if (!deleteModal.spaceId) return;

    try {
      const response = await axios.delete(`${env.API_URL}/spaces/${deleteModal.spaceId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        fetchSpaces();
        setDeleteModal({ isOpen: false, spaceId: null, spaceName: "" });
      }
    } catch (err) {
      console.error("Delete space error:", err);
      alert("Failed to delete space");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-muted">Loading spaces...</p>
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Spaces</h1>
          <p className="text-muted">Manage study spaces and rooms</p>
        </div>
        <Link
          href="/admin/spaces/new"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Space
        </Link>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="rounded-md border border-input bg-background px-3 py-2"
        >
          <option value="">All Types</option>
          <option value="individual">Individual</option>
          <option value="group">Group</option>
        </select>

        <input
          type="number"
          placeholder="Min Capacity"
          value={filters.capacity}
          onChange={(e) => setFilters({ ...filters, capacity: e.target.value })}
          className="rounded-md border border-input bg-background px-3 py-2"
        />

        <input
          type="text"
          placeholder="Equipment (e.g., whiteboard)"
          value={filters.equipment}
          onChange={(e) => setFilters({ ...filters, equipment: e.target.value })}
          className="rounded-md border border-input bg-background px-3 py-2"
        />

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="rounded-md border border-input bg-background px-3 py-2"
        >
          <option value="">All Status</option>
          <option value="AVAILABLE">Available</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
      </div>

      {/* Spaces Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Type</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Capacity</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Location</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Equipment</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-background divide-y divide-border">
            {spaces.map((space) => (
              <tr key={space.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium">{space.name}</div>
                  {space.description && (
                    <div className="text-xs text-muted">{space.description}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {space.type.charAt(0).toUpperCase() + space.type.slice(1)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {space.capacity} people
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    space.status === "AVAILABLE"
                      ? "bg-green-100 text-green-800"
                      : space.status === "OCCUPIED"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}>
                    {space.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {space.location}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex flex-wrap gap-1">
                    {space.equipment.map((item, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-accent text-accent-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <Link
                    href={`/admin/spaces/${space.id}`}
                    className="text-primary hover:text-primary/80 mr-4"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => setDeleteModal({
                      isOpen: true,
                      spaceId: space.id,
                      spaceName: space.name,
                    })}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete Space</h3>
            <p className="text-muted mb-4">
              Are you sure you want to delete &quot;{deleteModal.spaceName}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setDeleteModal({ isOpen: false, spaceId: null, spaceName: "" })}
                className="px-4 py-2 border rounded-md hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}