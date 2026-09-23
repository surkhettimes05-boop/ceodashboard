import axios from 'axios';
import { useAuthStore } from '../store/authStore';

let refreshPromise: Promise<void> | null = null;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const originalRequest = error.config as typeof error.config & { _retry?: boolean };
      const refreshToken = useAuthStore.getState().refreshToken;
      const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');

      if (refreshToken && !originalRequest?._retry && !isRefreshRequest) {
        originalRequest._retry = true;
        try {
          refreshPromise ||= axios.post('/api/auth/refresh', { refreshToken }).then((response) => {
            const tokens = response.data.data;
            useAuthStore.getState().updateTokens(tokens.accessToken, tokens.refreshToken);
          }).finally(() => {
            refreshPromise = null;
          });
          await refreshPromise;
          originalRequest.headers.Authorization = `Bearer ${useAuthStore.getState().accessToken}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
        }
      } else {
        useAuthStore.getState().logout();
      }
    }

    if (error.response?.data && typeof error.response.data === 'string') {
      error.response.data = { message: error.response.data };
    }

    return Promise.reject(error);
  }
);
