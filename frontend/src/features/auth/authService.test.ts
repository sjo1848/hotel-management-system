import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from './authService';
import client from '../../api/client';

// Mock del cliente API
vi.mock('../../api/client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should call client.post with correct params and return token', async () => {
      const mockResponse = { data: { access_token: 'fake-token', expires_in: 3600, role: 'admin' } };
      (client.post as any).mockResolvedValue(mockResponse);
      const hotelId = '8f01bf7e-f0d2-4353-82e6-44e9c3379bcf';

      const result = await authService.login('user', 'pass', hotelId);

      expect(client.post).toHaveBeenCalledWith('/auth/login', {
        hotel_id: hotelId,
        username: 'user',
        password: 'pass',
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should throw error if login fails', async () => {
      const mockError = new Error('Login failed');
      (client.post as any).mockRejectedValue(mockError);

      await expect(
        authService.login('user', 'wrong-pass', '8f01bf7e-f0d2-4353-82e6-44e9c3379bcf'),
      ).rejects.toThrow('Login failed');
    });
  });

  describe('me', () => {
    it('should call client.get and return user info', async () => {
        const mockResponse = { data: { id: 'u1', username: 'user', role: 'admin' } };
        (client.get as any).mockResolvedValue(mockResponse);

        const result = await authService.me();

        expect(client.get).toHaveBeenCalledWith('/auth/me');
        expect(result).toEqual(mockResponse.data);
    });
  });

  describe('refresh', () => {
      it('should call client.post and return new token', async () => {
        const mockResponse = { data: { access_token: 'new-token', expires_in: 3600, role: 'admin' } };
        (client.post as any).mockResolvedValue(mockResponse);

        const result = await authService.refresh();

        expect(client.post).toHaveBeenCalledWith('/auth/refresh');
        expect(result).toEqual(mockResponse.data);
      });
  });

  describe('logout', () => {
      it('should call client.post', async () => {
        const mockResponse = { data: { message: 'logged out' } };
        (client.post as any).mockResolvedValue(mockResponse);

        const result = await authService.logout();

        expect(client.post).toHaveBeenCalledWith('/auth/logout');
        expect(result).toEqual(mockResponse.data);
      });
  });
});
