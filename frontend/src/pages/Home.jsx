import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import QuizCard from '../components/quiz/QuizCard';
import './Home.css';

const CATEGORIES = [
  { slug: 'science', icon: '🔬', name: 'Наука' },
  { slug: 'history', icon: '📜', name: 'История' },
  { slug: 'popculture', icon: '🎬', name: 'Поп-культура' },
  { slug: 'it', icon: '💻', name: 'IT' },
  { slug: 'sport', icon: '⚽', name: 'Спорт' },
  { slug: 'geography', icon: '🌍', name: 'География' },
  { slug: 'cinema', icon: '🎵', name: 'Кино и музыка' },
  { slug: 'literature', icon: '📚', name: 'Литература' }
];

export default function Home() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/quizzes?limit=8').then(r => setQuizzes(r.data.quizzes || [])).finally(() => setLoading(false));
  }, []);

  const primaryCta = user
    ? { to: '/quizzes', label: 'Перейти в каталог →' }
    : { to: '/quizzes', label: 'Начать играть →' };

  const secondaryCta = user
    ? { to: user.role === 'admin' ? '/admin' : '/profile', label: user.role === 'admin' ? 'Открыть панель →' : 'Мой профиль →' }
    : { to: '/register', label: 'Создать аккаунт →' };

  return (
    <div className="home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-orb orb1" />
          <div className="hero-orb orb2" />
          <div className="hero-orb orb3" />
        </div>
        <div className="container hero-content">
          <div className="hero-badge">
            <span>✨</span> Платформа №1 для интерактивных квизов
          </div>
          <h1 className="hero-title">
            Проверяй знания<br />
            <span className="gradient-text">с удовольствием</span>
          </h1>
          <p className="hero-sub">
            Сотни квизов по науке, истории, культуре и технологиям.<br />
            Умная защита от мошенничества для честных результатов.
          </p>
          <div className="hero-btns">
            <Link to={primaryCta.to} className="btn btn-primary btn-lg">{primaryCta.label}</Link>
            <Link to={secondaryCta.to} className="btn btn-outline btn-lg">{secondaryCta.label}</Link>
          </div>
          <div className="hero-stats">
            <div className="hstat"><span className="hstat-n gradient-text">500+</span><span className="hstat-l">квизов</span></div>
            <div className="hstat-div" />
            <div className="hstat"><span className="hstat-n gradient-text">10K+</span><span className="hstat-l">игроков</span></div>
            <div className="hstat-div" />
            <div className="hstat"><span className="hstat-n gradient-text">50K+</span><span className="hstat-l">прохождений</span></div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">Категории</h2>
          <p className="section-sub">Выбери тему, которая тебя интересует</p>
          <div className="cats-grid">
            {CATEGORIES.map(c => (
              <Link key={c.slug} to={`/quizzes?category=${c.slug}`} className="cat-card">
                <span className="cat-icon">{c.icon}</span>
                <span className="cat-name">{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured quizzes */}
      <section className="section section-dark">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="section-title">Популярные квизы</h2>
              <p className="section-sub">Самые популярные прямо сейчас</p>
            </div>
            <Link to="/quizzes" className="btn btn-outline">Все квизы →</Link>
          </div>
          {loading
            ? <div className="page-loader"><div className="spinner" /></div>
            : <div className="grid grid-3">{quizzes.map(q => <QuizCard key={q.uuid} quiz={q} />)}</div>
          }
        </div>
      </section>

      {/* Anti-cheat features */}
      <section className="section">
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center' }}>Честная проверка знаний</h2>
          <p className="section-sub" style={{ textAlign: 'center' }}>Система защиты от академического мошенничества</p>
          <div className="features-grid">
            {[
              { icon: '👁️', title: 'Мониторинг вкладок', desc: 'Фиксируем переключение вкладок во время прохождения квиза' },
              { icon: '🔀', title: 'Перемешивание', desc: 'Вопросы и ответы перемешиваются для каждого участника' },
              { icon: '⏱️', title: 'Таймер', desc: 'Ограничение времени на квиз или каждый вопрос отдельно' },
              { icon: '🛡️', title: 'Лог нарушений', desc: 'Все нарушения записываются и доступны администратору' },
              { icon: '🔒', title: 'Защита контента', desc: 'Блокировка копирования и контекстного меню во время квиза' },
              { icon: '📊', title: 'Лимит попыток', desc: 'Настраиваемое ограничение количества попыток прохождения' }
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="container cta-inner">
          <h2 className="cta-title">{user ? 'Продолжай играть' : 'Готов проверить себя?'}</h2>
          <p className="cta-sub">{user ? 'Открой каталог и выбери новый квиз' : 'Регистрируйся бесплатно и начни прямо сейчас'}</p>
          <Link to={user ? '/quizzes' : '/register'} className="btn btn-primary btn-lg">{user ? 'В каталог →' : 'Создать аккаунт →'}</Link>
        </div>
      </section>
    </div>
  );
}
