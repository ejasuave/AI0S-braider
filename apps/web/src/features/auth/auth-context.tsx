'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AuthSessionResponse,
  AuthUser,
  BusinessStaffPermissions,
  OtpPurpose,
} from '@project-braids/shared-types/api';
import { ApiClientError, apiFetchData, refreshAccessToken } from '@/shared/lib/api-client';
import {
  clearAccessToken,
  clearPendingOtp,
  getAccessToken,
  setAccessToken,
  setPendingOtp,
} from '@/shared/lib/auth-storage';

type AuthMe = {
  user: AuthUser;
  stylistId: string | null;
  businessId: string | null;
  permissions: BusinessStaffPermissions | null;
};

type RegisterResponse = {
  userId?: string;
  otpRequired: true;
  otpPurpose: OtpPurpose;
};

type OtpVerifyResponse = AuthSessionResponse | { verified: true };

type AuthContextValue = {
  user: AuthUser | null;
  stylistId: string | null;
  businessId: string | null;
  permissions: BusinessStaffPermissions | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isStylist: boolean;
  isClient: boolean;
  login: (input: { email: string; password: string }) => Promise<AuthUser>;
  registerStylist: (input: {
    phoneNumber: string;
    email: string;
    password: string;
  }) => Promise<void>;
  registerClient: (input: { phoneNumber: string }) => Promise<void>;
  verifyOtp: (input: {
    phoneNumber: string;
    code: string;
    purpose: OtpPurpose;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_ME_KEY = ['auth', 'me'] as const;

async function fetchMe(): Promise<AuthMe> {
  try {
    return await apiFetchData<AuthMe>('/auth/me');
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      const token = await refreshAccessToken();
      if (token) {
        return apiFetchData<AuthMe>('/auth/me');
      }
    }
    throw error;
  }
}

function isSessionResponse(value: OtpVerifyResponse): value is AuthSessionResponse {
  return 'tokens' in value && Boolean(value.tokens?.accessToken);
}

async function hydrateSession(
  queryClient: QueryClient,
  session: AuthSessionResponse,
): Promise<AuthMe> {
  setAccessToken(session.tokens.accessToken);
  queryClient.setQueryData<AuthMe>(AUTH_ME_KEY, {
    user: session.user,
    stylistId: null,
    businessId: null,
    permissions: null,
  });

  try {
    return await queryClient.fetchQuery({
      queryKey: AUTH_ME_KEY,
      queryFn: fetchMe,
      staleTime: 0,
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      clearAccessToken();
      queryClient.setQueryData(AUTH_ME_KEY, null);
      throw error;
    }
    return { user: session.user, stylistId: null, businessId: null, permissions: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setBootstrapped(true);
    setHasToken(Boolean(getAccessToken()));
  }, []);

  const meQuery = useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: fetchMe,
    enabled: bootstrapped && hasToken,
    retry: false,
  });

  const refreshMe = useCallback(async () => {
    setHasToken(Boolean(getAccessToken()));
    await queryClient.invalidateQueries({ queryKey: AUTH_ME_KEY });
  }, [queryClient]);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const session = await apiFetchData<AuthSessionResponse>('/auth/login', {
        auth: false,
        method: 'POST',
        json: input,
      });
      const me = await hydrateSession(queryClient, session);
      setHasToken(true);
      return me.user;
    },
    [queryClient],
  );

  const registerStylist = useCallback(
    async (input: { phoneNumber: string; email: string; password: string }) => {
      const result = await apiFetchData<RegisterResponse>('/auth/register/stylist', {
        auth: false,
        method: 'POST',
        json: input,
      });
      setPendingOtp({
        phoneNumber: input.phoneNumber,
        purpose: result.otpPurpose,
        role: 'stylist',
      });
    },
    [],
  );

  const registerClient = useCallback(async (input: { phoneNumber: string }) => {
    const result = await apiFetchData<RegisterResponse>('/auth/register/client', {
      auth: false,
      method: 'POST',
      json: input,
    });
    setPendingOtp({
      phoneNumber: input.phoneNumber,
      purpose: result.otpPurpose,
      role: 'client',
    });
  }, []);

  const verifyOtp = useCallback(
    async (input: { phoneNumber: string; code: string; purpose: OtpPurpose }) => {
      const result = await apiFetchData<OtpVerifyResponse>('/auth/otp/verify', {
        auth: false,
        method: 'POST',
        json: input,
      });

      if (!isSessionResponse(result)) {
        throw new ApiClientError('Verification did not return a session', 500);
      }

      const me = await hydrateSession(queryClient, result);
      clearPendingOtp();
      setHasToken(true);
      return me.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetchData('/auth/logout', { method: 'POST', json: {} });
    } finally {
      clearAccessToken();
      clearPendingOtp();
      setHasToken(false);
      queryClient.setQueryData(AUTH_ME_KEY, null);
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const user = meQuery.data?.user ?? null;
    const stylistId = meQuery.data?.stylistId ?? null;
    const businessId = meQuery.data?.businessId ?? null;
    const permissions = meQuery.data?.permissions ?? null;
    const resolvingSession = hasToken && !user && (meQuery.isPending || !meQuery.isFetched);

    return {
      user,
      stylistId,
      businessId,
      permissions,
      isLoading: !bootstrapped || resolvingSession,
      isAuthenticated: Boolean(user),
      isStylist: user?.role === 'stylist_owner' || user?.role === 'stylist_staff',
      isClient: user?.role === 'client',
      login,
      registerStylist,
      registerClient,
      verifyOtp,
      logout,
      refreshMe,
    };
  }, [
    bootstrapped,
    hasToken,
    login,
    logout,
    meQuery.data,
    meQuery.isPending,
    meQuery.isFetched,
    refreshMe,
    registerClient,
    registerStylist,
    verifyOtp,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function getPostAuthPath(user: AuthUser): '/stylist' | '/client' {
  return user.role === 'client' ? '/client' : '/stylist';
}
