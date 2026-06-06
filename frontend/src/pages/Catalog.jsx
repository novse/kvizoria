import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import QuizCard from '../components/quiz/QuizCard';
import './Catalog.css';

const TYPES = [
  { value: '', label: 'Все типы' },
  { value: 'classic', label: 'Классика' },
  { value: 'timed', label: 'На время' },
  { value: 'picture', label: 'С картинками' },
  { value: 'learning', label: 'Обучающий' },
];
const DIFFS = [
  { value: '', label: 'Любой уровень' },
  { value: 'easy', label: '🟢 Лёгкий' },
  { value: 'medium', label: '🟡 Средний' },
  { value: 'hard', label: '🔴 Сложный' },
];

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [quizzes, setQuizzes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const type = searchParams.get('type') || '';
  const difficulty = searchParams.get('difficulty') || '';

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 12 });
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (type) params.set('type', type);
      if (difficulty) params.set('difficulty', difficulty);
      const r = await api.get(`/quizzes?${params}`);
      setQuizzes(r.data.quizzes || []);
      setTotal(r.data.total || 0);
      setPage(p);
    } finally { setLoading(false); }
  }, [search, category, type, difficulty]);

  useEffect(() => { load(1); }, [load]);

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data || []));
  }, []);

  const setParam = (key, val) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set(key, val); else p.delete(key);
    setSearchParams(p);
  };

  return (
    <div className="catalog-page">
      <div className="container">
        <div className="catalog-header">
          <h1 className="section-title">Каталог квизов</h1>
          <p className="section-sub">Найдено квизов: <strong style={{color:'var(--text-white)'}}>{total}</strong></p>
        </div>

        {/* Filters */}
        <div className="filters">
          <input className="input filter-search" type="text" placeholder="🔍 Поиск квизов..."
            defaultValue={search}
            onKeyDown={e => e.key === 'Enter' && setParam('search', e.target.value)}
            onBlur={e => setParam('search', e.target.value)}
          />
          <select className="input filter-select" value={category} onChange={e => setParam('category', e.target.value)}>
            <option value="">Все категории</option>
            {categories.map(c => <option key={c.id} value={c.slug}>{c.icon} {c.name}</option>)}
          </select>
          <select className="input filter-select" value={type} onChange={e => setParam('type', e.target.value)}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="input filter-select" value={difficulty} onChange={e => setParam('difficulty', e.target.value)}>
            {DIFFS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        {/* Results */}
        {loading
          ? <div className="page-loader"><div className="spinner" /></div>
          : quizzes.length === 0
            ? <div className="empty-state">
                <div style={{fontSize:48}}>🔍</div>
                <h3 style={{color:'var(--text-white)'}}>Ничего не найдено</h3>
                <p style={{color:'var(--text-secondary)'}}>Попробуй изменить фильтры или поисковый запрос</p>
              </div>
            : <>
                <div className="grid grid-3">{quizzes.map(q => <QuizCard key={q.uuid} quiz={q} />)}</div>
                {total > 12 && (
                  <div className="pagination">
                    <button className="btn btn-outline btn-sm" onClick={() => load(page - 1)} disabled={page <= 1}>← Назад</button>
                    <span style={{color:'var(--text-secondary)', fontSize:14}}>Страница {page} из {Math.ceil(total / 12)}</span>
                    <button className="btn btn-outline btn-sm" onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / 12)}>Вперёд →</button>
                  </div>
                )}
              </>
        }
      </div>
    </div>
  );
}
