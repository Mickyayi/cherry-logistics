// 简单的本地存储工具函数

export const AUTH_STORAGE_KEY = 'cherry_auth';

export const isAuthenticated = (): boolean => {
  return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
};

export const setAuthenticated = (): void => {
  localStorage.setItem(AUTH_STORAGE_KEY, 'true');
};

export const clearAuthentication = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

