import React, { createContext, useState, useContext, useEffect } from 'react';
import axios, { AxiosInstance } from 'axios';
import { CONFIG } from '../config';

interface User {
  id: string;
  name: string;
  phone: string;
  role: 'VENDOR' | 'CUSTOMER';
}

interface Shop {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  shop: Shop | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  signup: (name: string, phone: string, password: string, role: 'VENDOR' | 'CUSTOMER') => Promise<void>;
  logout: () => void;
  updateShop: (name: string, description: string, category: string) => Promise<void>;
  setShopActiveStatus: (isActive: boolean, lat?: number, lng?: number) => Promise<void>;
  fetchMenuItems: (shopId: string, date?: string) => Promise<any>;
  fetchVendorMenuItems: () => Promise<any>;
  addMenuItem: (name: string, description: string, price: number, daysAvailable: string) => Promise<any>;
  toggleItemAvailability: (menuItemId: string, date: string, isAvailable: boolean) => Promise<any>;
  deleteMenuItem: (menuItemId: string) => Promise<any>;
  api: AxiosInstance;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Instantiate custom axios client
const apiInstance = axios.create({
  baseURL: CONFIG.API_URL,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Set default auth headers on token change
  useEffect(() => {
    if (token) {
      apiInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete apiInstance.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const login = async (phone: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiInstance.post('/api/auth/login', { phone, password });
      setToken(res.data.token);
      setUser(res.data.user);
      if (res.data.user.role === 'VENDOR') {
        setShop(res.data.shop);
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, phone: string, password: string, role: 'VENDOR' | 'CUSTOMER') => {
    setIsLoading(true);
    try {
      const res = await apiInstance.post('/api/auth/signup', { name, phone, password, role });
      setToken(res.data.token);
      setUser(res.data.user);
      // Retrieve empty default shop created by server
      if (role === 'VENDOR') {
        const profileRes = await apiInstance.get('/api/auth/profile');
        setShop(profileRes.data.shop);
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setShop(null);
  };

  const updateShop = async (name: string, description: string, category: string) => {
    try {
      const res = await apiInstance.put('/api/shops/update', { name, description, category });
      setShop(res.data.shop);
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to update shop details.');
    }
  };

  const setShopActiveStatus = async (isActive: boolean, lat?: number, lng?: number) => {
    try {
      const res = await apiInstance.post('/api/shops/toggle-active', {
        isActive,
        latitude: lat,
        longitude: lng,
      });
      setShop(res.data.shop);
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to toggle shop active state.');
    }
  };

  const fetchMenuItems = async (shopId: string, date?: string) => {
    try {
      const res = await apiInstance.get(`/api/menu/shop/${shopId}${date ? `?date=${date}` : ''}`);
      return res.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to fetch menu items.');
    }
  };

  const fetchVendorMenuItems = async () => {
    try {
      const res = await apiInstance.get('/api/menu/vendor');
      return res.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to fetch vendor menu items.');
    }
  };

  const addMenuItem = async (name: string, description: string, price: number, daysAvailable: string) => {
    try {
      const res = await apiInstance.post('/api/menu/add', { name, description, price, daysAvailable });
      return res.data.menuItem;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to add menu item.');
    }
  };

  const toggleItemAvailability = async (menuItemId: string, date: string, isAvailable: boolean) => {
    try {
      const res = await apiInstance.post('/api/menu/toggle-availability', { menuItemId, date, isAvailable });
      return res.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to toggle menu item availability.');
    }
  };

  const deleteMenuItem = async (menuItemId: string) => {
    try {
      const res = await apiInstance.delete(`/api/menu/${menuItemId}`);
      return res.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to delete menu item.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        shop,
        isAuthenticated: !!token,
        isLoading,
        login,
        signup,
        logout,
        updateShop,
        setShopActiveStatus,
        fetchMenuItems,
        fetchVendorMenuItems,
        addMenuItem,
        toggleItemAvailability,
        deleteMenuItem,
        api: apiInstance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
