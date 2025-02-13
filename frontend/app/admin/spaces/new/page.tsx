"use client";

import { useAuth } from "@/app/contexts/AuthContext";
import { env } from "@/app/config/env";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SpaceData {
  name: string;
  capacity: number;
  type: "individual" | "group";
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";
  equipment: string[];
  location: string;
  description?: string;
}

export default function NewSpace() {
  const router = useRouter();
  const { token } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [equipmentInput, setEquipmentInput] = useState("");
  const [space, setSpace] = useState<SpaceData>({
    name: "",
    capacity: 1,
    type: "individual",
    status: "AVAILABLE",
    equipment: [],
    location: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setIsSaving(true);
      const response = await axios.post(
        `${env.API_URL}/spaces`,
        space,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        router.push("/admin/spaces");
      }
    } catch (err) {
      console.error("Create space error:", err);
      alert("Failed to create space");
    } finally {
      setIsSaving(false);
    }
  };

  const addEquipment = () => {
    if (!equipmentInput.trim()) return;
    setSpace({
      ...space,
      equipment: [...space.equipment, equipmentInput.trim()],
    });
    setEquipmentInput("");
  };

  const removeEquipment = (index: number) => {
    const newEquipment = [...space.equipment];
    newEquipment.splice(index, 1);
    setSpace({ ...space, equipment: newEquipment });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Add New Space</h1>
        <p className="text-muted">Create a new study space or room</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={space.name}
              onChange={(e) => setSpace({ ...space, name: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="type" className="text-sm font-medium">
              Type
            </label>
            <select
              id="type"
              value={space.type}
              onChange={(e) =>
                setSpace({
                  ...space,
                  type: e.target.value as "individual" | "group",
                })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            >
              <option value="individual">Individual</option>
              <option value="group">Group</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="capacity" className="text-sm font-medium">
              Capacity
            </label>
            <input
              type="number"
              id="capacity"
              value={space.capacity}
              onChange={(e) =>
                setSpace({ ...space, capacity: parseInt(e.target.value) })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
              min="1"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="status" className="text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              value={space.status}
              onChange={(e) =>
                setSpace({
                  ...space,
                  status: e.target.value as "AVAILABLE" | "OCCUPIED" | "MAINTENANCE",
                })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            >
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="location" className="text-sm font-medium">
              Location
            </label>
            <input
              type="text"
              id="location"
              value={space.location}
              onChange={(e) => setSpace({ ...space, location: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <input
              type="text"
              id="description"
              value={space.description || ""}
              onChange={(e) =>
                setSpace({ ...space, description: e.target.value })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Equipment</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={equipmentInput}
              onChange={(e) => setEquipmentInput(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2"
              placeholder="Add equipment (e.g., whiteboard)"
            />
            <button
              type="button"
              onClick={addEquipment}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {space.equipment.map((item, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent text-accent-foreground"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeEquipment(index)}
                  className="text-sm hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.push("/admin/spaces")}
            className="px-4 py-2 border rounded-md hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? "Creating..." : "Create Space"}
          </button>
        </div>
      </form>
    </div>
  );
}