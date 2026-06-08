import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

export default function MyQuizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/creator/quizzes');
      setQuizzes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  const togglePublish = async (quiz) => {
    try {
      const res = await api.put(`/creator/quizzes/${quiz.id}/toggle-publish`);
      setQuizzes(prev => prev.map(q =>
        q.id === quiz.id ? { ...q, is_published: res.data.is_published } : q
      ));
    } catch (err) {
      alert(err?.response?.data?.message || 'Ошибка');
    }
  };

  const deleteQuiz = async (id) => {
    if (!window.confirm('Удалить квиз? Это действие необратимо.')) return;
    try {
      await api.delete(`/creator/quizzes/${id}`);
      setQuizzes(prev => prev.filter(q => q.id !== id));
    } catch {
      alert('Ошибка удаления');
    }
  };

  const handleExportAll = async () => {
    try {
      const res = await api.get('/creator/export-results', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'results-my-quizzes.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Ошибка экспорта');
    }
  };

  const published = quizzes.filter(q => q.is_published);
  const drafts    = quizzes.filter(q => !q.is_published);

  return (
    <div style={page}>
      <div style={container}>

        {/* Шапка */}
        <div style={header}>
          <div>
            <p style={eyebrow}>Creator</p>
            <h1 style={title}>Мои квизы</h1>
            <p style={subtitle}>
              {quizzes.length} квизов · {published.length} опубликовано · {drafts.length} черновиков
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={handleExportAll} style={excelBtn}>📥 Excel</button>
            <Link to="/creator/stats"   style={ghostBtn}>📈 Статистика</Link>
            <Link to="/creator/results" style={ghostBtn}>📊 Результаты</Link>
            <Link to="/creator/quizzes/new" style={createBtn}>+ Создать квиз</Link>
          </div>
        </div>

        {error && <div style={errorBox}>⚠️ {error}</div>}
        {loading && <div style={emptyBox}>Загружаем квизы…</div>}

        {!loading && quizzes.length === 0 && (
          <div style={emptyBox}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
            <p style={{ margin: '0 0 16px', color: '#9ca3af' }}>У тебя ещё нет квизов</p>
            <Link to="/creator/quizzes/new" style={createBtn}>Создать первый квиз</Link>
          </div>
        )}

        {/* Черновики */}
        {drafts.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={sectionLabel}>📝 Черновики ({drafts.length})</div>
            <div style={grid}>
              {drafts.map(q => (
                <QuizCard key={q.id} quiz={q} onToggle={togglePublish} onDelete={deleteQuiz} />
              ))}
            </div>
          </div>
        )}

        {/* Опубликованные */}
        {published.length > 0 && (
          <div>
            <div style={sectionLabel}>✅ Опубликованные ({published.length})</div>
            <div style={grid}>
              {published.map(q => (
                <QuizCard key={q.id} quiz={q} onToggle={togglePublish} onDelete={deleteQuiz} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function QuizCard({ quiz, onToggle, onDelete }) {
  const [toggling, setToggling]   = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    await onToggle(quiz);
    setToggling(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/creator/export-results?quizId=${quiz.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `results-quiz-${quiz.id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={card}>
      {/* Обложка */}
      <div style={coverWrap}>
        {quiz.cover_image
          ? <img
              src={quiz.cover_image.startsWith('http')
                ? quiz.cover_image
                : `${window.location.origin}${quiz.cover_image}`}
              alt=""
              style={coverImg}
            />
          : <div style={coverPlaceholder}>{quiz.title?.[0]?.toUpperCase()}</div>
        }
        <div style={{
          ...statusBadge,
          background:  quiz.is_published ? 'rgba(16,185,129,0.2)'   : 'rgba(107,114,128,0.25)',
          color:       quiz.is_published ? '#10B981'                 : '#9ca3af',
          borderColor: quiz.is_published ? 'rgba(16,185,129,0.35)'  : 'rgba(255,255,255,0.1)',
        }}>
          {quiz.is_published ? '✅ Опубликован' : '📝 Черновик'}
        </div>
      </div>

      {/* Информация */}
      <div style={cardBody}>
        <h3 style={cardTitle}>{quiz.title}</h3>
        <p style={cardDesc}>{quiz.description || 'Нет описания'}</p>
        <div style={cardMeta}>
          <span style={metaTag}>{quiz.quiz_type === 'timed' ? '⏱ На время' : '📋 Классический'}</span>
          {quiz.time_limit && <span style={metaTag}>⏰ {quiz.time_limit} сек</span>}
          <span style={metaTag}>{new Date(quiz.created_at).toLocaleDateString('ru')}</span>
        </div>
      </div>

      {/* Кнопки */}
      <div style={cardActions}>
        {/* Опубликовать / Скрыть */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          style={quiz.is_published ? unpublishBtn : publishBtn}
          title={quiz.is_published ? 'Скрыть квиз' : 'Опубликовать квиз'}
        >
          {toggling
            ? '…'
            : quiz.is_published
              ? '🔒 Скрыть'
              : '🚀 Опубликовать'}
        </button>

        {/* Редактировать */}
        <Link
          to={`/creator/quizzes/${quiz.id}/edit`}
          style={editBtn}
          title="Редактировать"
        >
          ✏️
        </Link>

        {/* Скачать результаты Excel */}
        <button
          onClick={handleExport}
          disabled={exporting}
          style={xlsBtn}
          title="Скачать результаты Excel"
        >
          {exporting ? '…' : '📥'}
        </button>

        {/* Удалить */}
        <button
          onClick={() => onDelete(quiz.id)}
          style={deleteBtn}
          title="Удалить квиз"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const page         = { minHeight: '100vh', padding: '40px 0 80px' };
const container    = { maxWidth: 1200, margin: '0 auto', padding: '0 24px' };
const header       = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 };
const eyebrow      = { margin: '0 0 4px', color: '#8ee7c8', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 };
const title        = { margin: '0 0 4px', fontSize: 30, fontWeight: 800, color: '#f4f7fb' };
const subtitle     = { margin: 0, color: '#6b7280', fontSize: 14 };
const sectionLabel = { fontSize: 13, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 };
const grid         = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 };
const card         = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const coverWrap    = { position: 'relative', height: 140, background: 'rgba(124,58,237,0.1)', flexShrink: 0 };
const coverImg     = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const coverPlaceholder = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, fontWeight: 800, color: 'rgba(167,139,250,0.4)', background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(20,184,166,0.08))' };
const statusBadge  = { position: 'absolute', top: 10, right: 10, padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: '1px solid', backdropFilter: 'blur(8px)' };
const cardBody     = { padding: '14px 16px', flex: 1 };
const cardTitle    = { margin: '0 0 5px', fontSize: 15, fontWeight: 700, color: '#f4f7fb' };
const cardDesc     = { margin: '0 0 10px', fontSize: 13, color: '#6b7280', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
const cardMeta     = { display: 'flex', gap: 6, flexWrap: 'wrap' };
const metaTag      = { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' };
const cardActions  = { padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 7, alignItems: 'center' };

// кнопки в карточке
const publishBtn   = { flex: 1, padding: '8px 10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #7C3AED, #14B8A6)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' };
const unpublishBtn = { flex: 1, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' };
const editBtn      = { padding: '8px 11px', borderRadius: 10, border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)', color: '#c4b5fd', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', flexShrink: 0 };
const xlsBtn       = { padding: '8px 11px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.08)', color: '#6ee7b7', fontSize: 13, cursor: 'pointer', flexShrink: 0 };
const deleteBtn    = { padding: '8px 11px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#f87171', fontSize: 13, cursor: 'pointer', flexShrink: 0 };

// кнопки в шапке
const createBtn = { padding: '10px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #7C3AED, #14B8A6)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', boxShadow: '0 4px 20px rgba(124,58,237,0.3)', whiteSpace: 'nowrap' };
const ghostBtn  = { padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' };
const excelBtn  = { padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' };
const errorBox  = { padding: '14px 18px', borderRadius: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', marginBottom: 20 };
const emptyBox  = { padding: '60px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', color: '#9ca3af' };
