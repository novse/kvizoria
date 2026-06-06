import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import './Admin.css';

function getDisplayName(user) {
  if (!user) return 'Anonymous user';
  return user.fullName || user.name || user.username || user.displayName || user.email || 'Anonymous user';
}

function normalizeListPayload(payload, keys) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export default function Admin() {
  const { user } = useAuth();
  const role = user?.role || 'user';
  const isAdmin = role === 'admin';

  const [users, setUsers] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionError, setSectionError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [roleDrafts, setRoleDrafts] = useState({});
  const [savingUserId, setSavingUserId] = useState(null);
  const [deletingQuizId, setDeletingQuizId] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadAdminData() {
      setLoading(true);
      setSectionError('');
      setNotice('');

      try {
        const [usersRes, quizzesRes] = await Promise.all([
          api.get('/admin/users'),
          api.get('/admin/quizzes'),
        ]);

        if (!mounted) return;

        const userList = normalizeListPayload(usersRes.data, ['users', 'items']);
        const quizList = normalizeListPayload(quizzesRes.data, ['quizzes', 'items']);

        setUsers(userList);
        setQuizzes(quizList);
        setRoleDrafts(
          Object.fromEntries(userList.map((item) => [item.id || item.userId, item.role || 'user']))
        );
      } catch (err) {
        if (!mounted) return;
        setSectionError(err?.response?.data?.message || err?.message || 'Не удалось загрузить админ-данные');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (isAdmin) {
      loadAdminData();
    } else {
      setLoading(false);
      setSectionError('Требуются права администратора.');
    }

    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  const stats = useMemo(
    () => ({
      userCount: users.length,
      creatorCount: users.filter((item) => item.role === 'creator').length,
      adminCount: users.filter((item) => item.role === 'admin').length,
      quizCount: quizzes.length,
    }),
    [users, quizzes]
  );

  const handleRoleChange = (userId, value) => {
    setRoleDrafts((current) => ({
      ...current,
      [userId]: value,
    }));
  };

  const saveUserRole = async (userId) => {
    setSavingUserId(userId);
    setNotice('');
    setSectionError('');

    try {
      const roleValue = roleDrafts[userId];
      await api.put(`/admin/users/${userId}`, { role: roleValue });

      setUsers((current) =>
        current.map((item) =>
          (item.id || item.userId) === userId ? { ...item, role: roleValue } : item
        )
      );
      setNotice('Пользователь обновлён.');
    } catch (err) {
      setSectionError(err?.response?.data?.message || err?.message || 'Не удалось обновить пользователя');
    } finally {
      setSavingUserId(null);
    }
  };

  const deleteQuiz = async (quizId) => {
    const ok = window.confirm('Удалить квиз? Это действие нельзя отменить.');
    if (!ok) return;

    setDeletingQuizId(quizId);
    setNotice('');
    setSectionError('');

    try {
      await api.delete(`/admin/quizzes/${quizId}`);
      setQuizzes((current) => current.filter((item) => (item.id || item.quizId) !== quizId));
      setNotice('Квиз удалён.');
    } catch (err) {
      setSectionError(err?.response?.data?.message || err?.message || 'Не удалось удалить квиз');
    } finally {
      setDeletingQuizId(null);
    }
  };

  const filteredUsers = users.filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [item.username, item.email, item.role]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const filteredQuizzes = quizzes.filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [item.title, item.description, item.quiz_type, item.author]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-container" style={shellStyle}>
          <div style={panelStyle}>
            <h1 style={{ marginTop: 0 }}>Админ-панель</h1>
            <p style={{ color: '#f0a6a6', marginBottom: 0 }}>
              {sectionError || 'Требуются права администратора.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container" style={shellStyle}>
        <div style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>Administration</p>
            <h1 style={{ margin: '0 0 10px', fontSize: 'clamp(2rem, 4vw, 3.4rem)' }}>
              {getDisplayName(user)}
            </h1>
            <p style={{ margin: 0, color: '#b0bac7', maxWidth: 780 }}>
              Управляйте пользователями, квизами и контентом платформы из одного места.
            </p>
          </div>

          <div style={summaryGrid}>
            {[
              { label: 'Users', value: stats.userCount },
              { label: 'Creators', value: stats.creatorCount },
              { label: 'Admins', value: stats.adminCount },
              { label: 'Quizzes', value: stats.quizCount },
            ].map((item) => (
              <div key={item.label} style={summaryCardStyle}>
                <div style={{ color: '#8c97a8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {item.label}
                </div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={toolbarStyle}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск пользователей или квизов"
            style={inputStyle}
          />
           <button type="button" onClick={() => window.location.reload()} style={buttonStyle}>
    Обновить
  </button>
  <button type="button" onClick={() => window.open('/api/admin/export-results', '_blank')} 
    style={buttonStyle}
  >
    📥 Скачать результаты (Excel)
  </button>
  <button 
  type="button" 
  onClick={() => window.location.href = '/admin/stats'} 
  style={buttonStyle}
>
  📊 Статистика
</button>
  <button type="button" onClick={() => window.location.href = '/admin/quiz/create'} style={buttonStyle}>
    + Создать квиз
</button>
        </div>

        {loading ? <div style={panelStyle}>Загружаем данные…</div> : null}
        {sectionError ? (
          <div style={{ ...panelStyle, borderColor: 'rgba(235, 87, 87, 0.24)', color: '#ffb4b4' }}>
            {sectionError}
          </div>
        ) : null}
        {notice ? (
          <div style={{ ...panelStyle, borderColor: 'rgba(48, 242, 184, 0.24)', color: '#9af5d6' }}>{notice}</div>
        ) : null}

        <div style={gridStyle}>
          <section style={panelStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={{ margin: 0 }}>Пользователи</h2>
              <span style={mutedText}>{filteredUsers.length} показано</span>
            </div>

            <div style={listStyle}>
              {filteredUsers.map((item) => {
                const id = item.id || item.userId;
                return (
                  <div key={id} style={rowStyle}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                        {item.username || item.email || `User ${id}`}
                      </div>
                      <div style={{ color: '#9aa6b7', fontSize: 13, overflowWrap: 'anywhere' }}>
                        {item.email || 'Нет email'}
                      </div>
                      <div style={{ marginTop: 6, color: '#8ee7c8', fontSize: 12, textTransform: 'uppercase' }}>
                        {item.role || 'user'}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 8, minWidth: 180 }}>
                      <select
                        value={roleDrafts[id] || item.role || 'user'}
                        onChange={(e) => handleRoleChange(id, e.target.value)}
                        style={inputStyle}
                      >
                        <option value="user">user</option>
                        <option value="creator">creator</option>
                        <option value="admin">admin</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => saveUserRole(id)}
                        disabled={savingUserId === id}
                        style={buttonStyle}
                      >
                        {savingUserId === id ? 'Сохраняем…' : 'Сохранить роль'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {!filteredUsers.length ? <div style={emptyStyle}>Пользователи не найдены.</div> : null}
            </div>
          </section>

          <section style={panelStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={{ margin: 0 }}>Квизы</h2>
              <span style={mutedText}>{filteredQuizzes.length} показано</span>
            </div>

            <div style={listStyle}>
              {filteredQuizzes.map((item) => {
                const quizId = item.id || item.quizId;
                return (
                  <div key={quizId} style={rowStyle}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{item.title || 'Без названия'}</div>
                      <div style={{ marginTop: 6, color: '#9aa6b7', fontSize: 13, overflowWrap: 'anywhere' }}>
                        {item.description || 'Нет описания'}
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', color: '#8ee7c8', fontSize: 12 }}>
                        <span>{item.quiz_type || 'uncategorized'}</span>
                        {item.author ? <span>• @{item.author}</span> : null}
                        {item.created_at ? <span>• {new Date(item.created_at).toLocaleDateString()}</span> : null}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 8, minWidth: 140 }}>
                      <button
                        type="button"
                    onClick={() => window.location.href = `/admin/quiz/edit/${quizId}`}
                    style={{ ...buttonStyle, borderColor: 'rgba(48, 242, 184, 0.28)' }}
                         >
                       ✏️ Редактировать
                      </button>
                      <button
                        type="button"
        onClick={() => deleteQuiz(quizId)}
        disabled={deletingQuizId === quizId}
        style={{ ...buttonStyle, borderColor: 'rgba(235,87,87,0.24)' }}
    >
        {deletingQuizId === quizId ? 'Удаляем…' : '🗑️ Удалить'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {!filteredQuizzes.length ? <div style={emptyStyle}>Квизы не найдены.</div> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const shellStyle = {
  maxWidth: 1280,
  margin: '0 auto',
  padding: '32px 0 56px',
};

const eyebrowStyle = {
  margin: '0 0 8px',
  color: '#8ee7c8',
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  fontSize: 12,
};

const headerStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)',
  gap: 20,
  alignItems: 'start',
  marginBottom: 20,
};

const summaryGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
};

const summaryCardStyle = {
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(12, 16, 24, 0.96)',
  boxShadow: '0 14px 42px rgba(0, 0, 0, 0.28)',
};

const toolbarStyle = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginBottom: 16,
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 18,
  alignItems: 'start',
};

const panelStyle = {
  padding: 20,
  background: 'rgba(12, 16, 24, 0.96)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 18px 54px rgba(0, 0, 0, 0.28)',
};

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 14,
};

const mutedText = {
  color: '#97a3b6',
  fontSize: 13,
};

const listStyle = {
  display: 'grid',
  gap: 12,
};

const rowStyle = {
  display: 'flex',
  gap: 16,
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 16,
  border: '1px solid rgba(255,255,255,0.07)',
  background: 'rgba(255,255,255,0.03)',
  flexWrap: 'wrap',
};

const emptyStyle = {
  color: '#97a3b6',
  padding: 16,
  border: '1px dashed rgba(255,255,255,0.12)',
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(5, 8, 13, 0.92)',
  color: '#f4f7fb',
  outline: 'none',
  fontSize: 15,
};

const buttonStyle = {
  padding: '12px 14px',
  border: '1px solid rgba(142, 231, 200, 0.28)',
  background: 'linear-gradient(135deg, rgba(142, 231, 200, 0.2), rgba(48, 242, 184, 0.08))',
  color: '#ecfff7',
  fontWeight: 800,
  letterSpacing: 0.3,
  cursor: 'pointer',
};

const statCardStyle = {
  padding: 18,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(14, 18, 27, 0.96)',
  boxShadow: '0 14px 42px rgba(0, 0, 0, 0.3)',
};

const errorBoxStyle = {
  padding: 14,
  background: 'rgba(235, 87, 87, 0.08)',
  border: '1px solid rgba(235, 87, 87, 0.22)',
  color: '#ffb4b4',
};

export { statCardStyle, errorBoxStyle };
