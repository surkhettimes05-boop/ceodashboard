import { create } from 'zustand';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  branchId?: string | null;
  branchName?: string | null;
  permissions: string[];
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: UserProfile, accessToken: string, refreshToken: string) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('erp_user') || 'null'),
  accessToken: localStorage.getItem('erp_accessToken'),
  refreshToken: localStorage.getItem('erp_refreshToken'),
  isAuthenticated: !!localStorage.getItem('erp_accessToken'),

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('erp_user', JSON.stringify(user));
    localStorage.setItem('erp_accessToken', accessToken);
    localStorage.setItem('erp_refreshToken', refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  updateTokens: (accessToken, refreshToken) => {
    localStorage.setItem('erp_accessToken', accessToken);
    localStorage.setItem('erp_refreshToken', refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('erp_user');
    localStorage.removeItem('erp_accessToken');
    localStorage.removeItem('erp_refreshToken');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },
}));
