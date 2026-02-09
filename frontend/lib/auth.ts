/**
 * Cognito Authentication Utility
 * Handles login with AWS Cognito User Pool
 */

const COGNITO_REGION = 'eu-west-1';
const USER_POOL_ID = 'eu-west-1_lC25xZ8s6';
const CLIENT_ID = '4e45pdiobcm8qo3ehvi1bcmo2s';

interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
  userInfo?: {
    email: string;
    sub: string;
    groups?: string[];
  };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    // Use environment-aware URL (proxy server in dev, API Gateway in production)
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
    const url = `${API_BASE_URL}/auth`;

    // Backend API expects simple JSON format
    const payload = {
      action: 'login',
      email,
      password,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || error.message || 'Authentication failed',
      };
    }

    const data = await response.json();

    if (!data.idToken) {
      return {
        success: false,
        error: 'No token received from authentication',
      };
    }

    const idToken = data.idToken;

    // Decode JWT to get user info (simple base64 decode, no verification needed for display)
    const payload_parts = idToken.split('.')[1];
    const decoded = JSON.parse(atob(payload_parts));

    return {
      success: true,
      token: idToken,
      userInfo: {
        email: decoded.email || email,
        sub: decoded.sub,
        groups: decoded['cognito:groups'] || [],
      },
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error during login',
    };
  }
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    // Clear auth token cookie
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
}

export function getCurrentUser() {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem('auth_token');
  const userInfo = localStorage.getItem('user_info');

  if (!token || !userInfo) return null;

  try {
    return JSON.parse(userInfo);
  } catch {
    return null;
  }
}

export function saveUserInfo(userInfo: any) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user_info', JSON.stringify(userInfo));
  }
}
