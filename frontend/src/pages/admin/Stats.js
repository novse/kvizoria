import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

export default function Stats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/stats')
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.message || 'Не удалось загрузить статистику'))
      .finally(() => setLoading(false));
  }, []);

  const handleExcel = async () => {
    try {
      const res = await api.get('/admin/export-results', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kvizoria-results.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Не удалось скачать файл');
    }
  };

  return (
    <div style={page}>
      <div style={container}>

        <div style={header}>
          <Link to="/admin" style={backBtn}>← Назад в панель</Link>
          <h1 style={title}>📊 Статистика платформы</h1>
        </div>

        {loading && <div style={card}>Загружаем данные…</div>}
        {error && <div style={{ ...card, borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>⚠️ {error}</div>}

        {data && (
          <>
            {/* Карточки с цифрами */}
            <div style={statsGrid}>
              {[
                { icon: '👥', label: 'Пользователей', value: data.totalUsers, color: '#7C3AED' },
                { icon: '🗂️', label: 'Квизов',         value: data.totalQuizzes, color: '#14B8A6' },
                { icon: '🎯', label: 'Пройдено раз',   value: data.totalAttempts, color: '#F59E0B' },
                { icon: '⭐', label: 'Средний балл',   value: Number(data.avgScore || 0).toFixed(1), color: '#EC4899' },
              ].map(s => (
                <div key={s.label} style={{ ...card, textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Популярные квизы */}
            <div style={card}>
              <h2 style={sectionTitle}>🏆 Самые популярные квизы</h2>
              {data.popularQuizzes?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                  {data.popularQuizzes.map((q, i) => (
                    <div key={i} style={quizRow}>
                      <div style={rankBadge(i)}>{i + 1}</div>
                      <div style={{ flex: 1, fontWeight: 600, color: '#f4f7fb' }}>{q.title}</div>
                      <div style={{ color: '#14B8A6', fontWeight: 700, fontSize: 15 }}>
                        {q.attempts} {plural(q.attempts, ['попытка', 'попытки', 'попыток'])}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: '24px 0' }}>Нет данных о прохождениях</div>
              )}
            </div>

            {/* Последние прохождения */}
            {data.recentAttempts?.length > 0 && (
              <div style={card}>
                <h2 style={sectionTitle}>🕐 Последние прохождения</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                  {data.recentAttempts.map((a, i) => (
                    <div key={i} style={quizRow}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#f4f7fb', fontSize: 14 }}>{a.title}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {a.username} · {new Date(a.completed_at).toLocaleString('ru')}
                        </div>
                      </div>
                      <div style={{
                        fontWeight: 700, fontSize: 15,
                        color: a.percent_score >= 80 ? '#10B981' : a.percent_score >= 50 ? '#F59E0B' : '#EF4444'
                      }}>
                        {Number(a.percent_score).toFixed(0)}%
                      </div>
                      <div style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                        background: a.is_passed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: a.is_passed ? '#10B981' : '#EF4444',
                      }}>{a.is_passed ? 'СДАНО' : 'НЕ СДАНО'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Кнопка Excel */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <button onClick={handleExcel} style={excelBtn}>
                📥 Скачать результаты (Excel)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function plural(n, forms) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if ([2,3,4].includes(mod10) && ![12,13,14].includes(mod100)) return forms[1];
  return forms[2];
}

function rankBadge(i) {
  const colors = ['#F59E0B', '#9ca3af', '#cd7c2f'];
  return {
    width: 28, height: 28, borderRadius: '50%',
    background: colors[i] || 'rgba(124,58,237,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 13, color: i < 3 ? '#0f0f1a' : '#c4b5fd',
    flexShrink: 0,
  };
}

const page = { minHeight: '100vh', padding: '40px 0 80px' };
const container = { maxWidth: 900, margin: '0 auto', padding: '0 24px' };
const header = { marginBottom: 32 };
const backBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  color: '#9ca3af', fontSize: 14, fontWeight: 500, marginBottom: 12,
  textDecoration: 'none',
};
const title = { fontSize: 30, fontWeight: 800, color: '#f4f7fb', margin: 0 };
const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20, padding: 24, marginBottom: 20,
};
const statsGrid = {
  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20,
};
const sectionTitle = { fontSize: 18, fontWeight: 700, color: '#f4f7fb', margin: 0 };
const quizRow = {
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '12px 16px', borderRadius: 12,
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
};
const excelBtn = {
  padding: '13px 32px', borderRadius: 14, border: 'none',
  background: 'linear-gradient(135deg, #10B981, #14B8A6)',
  color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(20,184,166,0.35)',
};
