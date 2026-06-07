import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import './Profile.css';

const makeEmptyQuestion = () => ({
  text: '',
  answers: ['', '', '', ''],
  correct: 0,
});

const initialQuizDraft = {
  title: '',
  description: '',
  category_id: '',
  quiz_type: 'classic',
  timeLimitMinutes: '',
  questions: [makeEmptyQuestion()],
};

function getDisplayName(user) {
  if (!user) return 'Anonymous user';
  return user.fullName || user.name || user.username || user.displayName || user.email || 'Anonymous user';
}

function normalizeHistoryPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.history)) return payload.history;
  if (Array.isArray(payload?.attempts)) return payload.attempts;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeCategoriesPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.categories)) return payload.categories;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}




function Profile() {
  const { user } = useAuth();
  const role = user?.role || 'user';
  const isAdmin = role === 'admin';
  const canCreateQuiz = Boolean(user);


  const [history, setHistory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState('');
  const [createError, setCreateError] = useState('');
  const [quizDraft, setQuizDraft] = useState(initialQuizDraft);

  // Edit profile
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const [editError, setEditError] = useState('');

  // Change password
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (user) {
      setEditUsername(user.username || '');
      setEditBio(user.bio || '');
      setEditAvatarPreview(user.avatar ? (user.avatar.startsWith('http') ? user.avatar : `${window.location.origin}${user.avatar}`) : '');
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;

    async function loadProfileData() {
      setHistoryLoading(true);
      setHistoryError('');

      try {
        const [historyRes, categoriesRes] = await Promise.all([
          api.get('/user/history'),
          api.get('/categories'),
        ]);

        if (!mounted) return;

        setHistory(normalizeHistoryPayload(historyRes.data));
        setCategories(normalizeCategoriesPayload(categoriesRes.data));
      } catch (err) {
        if (!mounted) return;
        setHistoryError(err?.response?.data?.message || err?.message || 'Не удалось загрузить профиль');
      } finally {
        if (mounted) setHistoryLoading(false);
      }
    }

    loadProfileData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!quizDraft.category_id && categories.length > 0) {
      setQuizDraft((current) => ({
        ...current,
        category_id: String(categories[0].id),
      }));
    }
  }, [categories, quizDraft.category_id]);

  const stats = useMemo(() => {
    const attempts = history.length;
    const passed = history.filter((item) => item?.is_passed).length;
    const totalScore = history.reduce((sum, item) => sum + Number(item?.score || 0), 0);
    const totalMax = history.reduce((sum, item) => sum + Number(item?.max_score || 0), 0);
    const percent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

    return { attempts, passed, totalScore, totalMax, percent };
  }, [history]);

  const recentHistory = history;

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditAvatarFile(file);
    setEditAvatarPreview(URL.createObjectURL(file));
  };

  const handleEditProfile = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    setEditMessage('');
    try {
      const formData = new FormData();
      formData.append('username', editUsername.trim());
      formData.append('bio', editBio.trim());
      if (editAvatarFile) formData.append('avatar', editAvatarFile);
      await api.put('/auth/profile', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setEditMessage('Профиль обновлён!');
      setEditAvatarFile(null);
    } catch (err) {
      setEditError(err?.response?.data?.message || 'Не удалось обновить профиль');
    } finally {
      setEditLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwMessage('');
    if (pwNew !== pwConfirm) return setPwError('Пароли не совпадают');
    if (pwNew.length < 6) return setPwError('Пароль должен быть не менее 6 символов');
    setPwLoading(true);
    try {
      await api.put('/auth/change-password', { currentPassword: pwCurrent, newPassword: pwNew });
      setPwMessage('Пароль успешно изменён!');
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    } catch (err) {
      setPwError(err?.response?.data?.message || 'Не удалось изменить пароль');
    } finally {
      setPwLoading(false);
    }
  };

  const handleDraftChange = (field, value) => {
    setQuizDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const addQuestion = () => {
    setQuizDraft((cur) => ({ ...cur, questions: [...cur.questions, makeEmptyQuestion()] }));
  };

  const removeQuestion = (idx) => {
    setQuizDraft((cur) => ({ ...cur, questions: cur.questions.filter((_, i) => i !== idx) }));
  };

  const updateQuestion = (idx, text) => {
    setQuizDraft((cur) => {
      const qs = [...cur.questions];
      qs[idx] = { ...qs[idx], text };
      return { ...cur, questions: qs };
    });
  };

  const updateAnswer = (qIdx, aIdx, text) => {
    setQuizDraft((cur) => {
      const qs = [...cur.questions];
      const answers = [...qs[qIdx].answers];
      answers[aIdx] = text;
      qs[qIdx] = { ...qs[qIdx], answers };
      return { ...cur, questions: qs };
    });
  };

  const setCorrect = (qIdx, aIdx) => {
    setQuizDraft((cur) => {
      const qs = [...cur.questions];
      qs[qIdx] = { ...qs[qIdx], correct: aIdx };
      return { ...cur, questions: qs };
    });
  };

  const handleCreateQuiz = async (event) => {
    event.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    setCreateMessage('');

    try {
      if (!quizDraft.questions.length) throw new Error('Добавьте хотя бы один вопрос');

      const questions = quizDraft.questions.map((q, index) => {
        const text = q.text.trim();
        if (!text) throw new Error(`Заполните текст вопроса ${index + 1}`);
        const answers = q.answers.map((a, aIdx) => ({
          text: a.trim(),
          is_correct: aIdx === q.correct,
        }));
        if (answers.some((a) => !a.text)) throw new Error(`Заполните все варианты ответа в вопросе ${index + 1}`);
        return { text, question_type: 'single', points: 1, order_num: index, answers };
      });

      const payload = {
        title: quizDraft.title.trim(),
        description: quizDraft.description.trim(),
        category_id: quizDraft.category_id ? Number(quizDraft.category_id) : null,
        quiz_type: quizDraft.quiz_type || 'classic',
        difficulty: 'medium',
        time_limit: quizDraft.timeLimitMinutes ? Number(quizDraft.timeLimitMinutes) * 60 : null,
        max_attempts: 3,
        is_public: 1,
        shuffle_questions: 1,
        shuffle_answers: 1,
        pass_score: 60,
        questions,
      };

      const response = await api.post('/quizzes', payload);
      setCreateMessage(response?.data?.message || 'Квиз создан. Теперь он доступен в каталоге.');
      setQuizDraft({ ...initialQuizDraft, questions: [makeEmptyQuestion()] });
    } catch (err) {
      setCreateError(err?.response?.data?.message || err?.message || 'Не удалось создать квиз');
    } finally {
      setCreateLoading(false);
    }
  };

  const hasCreateAccess = canCreateQuiz;

  return (
    <div className="profile-page">
      <div className="profile-container" style={shellStyle}>
        <div className="profile-top">
          <div>
            <p style={eyebrowStyle}>Profile</p>
            <h1 className="profile-name" style={titleStyle}>
              {getDisplayName(user)}
            </h1>
            <p style={subtitleStyle}>
              {isAdmin || role === 'creator'
                ? 'Управляйте квизами и просматривайте свою статистику.'
                : 'Просматривайте историю прохождений и управляйте профилем.'}
            </p>
          </div>

          <div style={roleCardStyle}>
            <div style={roleLabelStyle}>Account role</div>
            <div style={roleValueStyle}>{role}</div>
            <div style={roleMetaStyle}>{user?.email || 'No email available'}</div>
          </div>
        </div>

        <div className="stats-grid" style={statsGridStyle}>
          {[
            { label: 'Попыток', value: stats.attempts },
            { label: 'Сдано', value: stats.passed },
            { label: 'Баллов', value: stats.totalScore },
            { label: '% успеха', value: stats.percent },
          ].map((item) => (
            <div key={item.label} className="stat-card" style={statCardStyle}>
              <div style={statLabelStyle}>{item.label}</div>
              <div style={statValueStyle}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* История — на всю ширину */}
          <section className="profile-card" style={panelStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>История прохождений</h2>
              <span style={mutedText}>{historyLoading ? 'Загрузка…' : `${history.length} записей`}</span>
            </div>

            {historyError ? <div style={errorBoxStyle}>{historyError}</div> : null}

            {historyLoading ? (
              <div style={emptyBoxStyle}>Загружаем историю…</div>
            ) : recentHistory.length ? (
              <div style={stackStyle}>
                {recentHistory.map((item, index) => (
                  <div key={`${item?.uuid || item?.quiz_uuid || index}`} style={historyRowStyle}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={historyTitleStyle}>{item?.title || 'Без названия'}</div>
                      <div style={historyMetaStyle}>
                        {item?.quiz_type || 'classic'} ·{' '}
                        {item?.completed_at ? new Date(item.completed_at).toLocaleString('ru') : 'recently'}
                      </div>
                    </div>
                    <div style={{
                      ...historyScoreStyle,
                      color: Number(item?.percent_score) >= 80 ? '#10B981' : Number(item?.percent_score) >= 50 ? '#F59E0B' : '#EF4444'
                    }}>{Number(item?.percent_score || 0).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyBoxStyle}>
                <div style={{ fontSize: 40 }}>📋</div>
                <p style={{ margin: 0 }}>Ты ещё не проходил квизы</p>
                <Link to="/quizzes" style={linkButtonStyle}>
                  Перейти в каталог
                </Link>
              </div>
            )}
          </section>

          {/* Редактирование + Смена пароля в две колонки */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* ── Редактирование профиля ── */}
          <section className="profile-card" style={panelStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>👤 Редактировать профиль</h2>
            </div>
            <form onSubmit={handleEditProfile} style={formStyle}>
              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: editAvatarPreview ? 'transparent' : 'linear-gradient(135deg, #7C3AED, #14B8A6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, fontWeight: 800, color: '#fff', overflow: 'hidden',
                    border: '2px solid rgba(124,58,237,0.4)',
                  }}>
                    {editAvatarPreview
                      ? <img src={editAvatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : getDisplayName(user)?.[0]?.toUpperCase()}
                  </div>
                </div>
                <div>
                  <label style={{
                    display: 'inline-block', padding: '8px 16px', borderRadius: 10,
                    border: '1.5px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.08)',
                    color: '#c4b5fd', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>
                    📷 Сменить аватар
                    <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                  </label>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(167,139,250,0.5)' }}>JPG, PNG, WebP · до 5MB</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Имя пользователя</span>
                  <input style={inputStyle} value={editUsername} onChange={e => setEditUsername(e.target.value)} placeholder="Ваше имя" required />
                </label>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>О себе (bio)</span>
                  <textarea style={textareaStyle} value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Расскажите о себе..." rows={3} />
                </label>
              </div>

              {editError && <div style={{ ...errorBoxStyle, marginTop: 12 }}>⚠️ {editError}</div>}
              {editMessage && <div style={{ ...successBoxStyle, marginTop: 12 }}>✅ {editMessage}</div>}

              <button type="submit" disabled={editLoading} style={{ ...primaryButtonStyle, marginTop: 16 }}>
                {editLoading ? 'Сохраняем…' : '💾 Сохранить изменения'}
              </button>
            </form>
          </section>

          {/* ── Смена пароля ── */}
          <section className="profile-card" style={panelStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>🔒 Смена пароля</h2>
            </div>
            <form onSubmit={handleChangePassword} style={formStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Текущий пароль</span>
                  <input style={inputStyle} type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} placeholder="••••••••" required />
                </label>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Новый пароль</span>
                  <input style={inputStyle} type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="Минимум 6 символов" required />
                </label>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Подтвердите новый пароль</span>
                  <input style={inputStyle} type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder="Повторите пароль" required />
                </label>
              </div>

              {pwError && <div style={{ ...errorBoxStyle, marginTop: 12 }}>⚠️ {pwError}</div>}
              {pwMessage && <div style={{ ...successBoxStyle, marginTop: 12 }}>✅ {pwMessage}</div>}

              <button type="submit" disabled={pwLoading} style={{ ...primaryButtonStyle, marginTop: 16 }}>
                {pwLoading ? 'Меняем…' : '🔑 Изменить пароль'}
              </button>
            </form>
          </section>

          </div>
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

const titleStyle = {
  margin: 0,
  fontSize: 'clamp(2rem, 4vw, 3.5rem)',
};

const subtitleStyle = {
  margin: '10px 0 0',
  color: '#b0bac7',
  maxWidth: 760,
};

const roleCardStyle = {
  minWidth: 220,
  padding: 18,
  border: '1px solid rgba(142, 231, 200, 0.2)',
  background: 'rgba(8, 11, 16, 0.78)',
  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.35)',
};

const roleLabelStyle = {
  color: '#7de0b6',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 1.2,
};

const roleValueStyle = {
  marginTop: 8,
  fontSize: 24,
  fontWeight: 800,
  textTransform: 'capitalize',
};

const roleMetaStyle = {
  marginTop: 8,
  color: '#b0bac7',
  fontSize: 14,
};

const statsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 16,
  marginBottom: 28,
};

const statCardStyle = {
  padding: 18,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(14, 18, 27, 0.96)',
  boxShadow: '0 14px 42px rgba(0, 0, 0, 0.3)',
};

const statLabelStyle = {
  color: '#97a3b6',
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: 1,
};

const statValueStyle = {
  marginTop: 8,
  fontSize: 34,
  fontWeight: 800,
};

const contentGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.08fr) minmax(360px, 0.92fr)',
  gap: 22,
  alignItems: 'start',
};

const panelStyle = {
  padding: 22,
  background: 'rgba(12, 16, 24, 0.96)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 18px 54px rgba(0, 0, 0, 0.28)',
};

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 24,
};

const mutedText = {
  color: '#97a3b6',
  fontSize: 13,
};

const stackStyle = {
  marginTop: 18,
  display: 'grid',
  gap: 12,
};

const historyRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.07)',
  background: 'rgba(255,255,255,0.03)',
};

const historyTitleStyle = {
  fontWeight: 700,
  fontSize: 16,
  overflowWrap: 'anywhere',
};

const historyMetaStyle = {
  marginTop: 4,
  color: '#97a3b6',
  fontSize: 13,
};

const historyScoreStyle = {
  color: '#8ee7c8',
  fontWeight: 800,
  fontSize: 20,
  whiteSpace: 'nowrap',
};

const formStyle = {
  marginTop: 18,
  display: 'grid',
  gap: 14,
};


const questionCardStyle = {
  padding: 16,
  borderRadius: 14,
  border: '1px solid rgba(124, 58, 237, 0.2)',
  background: 'rgba(124, 58, 237, 0.04)',
  marginBottom: 12,
};

const questionNumStyle = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: 'rgba(124, 58, 237, 0.3)',
  color: '#c4b5fd',
  fontSize: 13,
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const removeQuestionBtnStyle = {
  background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.25)',
  color: '#f87171',
  borderRadius: 8,
  width: 28,
  height: 28,
  cursor: 'pointer',
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const addQuestionBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 18px',
  borderRadius: 12,
  border: '1px solid rgba(124, 58, 237, 0.35)',
  background: 'rgba(124, 58, 237, 0.08)',
  color: '#c4b5fd',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 14,
  marginTop: 4,
};

const heroInputGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.3fr) minmax(220px, 0.7fr)',
  gap: 12,
};

const threeColStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
};

const pillRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minHeight: 48,
  alignItems: 'center',
};

const pillStyle = {
  padding: '8px 10px',
  borderRadius: 999,
  border: '1px solid rgba(142, 231, 200, 0.16)',
  background: 'rgba(142, 231, 200, 0.08)',
  color: '#8ee7c8',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
};

const fieldStyle = {
  display: 'grid',
  gap: 8,
};

const fieldLabelStyle = {
  color: '#97a3b6',
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: 1,
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

const textareaStyle = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: 92,
};


const errorBoxStyle = {
  padding: 14,
  background: 'rgba(235, 87, 87, 0.08)',
  border: '1px solid rgba(235, 87, 87, 0.22)',
  color: '#ffb4b4',
};

const successBoxStyle = {
  padding: 14,
  background: 'rgba(48, 242, 184, 0.08)',
  border: '1px solid rgba(48, 242, 184, 0.22)',
  color: '#9af5d6',
};

const emptyBoxStyle = {
  padding: 18,
  background: 'rgba(255,255,255,0.03)',
  border: '1px dashed rgba(255,255,255,0.12)',
  color: '#b0bac7',
  display: 'grid',
  gap: 10,
  justifyItems: 'center',
  textAlign: 'center',
};

const linkButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 14px',
  border: '1px solid rgba(142, 231, 200, 0.25)',
  background: 'rgba(142, 231, 200, 0.08)',
  color: '#8ee7c8',
  textDecoration: 'none',
  fontWeight: 700,
};

const primaryButtonStyle = {
  padding: '13px 16px',
  border: '1px solid rgba(142, 231, 200, 0.28)',
  background: 'linear-gradient(135deg, rgba(142, 231, 200, 0.2), rgba(48, 242, 184, 0.08))',
  color: '#ecfff7',
  fontWeight: 800,
  letterSpacing: 0.3,
  cursor: 'pointer',
};

const helperTextStyle = {
  fontSize: 12,
  color: '#888',
  marginTop: 4
};

export default Profile;
