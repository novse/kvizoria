import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

function plural(n, forms) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return forms[1];
  return forms[2];
}

function rankBadge(i) {
  const colors = ['#F59E0B', '#9ca3af', '#cd7c2f'];
  return {
    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
    background: colors[i] || 'rgba(124,58,237,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 13,
    color: i < 3 ? '#0f0f1a' : '#c4b5fd',
  };
}

export default function CreatorStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get('/creator/stats')
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.message || 'Не удалось загрузить статистику'))
      .finally(() => setLoading(false));
  }, []);

  const handleExcel = async () => {
    setExporting(true);
    try {
      const res = await api.get('/creator/export-results', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'results-my-quizzes.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Не удалось скачать файл');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={page}>
      <div style={container}>

        {/* Шапка */}
        <div style={header}>
          <Link to="/creator/quizzes" style={backBtn}>← Мои квизы</Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={eyebrow}>Creator</p>
              <h1 style={title}>Статистика</h1>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link to="/creator/results" style={outlineBtn}>📋 Результаты</Link>
              <button onClick={handleExcel} disabled={exporting} style={excelBtn}>
                {exporting ? '⏳ Формируем…' : '📥 Скачать Excel'}
              </button>
            </div>
          </div>
        </div>

        {loading && <div style={card}>Загружаем данные…</div>}
        {error && <div style={{ ...card, borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>⚠️ {error}</div>}

        {data && (
          <>
            {/* Сводные карточки */}
            <div style={statsGrid}>
              {[
                { icon: '🗂️', label: 'Квизов всего',   value: data.totalQuizzes,    color: '#7C3AED' },
                { icon: '✅', label: 'Опубликовано',    value: data.publishedQuizzes, color: '#14B8A6' },
                { icon: '🎯', label: 'Прохождений',     value: data.totalAttempts,   color: '#F59E0B' },
                { icon: '📈', label: '% сдавших',       value: data.passRate + '%',  color: '#10B981' },
                { icon: '⭐', label: 'Средний балл',    value: data.avgScore + '%',  color: '#EC4899' },
                { icon: '⚠️', label: 'Нарушений',       value: data.totalViolations, color: '#EF4444' },
              ].map(s => (
                <div key={s.label} style={{ ...card, textAlign: 'center', marginBottom: 0 }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Топ квизов */}
            <div style={{ ...card, marginTop: 20 }}>
              <h2 style={sectionTitle}>🏆 Мои квизы по популярности</h2>
              {data.popularQuizzes?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                  {data.popularQuizzes.map((q, i) => (
                    <div key={i} style={quizRow}>
                      <div style={rankBadge(i)}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#f4f7fb', fontSize: 14 }}>{q.title}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {q.is_published ? '🟢 Опубликован' : '⚫ Черновик'}
                          {q.avgPercent != null ? ` · средний балл ${Number(q.avgPercent).toFixed(1)}%` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#14B8A6', fontWeight: 700, fontSize: 15 }}>
                          {q.attempts} {plural(Number(q.attempts), ['попытка', 'попытки', 'попыток'])}
                        </div>
                        {q.attempts > 0 && (
                          <div style={{ fontSize: 12, color: '#10B981', marginTop: 2 }}>
                            {q.passed} сдали
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: '24px 0' }}>
                  Нет квизов или прохождений
                </div>
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
                          {a.violations_count > 0 && (
                            <span style={{ marginLeft: 8, color: '#f87171' }}>
                              ⚠️ {a.violations_count} нарушений
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{
                        fontWeight: 700, fontSize: 15,
                        color: a.percent_score >= 80 ? '#10B981' : a.percent_score >= 50 ? '#F59E0B' : '#EF4444',
                      }}>
                        {Number(a.percent_score).toFixed(0)}%
                      </div>
                      <div style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                        background: a.is_passed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: a.is_passed ? '#10B981' : '#EF4444',
                      }}>
                        {a.is_passed ? 'СДАНО' : 'НЕ СДАНО'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const page      = { minHeight: '100vh', padding: '40px 0 80px' };
const container = { maxWidth: 960, margin: '0 auto', padding: '0 24px' };
const header    = { marginBottom: 28 };
const eyebrow   = { margin: '0 0 4px', color: '#8ee7c8', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 };
const title     = { fontSize: 28, fontWeight: 800, color: '#f4f7fb', margin: 0 };
const backBtn   = { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 14, fontWeight: 500, marginBottom: 12, textDecoration: 'none' };
const card      = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, marginBottom: 20 };
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 };
const sectionTitle = { fontSize: 18, fontWeight: 700, color: '#f4f7fb', margin: 0 };
const quizRow   = { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' };
const excelBtn  = { padding: '11px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #10B981, #14B8A6)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' };
const outlineBtn = { padding: '11px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' };
