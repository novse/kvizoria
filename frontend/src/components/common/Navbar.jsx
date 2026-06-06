import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); setMenuOpen(false); };
  const isActive = (path) => location.pathname === path;
  const isCreator = user?.role === 'creator' || user?.role === 'admin';

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text gradient-text">Квизория</span>
        </Link>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>Главная</Link>
          <Link to="/quizzes" className={`nav-link ${isActive('/quizzes') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>Каталог</Link>
          {user && (
            <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>Профиль</Link>
          )}

          {user?.role === 'creator' && (
  <Link to="/creator/quizzes">📋 Мои квизы</Link>
)}
        </div>

        <div className="navbar-actions">
          {user ? (
            <div className="navbar-quick-actions">
              {isCreator && (
                <Link to="/profile#create-quiz" className="btn btn-primary btn-sm">
                  Создать квиз
                </Link>
              )}
              {user?.role === 'admin' && (
                <Link to="/admin" className="btn btn-outline btn-sm">
                  Редактировать
                </Link>
              )}
            </div>
          ) : null}
          {user ? (
            <div className="user-menu">
              <div className="user-avatar" onClick={() => setMenuOpen(!menuOpen)}>
                {user.avatar
                  ? <img src={user.avatar.startsWith('http') ? user.avatar : `${window.location.origin}${user.avatar}`} alt={user.username} />
                  : <span>{user.username[0].toUpperCase()}</span>
                }
              </div>
              {menuOpen && (
                <div className="dropdown">
                  <div className="dropdown-header">
                    <strong>{user.username}</strong>
                    <span className={`badge badge-${user.role === 'admin' ? 'pink' : user.role === 'creator' ? 'teal' : 'purple'}`}>
                      {user.role === 'admin' ? 'Администратор' : user.role === 'creator' ? 'Создатель' : 'Участник'}
                    </span>
                  </div>
                  <div className="divider" />
                  <Link to="/profile" className="dropdown-item" onClick={() => setMenuOpen(false)}>👤 Мой профиль</Link>
                  {user.role === 'admin' && <Link to="/admin" className="dropdown-item" onClick={() => setMenuOpen(false)}>⚙️ Администрирование</Link>}
                  <button onClick={handleLogout} className="dropdown-item dropdown-logout">🚪 Выйти</button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-btns">
              <Link to="/login" className="btn btn-outline btn-sm">Войти</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Регистрация</Link>
            </div>
          )}
          <button className="burger" onClick={() => setMenuOpen(!menuOpen)}>
            <span /><span /><span />
          </button>
        </div>
      </div>
      {menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}
    </nav>
  );
}
