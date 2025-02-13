'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { env } from '@/app/config/env';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  penalty_points: number;
  average_rating: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for existing token and user data on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      // Verify token with backend
      fetch(`${env.API_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${storedToken}`
        }
      }).then(async (response) => {
        if (response.ok) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        } else {
          // If token is invalid, clear storage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }).catch(() => {
        // If request fails, clear storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }).finally(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/auth/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Higher-order component to protect routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return function ProtectedRoute(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push('/auth/login');
      }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
      return <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted">Loading...</div>
      </div>;
    }

    if (!isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
}