import axios from 'axios';

// В продакшне фронтенд и бэкенд на одном домене → /api
// Локально при разработке бэкенд на 5000, фронтенд на 3000
const BASE = process.env.NODE_ENV === 'development'
  ? 'http://localhost:5000/api'
  : '/api';

const api = axios.create({
  baseURL: BASE,
  timeout: 15000
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('kvizoria_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('kvizoria_token');
      localStorage.removeItem('kvizoria_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
