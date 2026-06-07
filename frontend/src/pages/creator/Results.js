import React, { useEffect, useState, useMemo } from 'react';
import api from '../../utils/api';

const VIOLATION_LABELS = {
  tab_switch:    '🔀 Переключение вкладки',
  copy_attempt:  '📋 Попытка копирования',
  right_click:   '🖱️ Правая кнопка мыши',
  ctrl_v:        '⌨️ Ctrl+V',
  ctrl_u:        '⌨️ Ctrl+U',
  ctrl_s:        '⌨️ Ctrl+S',
  devtools_open: '🛠️ Открытие DevTools',
};

export default function CreatorResults() {
  const [tab, setTab] = useState('results');
  const [results, setResults] = useState([]);
  const [violations, setViolations] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [filterQuiz, setFilterQuiz] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [resR, resV, resQ] = await Promise.all([
          api.get('/creator/results'),
          api.get('/creator/violations'),
          api.get('/creator/quizzes'),
        ]);
        setResults(Array.isArray(resR.data) ? resR.data : []);
        setViolations(Array.isArray(resV.data) ? resV.data : []);
        setQuizzes(Array.isArray(resQ.data) ? resQ.data : []);
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const matchQuiz = !filterQuiz || String(r.quiz_id) === filterQuiz;
      const term = search.trim().toLowerCase();
      const matchSearch = !term || [r.username, r.email, r.quiz_title].some(
        v => v && String(v).toLowerCase().includes(term)
      );
      return matchQuiz && matchSearch;
    });
  }, [results, filterQuiz, search]);

  const filteredViolations = useMemo(() => {
    return violations.filter(v => {
      const matchQuiz = !filterQuiz || String(v.quiz_id) === filterQuiz;
      const term = search.trim().toLowerCase();
      const matchSearch = !term || [v.username, v.quiz_title, v.violation_type].some(
        val => val && String(val).toLowerCase().includes(term)
      );
      return matchQuiz && matchSearch;
    });
  }, [violations, filterQuiz, search]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const url = filterQuiz
        ? `/creator/export-results?quizId=${filterQuiz}`
        : '/creator/export-results';
      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filterQuiz ? `results-quiz-${filterQuiz}.xlsx` : 'results-my-quizzes.xlsx';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      alert('Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={page}>
      <div style={container}>

        <div style={header}>
          <div>
            <p style={eyebrow}>Creator</p>
            <h1 style={title}>Результаты и нарушения</h1>
            <p style={subtitle}>{results.length} попыток · {violations.length} нарушений</p>
          </div>
          <button onClick={handleExport} disabled={exporting} style={exportBtn}>
            {exporting ? '⏳ Формируем…' : '📥 Скачать Excel'}
          </button>
        </div>

        {error && <div style={errorBox}>⚠️ {error}</div>}

        <div style={filters}>
          <select value={filterQuiz} onChange={e => setFilterQuiz(e.target.value)} style={selectStyle}>
            <option value="">Все квизы</option>
            {quizzes.map(q => (
              <option key={q.id} value={String(q.id)}>{q.title}</option>
            ))}
          </select>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по участнику, email, квизу…"
            style={inputStyle}
          />
        </div>

        <div style={tabs}>
          <button style={{ ...tabBtn, ...(tab === 'results' ? tabActive : {}) }} onClick={() => setTab('results')}>
            📊 Результаты ({filteredResults.length})
          </button>
          <button style={{ ...tabBtn, ...(tab === 'violations' ? tabActive : {}) }} onClick={() => setTab('violations')}>
            ⚠️ Нарушения ({filteredViolations.length})
          </button>
        </div>

        {loading && <div style={emptyBox}>Загружаем данные…</div>}

        {!loading && tab === 'results' && (
          filteredResults.length === 0
            ? <div style={emptyBox}>Нет результатов</div>
            : (
              <div style={tableWrap}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {['Участник', 'Email', 'Квиз', 'Баллы', '%', 'Сдано', 'Нарушений', 'Дата'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((r, i) => (
                      <tr key={r.id ?? i} style={i % 2 === 0 ? trEven : trOdd}>
                        <td style={tdStyle}>{r.username || '—'}</td>
                        <td style={{ ...tdStyle, color: '#8c97a8' }}>{r.email}</td>
                        <td style={tdStyle}>{r.quiz_title}</td>
                        <td style={tdStyle}>{r.score}/{r.max_score}</td>
                        <td style={tdStyle}>
                          <span style={{
                            ...pctBadge,
                            background: r.is_passed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                            color: r.is_passed ? '#10B981' : '#f87171',
                            borderColor: r.is_passed ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
                          }}>
                            {Number(r.percent_score).toFixed(0)}%
                          </span>
                        </td>
                        <td style={tdStyle}>{r.is_passed ? '✅ Да' : '❌ Нет'}</td>
                        <td style={tdStyle}>
                          {r.violations_count > 0
                            ? <span style={violBadge}>⚠️ {r.violations_count}</span>
                            : <span style={{ color: '#6b7280' }}>0</span>
                          }
                        </td>
                        <td style={{ ...tdStyle, color: '#8c97a8', whiteSpace: 'nowrap' }}>
                          {r.completed_at ? new Date(r.completed_at).toLocaleString('ru') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}

        {!loading && tab === 'violations' && (
          filteredViolations.length === 0
            ? <div style={emptyBox}>Нарушений не зафиксировано</div>
            : (
              <div style={tableWrap}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {['Участник', 'Квиз', 'Тип нарушения', 'Дата'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredViolations.map((v, i) => (
                      <tr key={v.id ?? i} style={i % 2 === 0 ? trEven : trOdd}>
                        <td style={tdStyle}>{v.username || `User #${v.user_id}`}</td>
                        <td style={tdStyle}>{v.quiz_title || `Quiz #${v.quiz_id}`}</td>
                        <td style={tdStyle}>
                          <span style={violBadge}>
                            {VIOLATION_LABELS[v.violation_type] || v.violation_type}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: '#8c97a8', whiteSpace: 'nowrap' }}>
                          {v.created_at ? new Date(v.created_at).toLocaleString('ru') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}
      </div>
    </div>
  );
}

const page       = { minHeight: '100vh', padding: '40px 0 80px' };
const container  = { maxWidth: 1200, margin: '0 auto', padding: '0 24px' };
const header     = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 };
const eyebrow    = { margin: '0 0 4px', color: '#8ee7c8', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 };
const title      = { margin: '0 0 4px', fontSize: 28, fontWeight: 800, color: '#f4f7fb' };
const subtitle   = { margin: 0, color: '#6b7280', fontSize: 14 };
const filters    = { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' };
const tabs       = { display: 'flex', gap: 8, marginBottom: 20 };
const tabBtn     = { padding: '9px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#9ca3af', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const tabActive  = { background: 'rgba(124,58,237,0.18)', borderColor: 'rgba(124,58,237,0.4)', color: '#c4b5fd' };
const tableWrap  = { overflowX: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle    = { padding: '10px 14px', textAlign: 'left', background: 'rgba(255,255,255,0.05)', color: '#8ee7c8', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' };
const tdStyle    = { padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle' };
const trEven     = { background: 'rgba(255,255,255,0.01)' };
const trOdd      = { background: 'rgba(255,255,255,0.03)' };
const pctBadge   = { display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 13, fontWeight: 700, border: '1px solid' };
const violBadge  = { display: 'inline-block', padding: '3px 10px', background: 'rgba(235,87,87,0.12)', border: '1px solid rgba(235,87,87,0.28)', color: '#ffb4b4', fontSize: 12, borderRadius: 4, whiteSpace: 'nowrap' };
const emptyBox   = { padding: '60px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', color: '#9ca3af' };
const errorBox   = { padding: '14px 18px', borderRadius: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', marginBottom: 20 };
const selectStyle = { padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(5,8,13,0.92)', color: '#f4f7fb', fontSize: 14, minWidth: 200 };
const inputStyle  = { flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(5,8,13,0.92)', color: '#f4f7fb', fontSize: 14, minWidth: 200 };
const exportBtn   = { padding: '11px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #7C3AED, #14B8A6)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' };
