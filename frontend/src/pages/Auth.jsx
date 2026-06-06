import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Auth.css';

export function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate(user.role === 'admin' ? '/admin' : '/');
    }
  }, [authLoading, navigate, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка входа');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card fade-in">
        <div className="auth-logo">⚡ <span className="gradient-text">Квизория</span></div>
        <h1 className="auth-title">Добро пожаловать!</h1>
        <p className="auth-sub">Войди в свой аккаунт</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="your@email.com"
              value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="label">Пароль</label>
            <input className="input" type="password" placeholder="••••••••"
              value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          </div>
          <div className="auth-forgot">
            <Link to="/forgot-password">Забыл пароль?</Link>
          </div>
          <button type="submit" className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'13px'}} disabled={loading}>
            {loading ? 'Входим...' : 'Войти →'}
          </button>
        </form>

        <div className="auth-demo">
          <p className="demo-title">Тестовые аккаунты:</p>
          <div className="demo-accounts">
            <button className="demo-btn" onClick={() => setForm({email:'admin@kvizoria.ru', password:'Admin2024!'})}>Администратор</button>
            <button className="demo-btn" onClick={() => setForm({email:'elena@kvizoria.ru', password:'Creator2024!'})}>Создатель</button>
            <button className="demo-btn" onClick={() => setForm({email:'user@kvizoria.ru', password:'User2024!'})}>Участник</button>
          </div>
        </div>

        <p className="auth-switch">Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></p>
      </div>
    </div>
  );
}

export function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate(user.role === 'admin' ? '/admin' : '/');
    }
  }, [authLoading, navigate, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register(form.username, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка регистрации');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card fade-in">
        <div className="auth-logo">⚡ <span className="gradient-text">Квизория</span></div>
        <h1 className="auth-title">Создай аккаунт</h1>
        <p className="auth-sub">Присоединяйся к тысячам игроков</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="label">Имя пользователя</label>
            <input className="input" type="text" placeholder="ivan_petrov"
              value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="your@email.com"
              value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="label">Пароль</label>
            <input className="input" type="password" placeholder="Минимум 6 символов"
              value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={6} />
          </div>
          <button type="submit" className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'13px'}} disabled={loading}>
            {loading ? 'Создаём...' : 'Зарегистрироваться →'}
          </button>
        </form>
        <p className="auth-switch">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
      </div>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { default: api } = await import('../utils/api');
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch { setError('Ошибка отправки'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card fade-in">
        <div className="auth-logo">⚡ <span className="gradient-text">Квизория</span></div>
        <h1 className="auth-title">Сброс пароля</h1>
        {sent
          ? <><div className="success-msg">Проверь почту — мы отправили ссылку для сброса пароля.</div><Link to="/login" className="btn btn-outline" style={{marginTop:16}}>← Назад ко входу</Link></>
          : <>
              {error && <div className="error-msg">{error}</div>}
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label className="label">Email</label>
                  <input className="input" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'13px'}} disabled={loading}>
                  {loading ? 'Отправляем...' : 'Отправить ссылку'}
                </button>
              </form>
              <p className="auth-switch"><Link to="/login">← Назад ко входу</Link></p>
            </>
        }
      </div>
    </div>
  );
}

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = window.location.pathname.split('/').pop();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { default: api } = await import('../utils/api');
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) { setError(err.response?.data?.message || 'Ошибка'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card fade-in">
        <div className="auth-logo">⚡ <span className="gradient-text">Квизория</span></div>
        <h1 className="auth-title">Новый пароль</h1>
        {done
          ? <><div className="success-msg">Пароль изменён!</div><Link to="/login" className="btn btn-primary" style={{marginTop:16}}>Войти →</Link></>
          : <>
              {error && <div className="error-msg">{error}</div>}
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label className="label">Новый пароль</label>
                  <input className="input" type="password" placeholder="Минимум 6 символов" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}/>
                </div>
                <button type="submit" className="btn btn-primary" style={{width:'100%', justifyContent:'center'}} disabled={loading}>
                  {loading ? '...' : 'Сохранить пароль'}
                </button>
              </form>
            </>
        }
      </div>
    </div>
  );
}
