'use client';

import { useEffect, useState } from 'react';
import { useAuth, withAuth } from '@/app/contexts/AuthContext';
import { env } from '@/app/config/env';

interface ProfileStats {
  total_reservations: number;
  penalty_points: number;
  average_rating: number;
  reservation_status: {
    completed: number;
    cancelled: number;
    no_show: number;
  };
}

interface ProfileData {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
  stats: ProfileStats;
}

function ProfilePage() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${env.API_URL}/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to fetch profile');
        }

        if (data.success) {
          setProfile(data.data);
        } else {
          throw new Error(data.error?.message || 'Failed to fetch profile');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [token]);

  if (isLoading) {
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

  if (!profile) {
    return null;
  }

  return (
    <div className="container mx-auto min-h-[calc(100vh-3.5rem)] py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Profile Header */}
        <div>
          <h2 className="text-3xl font-bold text-center">Profile</h2>
          <p className="mt-2 text-center text-sm text-muted">
            View and manage your account
          </p>
        </div>

        {/* Basic Information */}
        <div className="bg-background border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted mb-1">Name</p>
              <p className="text-foreground">{profile.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted mb-1">Email</p>
              <p className="text-foreground">{profile.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted mb-1">Role</p>
              <p className="text-foreground">{profile.role}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted mb-1">Member Since</p>
              <p className="text-foreground">
                {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="bg-background border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Statistics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border">
              <p className="text-sm font-medium text-muted mb-1">Total Reservations</p>
              <p className="text-2xl font-bold text-foreground">{profile.stats.total_reservations}</p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="text-sm font-medium text-muted mb-1">Penalty Points</p>
              <p className="text-2xl font-bold text-foreground">{profile.stats.penalty_points}</p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="text-sm font-medium text-muted mb-1">Average Rating</p>
              <p className="text-2xl font-bold text-foreground">
                {profile.stats.average_rating.toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        {/* Reservation History */}
        <div className="bg-background border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Reservation History</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border">
              <p className="text-sm font-medium text-muted mb-1">Completed</p>
              <p className="text-2xl font-bold text-green-500">
                {profile.stats.reservation_status.completed}
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="text-sm font-medium text-muted mb-1">Cancelled</p>
              <p className="text-2xl font-bold text-yellow-500">
                {profile.stats.reservation_status.cancelled}
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="text-sm font-medium text-muted mb-1">No Show</p>
              <p className="text-2xl font-bold text-red-500">
                {profile.stats.reservation_status.no_show}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(ProfilePage);