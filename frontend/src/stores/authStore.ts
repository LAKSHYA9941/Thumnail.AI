import { create } from 'zustand';
import { persist, type PersistOptions } from 'zustand/middleware';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  isGoogleUser: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: { email: string; password: string; name: string }) => Promise<boolean>;
  googleLogin: (idToken: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  clearError: () => void;
}

const API_BASE = "https://thumnail-ai.onrender.com/api";

// Create axios instance with proper timeout for Render free tier
export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000, // 15 seconds for Render free tier
});

// Add request interceptor for auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await api.post('/auth/login', { email, password });
          const { token, user } = response.data;
          
          localStorage.setItem('token', token);
          
          // Verify token by fetching profile
          const profileResponse = await api.get('/auth/profile');
          const verifiedUser = profileResponse.data.user;
          
          set({
            user: verifiedUser,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          
          return true;
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Login failed';
          set({ 
            error: errorMessage, 
            isLoading: false,
            isAuthenticated: false,
            user: null,
            token: null,
          });
          return false;
        }
      },

      register: async (data: { email: string; password: string; name: string }) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await api.post('/auth/register', data);
          const { token, user } = response.data;
          
          localStorage.setItem('token', token);
          
          // Verify token by fetching profile
          const profileResponse = await api.get('/auth/profile');
          const verifiedUser = profileResponse.data.user;
          
          set({
            user: verifiedUser,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          
          return true;
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Registration failed';
          set({ 
            error: errorMessage, 
            isLoading: false,
            isAuthenticated: false,
            user: null,
            token: null,
          });
          return false;
        }
      },

      googleLogin: async (idToken: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await api.post('/auth/google', { idToken });
          const { token, user } = response.data;
          
          localStorage.setItem('token', token);
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          
          return true;
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Google authentication failed';
          set({ 
            error: errorMessage, 
            isLoading: false,
            isAuthenticated: false,
            user: null,
            token: null,
          });
          return false;
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          set({ isAuthenticated: false, user: null, token: null });
          return false;
        }

        set({ isLoading: true });
        
        try {
          const response = await api.get('/auth/profile');
          const user = response.data.user;
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          
          return true;
        } catch (error) {
          localStorage.removeItem('token');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
          return false;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state: AuthState) => ({ 
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      } as Partial<AuthState>)
    } as PersistOptions<AuthState>
  )
);
