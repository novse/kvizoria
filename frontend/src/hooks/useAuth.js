import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kvizoria_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('kvizoria_token');
    if (token) {
      api.get('/auth/me')
        .then(r => { setUser(r.data); localStorage.setItem('kvizoria_user', JSON.stringify(r.data)); })
        .catch(() => { localStorage.removeItem('kvizoria_token'); localStorage.removeItem('kvizoria_user'); setUser(null); })
        .finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    localStorage.setItem('kvizoria_token', r.data.token);
    localStorage.setItem('kvizoria_user', JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data.user;
  };

  const register = async (username, email, password) => {
    const r = await api.post('/auth/register', { username, email, password });
    localStorage.setItem('kvizoria_token', r.data.token);
    localStorage.setItem('kvizoria_user', JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = () => {
    localStorage.removeItem('kvizoria_token');
    localStorage.removeItem('kvizoria_user');
    setUser(null);
  };

  // Новая функция: проверка лимита попыток для квиза
  const checkAttemptsLimit = async (quizUuid) => {
    try {
      const response = await api.get(`/quizzes/${quizUuid}/check-attempts`);
      return response.data;
    } catch (err) {
      if (err.response?.status === 403) {
        return { allowed: false, message: err.response.data.message };
      }
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, login, register, logout, loading, setUser,
      checkAttemptsLimit  // добавляем новую функцию
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
