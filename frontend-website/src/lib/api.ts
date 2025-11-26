const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://deliveryapp-fxxl.onrender.com';

interface ApiError {
  error: boolean;
  message: string;
  code: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private tokenExpiry: number | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  private loadToken() {
    const token = localStorage.getItem('token');
    const expiry = localStorage.getItem('tokenExpiry');
    
    if (token && expiry) {
      const expiryTime = parseInt(expiry);
      if (Date.now() < expiryTime) {
        this.token = token;
        this.tokenExpiry = expiryTime;
      } else {
        // Token expired, clear it
        this.clearToken();
      }
    }
  }

  setToken(token: string | null, expiresInDays: number = 7) {
    this.token = token;
    if (token) {
      const expiry = Date.now() + (expiresInDays * 24 * 60 * 60 * 1000);
      this.tokenExpiry = expiry;
      localStorage.setItem('token', token);
      localStorage.setItem('tokenExpiry', expiry.toString());
    } else {
      this.clearToken();
    }
  }

  private clearToken() {
    this.token = null;
    this.tokenExpiry = null;
    localStorage.removeItem('token');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('refreshTokenExpiry');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
  }

  getToken() {
    if (this.token && this.tokenExpiry && Date.now() >= this.tokenExpiry) {
      this.clearToken();
      return null;
    }
    return this.token;
  }

  isTokenValid() {
    return this.token !== null && this.tokenExpiry !== null && Date.now() < this.tokenExpiry;
  }

  getCachedUserRole() {
    return localStorage.getItem('userRole');
  }

  getCachedUserId() {
    return localStorage.getItem('userId');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw data as ApiError;
    }

    return data as T;
  }

  // Auth endpoints
  async login(emailOrPhone: string, password: string) {
    const data = await this.request<{
      user: any;
      token: string;
      refreshToken: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone, password }),
    });
    
    // Store token for 7 days
    this.setToken(data.token, 7);
    
    // Store refresh token with expiry
    const refreshExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('refreshTokenExpiry', refreshExpiry.toString());
    
    // Store minimal user info (only for UI display, not as source of truth)
    localStorage.setItem('userRole', data.user.role);
    localStorage.setItem('userId', data.user.id);
    
    return data;
  }

  async getCurrentUser() {
    return this.request<any>('/api/auth/me');
  }

  async refreshTokenRequest(refreshToken: string) {
    const data = await this.request<{ token: string; refreshToken: string }>(
      '/api/auth/refresh-token',
      {
        method: 'POST',
        body: JSON.stringify({ token: refreshToken }),
      }
    );
    
    // Update token with new 7-day expiry
    this.setToken(data.token, 7);
    
    const refreshExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('refreshTokenExpiry', refreshExpiry.toString());
    
    return data;
  }

  async autoRefreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    const refreshExpiry = localStorage.getItem('refreshTokenExpiry');
    
    if (!refreshToken || !refreshExpiry) {
      return false;
    }
    
    // Check if refresh token is still valid
    if (Date.now() >= parseInt(refreshExpiry)) {
      this.logout();
      return false;
    }
    
    try {
      await this.refreshTokenRequest(refreshToken);
      return true;
    } catch (error) {
      this.logout();
      return false;
    }
  }

  async resetPassword(token: string, password: string) {
    return this.request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async healthCheck() {
    return this.request<{ status: string; message: string }>('/health');
  }

  // Admin endpoints
  async getDashboard() {
    return this.request<{
      totalOrders: number;
      pendingOrders: number;
      deliveredOrders: number;
      totalRevenue: number;
      totalDeliveryBoys: number;
    }>('/api/admin/dashboard');
  }

  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    status?: string;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{
      users: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/api/admin/users?${query}`);
  }

  async createAdmin(name: string, phone: string) {
    return this.request<any>('/api/admin/users/admin', {
      method: 'POST',
      body: JSON.stringify({ name, phone }),
    });
  }

  async deleteUser(userId: string) {
    return this.request<{ message: string }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async createOrder(orderData: {
    customerName: string;
    customerPhone: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    deliveryAddress: {
      addressLine: string;
      city: string;
      pincode: string;
      latitude: number;
      longitude: number;
    };
    totalAmount: number;
    paymentMode: string;
  }) {
    return this.request<any>('/api/admin/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{
      orders: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/api/admin/orders?${query}`);
  }

  async getOrder(orderId: string) {
    return this.request<any>(`/api/admin/orders/${orderId}`);
  }

  async updatePaymentStatus(
    orderId: string,
    data: {
      paymentStatus: string;
      actualPaymentMethod?: string;
      notes?: string;
    }
  ) {
    return this.request<any>(`/api/admin/orders/${orderId}/payment-status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async assignOrder(orderId: string, deliveryBoyId: string) {
    return this.request<any>(`/api/admin/orders/${orderId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ deliveryBoyId }),
    });
  }

  async getDeliveryBoys(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{
      deliveryBoys: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/api/admin/delivery-boys?${query}`);
  }

  async createDeliveryBoy(name: string, phone: string) {
    return this.request<any>('/api/admin/delivery-boys', {
      method: 'POST',
      body: JSON.stringify({ name, phone }),
    });
  }

  async updateDeliveryBoy(deliveryBoyId: string, data: any) {
    return this.request<any>(`/api/admin/delivery-boys/${deliveryBoyId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDeliveryBoy(deliveryBoyId: string) {
    return this.request<{ message: string }>(
      `/api/admin/delivery-boys/${deliveryBoyId}`,
      {
        method: 'DELETE',
      }
    );
  }

  async getLeaderboard(period?: string) {
    const query = period ? `?period=${period}` : '';
    return this.request<{ leaderboard: any[] }>(
      `/api/admin/leaderboard${query}`
    );
  }

  async getRevenue(period?: string) {
    const query = period ? `?period=${period}` : '';
    return this.request<{
      totalRevenue: number;
      period: string;
      paymentMethods: any;
      chartData: any[];
    }>(`/api/admin/revenue${query}`);
  }

  async getTransactions(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{
      transactions: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/api/admin/transactions?${query}`);
  }

  logout() {
    this.clearToken();
  }
}

export const api = new ApiClient(API_BASE_URL);
