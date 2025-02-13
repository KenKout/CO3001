'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { env } from '@/app/config/env';
import { useAuth } from '@/app/contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${env.API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to login');
      }

      if (data.success && data.data.access_token) {
        // Update auth context and redirect
        login(data.data.access_token, data.data.user);
        router.push('/'); // Redirect to home page
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto min-h-[calc(100vh-3.5rem)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-center">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-muted">
            Access your Study Space account
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-lg transition-opacity disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="opacity-0">Sign in</span>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg 
                      className="animate-spin h-5 w-5" 
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
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <div className="text-center text-sm">
            <span className="text-muted">Don't have an account? </span>
            <Link 
              href="/auth/register" 
              className="text-accent hover:opacity-80 transition-opacity"
            >
              Register here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}