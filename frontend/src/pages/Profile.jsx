import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import './Profile.css';

const EXAMPLE_QUIZ_QUESTIONS = [
  {
    text: 'Какой океан является самым большим на Земле?',
    question_type: 'single',
    points: 1,
    explanation: 'Тихий океан — крупнейший по площади и объёму.',
    answers: [
      { text: 'Тихий океан', is_correct: true },
      { text: 'Атлантический океан', is_correct: false },
      { text: 'Индийский океан', is_correct: false },
      { text: 'Северный Ледовитый океан', is_correct: false },
    ],
  },
  {
    text: 'Какие из этих языков являются JavaScript-фреймворками?',
    question_type: 'multiple',
    points: 2,
    explanation: 'В этом примере можно отметить несколько вариантов.',
    answers: [
      { text: 'React', is_correct: true },
      { text: 'Vue', is_correct: true },
      { text: 'HTML', is_correct: false },
      { text: 'Node.js', is_correct: false },
    ],
  },
];

const EXAMPLE_QUIZ_JSON = JSON.stringify(EXAMPLE_QUIZ_QUESTIONS, null, 2);

const initialQuizDraft = {
  title: '',
  description: '',
  category_id: '',
  quiz_type: 'classic',
  timeLimitMinutes: '',
  questionsJson: EXAMPLE_QUIZ_JSON,
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

function buildQuestionsFromDraft(questionsJson) {
  const parsed = JSON.parse(questionsJson);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Добавьте хотя бы один вопрос');
  }

  return parsed.map((question, index) => {
    const text = String(question?.text || question?.prompt || '').trim();
    if (!text) {
      throw new Error(`В вопросе ${index + 1} не заполнен текст`);
    }

    const answersSource = Array.isArray(question?.answers)
      ? question.answers
      : Array.isArray(question?.options)
        ? question.options.map((option, optionIndex) => ({
            text: option,
            is_correct: optionIndex === Number(question?.answerIndex ?? question?.correctIndex ?? 0),
          }))
        : [];

    if (!answersSource.length) {
      throw new Error(`В вопросе ${index + 1} нет вариантов ответа`);
    }

    const answers = answersSource.map((answer, answerIndex) => ({
      text: String(answer?.text || answer?.label || answer || '').trim(),
      is_correct: Boolean(
        answer?.is_correct ?? answer?.correct ?? answerIndex === Number(question?.answerIndex ?? question?.correctIndex ?? 0)
      ),
    }));

    if (!answers.some((answer) => answer.is_correct)) {
      throw new Error(`В вопросе ${index + 1} должен быть хотя бы один правильный ответ`);
    }

    return {
      text,
      question_type: question?.question_type || question?.type || 'single',
      explanation: String(question?.explanation || '').trim() || null,
      points: Number(question?.points || 1) || 1,
      time_limit: question?.time_limit ? Number(question.time_limit) : null,
      order_num: index,
      answers,
    };
  });
}

function parseQuestionsFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const content = String(reader.result || '');
        const parsed = JSON.parse(content);

        if (!Array.isArray(parsed)) {
          throw new Error('JSON-файл должен содержать массив вопросов');
        }

        resolve(content);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Не удалось прочитать JSON-файл'));
    };

    reader.readAsText(file);
  });
}

function Profile() {
  const { user } = useAuth();
  const role = user?.role || 'user';
  const isAdmin = role === 'admin';
  const canCreateQuiz = Boolean(user);

  const questionsInputRef = useRef(null);

  const [history, setHistory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState('');
  const [createError, setCreateError] = useState('');
  const [questionsFileName, setQuestionsFileName] = useState('');
  const [quizDraft, setQuizDraft] = useState(initialQuizDraft);

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

  const recentHistory = history.slice(0, 5);

  const handleDraftChange = (field, value) => {
    setQuizDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleDownloadExample = () => {
    const blob = new Blob([EXAMPLE_QUIZ_JSON], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'quiz-example.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleQuestionsFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCreateError('');
    try {
      const content = await parseQuestionsFile(file);
      setQuizDraft((current) => ({
        ...current,
        questionsJson: content,
      }));
      setQuestionsFileName(file.name);
      setCreateMessage(`Файл ${file.name} загружен`);
    } catch (error) {
      setQuestionsFileName('');
      setCreateError(error?.message || 'Не удалось загрузить JSON-файл');
    } finally {
      event.target.value = '';
    }
  };

  const handleCreateQuiz = async (event) => {
    event.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    setCreateMessage('');

    try {
      const questions = buildQuestionsFromDraft(quizDraft.questionsJson);

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
      setQuizDraft(initialQuizDraft);
      setQuestionsFileName('');
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
              Смотрите историю прохождений и создавайте квизы из красивой формы с поддержкой JSON-файлов.
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

        <div className="profile-grid" style={contentGridStyle}>
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
                    <div style={historyScoreStyle}>{Number(item?.percent_score || 0).toFixed(0)}%</div>
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

          {hasCreateAccess ? (
            <section className="profile-card" style={panelStyle} id="create-quiz">
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>Создать квиз</h2>
                  <p style={helperTextStyle}>
                    Заполни поля вручную или загрузи готовый JSON. Для примера можно скачать шаблон ниже.
                  </p>
                </div>
                {isAdmin ? (
                  <Link to="/admin" style={linkButtonStyle}>
                    Админ-панель
                  </Link>
                ) : null}
              </div>

              <div style={builderToolbarStyle}>
                <button type="button" onClick={handleDownloadExample} style={secondaryButtonStyle}>
                  Скачать пример JSON
                </button>
                <label style={secondaryButtonStyle}>
                  <input
                    ref={questionsInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleQuestionsFileUpload}
                    style={{ display: 'none' }}
                  />
                  <span>Загрузить JSON-файл</span>
                </label>
                {questionsFileName ? <span style={fileBadgeStyle}>Файл: {questionsFileName}</span> : null}
              </div>

              <form onSubmit={handleCreateQuiz} style={formStyle}>
                <div style={heroInputGridStyle}>
                  <label style={fieldStyle}>
                    <span style={fieldLabelStyle}>Название квиза</span>
                    <input
                      value={quizDraft.title}
                      onChange={(e) => handleDraftChange('title', e.target.value)}
                      placeholder="Например, Великие учёные"
                      required
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldStyle}>
                    <span style={fieldLabelStyle}>Категория</span>
                    <select
                      value={quizDraft.category_id}
                      onChange={(e) => handleDraftChange('category_id', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Без категории</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={threeColStyle}>
                  <label style={fieldStyle}>
                    <span style={fieldLabelStyle}>Тип квиза</span>
                    <select
                      value={quizDraft.quiz_type}
                      onChange={(e) => handleDraftChange('quiz_type', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="classic">classic</option>
                      <option value="timed">timed</option>
                      <option value="picture">picture</option>
                      <option value="learning">learning</option>
                      <option value="open">open</option>
                      <option value="team">team</option>
                    </select>
                  </label>

                  <label style={fieldStyle}>
                    <span style={fieldLabelStyle}>Время, минут</span>
                    <input
                      type="number"
                      min="1"
                      value={quizDraft.timeLimitMinutes}
                      onChange={(e) => handleDraftChange('timeLimitMinutes', e.target.value)}
                      placeholder="Необязательно"
                      style={inputStyle}
                    />
                  </label>

                  <label style={fieldStyle}>
                    <span style={fieldLabelStyle}>Параметры</span>
                    <div style={pillRowStyle}>
                      <span style={pillStyle}>public</span>
                      <span style={pillStyle}>shuffle q/a</span>
                      <span style={pillStyle}>pass 60%</span>
                    </div>
                  </label>
                </div>

                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Описание</span>
                  <textarea
                    value={quizDraft.description}
                    onChange={(e) => handleDraftChange('description', e.target.value)}
                    placeholder="Короткое описание квиза"
                    rows={3}
                    style={textareaStyle}
                  />
                </label>

                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>Вопросы JSON</span>
                  <textarea
                    value={quizDraft.questionsJson}
                    onChange={(e) => handleDraftChange('questionsJson', e.target.value)}
                    rows={14}
                    style={{ ...textareaStyle, minHeight: 260, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                  />
                </label>

                <div style={hintGridStyle}>
                  <div style={hintCardStyle}>
                    <div style={hintTitleStyle}>Как выглядит JSON</div>
                    <p style={hintTextStyle}>
                      Это массив вопросов. В каждом вопросе должен быть текст, варианты ответов и хотя бы один
                      правильный ответ.
                    </p>
                  </div>
                  <div style={hintCardStyle}>
                    <div style={hintTitleStyle}>Подсказка</div>
                    <p style={hintTextStyle}>
                      Можно скачать пример, отредактировать его в любом редакторе и загрузить обратно одной кнопкой.
                    </p>
                  </div>
                </div>

                {createError ? <div style={errorBoxStyle}>{createError}</div> : null}
                {createMessage ? <div style={successBoxStyle}>{createMessage}</div> : null}

                <button type="submit" disabled={createLoading} style={primaryButtonStyle}>
                  {createLoading ? 'Создаём…' : 'Создать квиз'}
                </button>
              </form>
            </section>
          ) : null}
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

const builderToolbarStyle = {
  marginTop: 18,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
};

const secondaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '12px 16px',
  borderRadius: 14,
  border: '1px solid rgba(142, 231, 200, 0.22)',
  background: 'rgba(142, 231, 200, 0.06)',
  color: '#e7fff5',
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
};

const fileBadgeStyle = {
  padding: '10px 12px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: '#b0bac7',
  fontSize: 13,
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

const hintGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
};

const hintCardStyle = {
  padding: 16,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.03)',
};

const hintTitleStyle = {
  fontSize: 14,
  fontWeight: 800,
  marginBottom: 8,
  color: '#f4f7fb',
};

const hintTextStyle = {
  margin: 0,
  color: '#b0bac7',
  lineHeight: 1.55,
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
