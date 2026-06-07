import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import './QuizPlayer.css';

function getQuizUuid(quiz, quizId) {
  return quiz?.uuid || quiz?.quiz_uuid || quiz?.id || quizId || '';
}

function normalizeQuestions(quiz, questions) {
  const source = Array.isArray(questions)
    ? questions
    : Array.isArray(quiz?.questions)
      ? quiz.questions
      : [];
  return source.map((question, index) => {
    const answers = Array.isArray(question?.answers) ? question.answers : [];
    return {
      id: question?.id ?? question?.question_id ?? index,
      text: question?.text || question?.prompt || `Вопрос ${index + 1}`,
      image: question?.image || question?.cover_image || null,
      explanation: question?.explanation || '',
      answers: answers.map((answer, answerIndex) => ({
        id: answer?.id ?? answer?.answer_id ?? answer?.value ?? answerIndex,
        text: answer?.text || answer?.label || answer?.title || String(answer ?? ''),
        is_correct: Boolean(answer?.is_correct ?? answer?.correct ?? false),
      })),
    };
  });
}

function formatTimeLeft(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '';
  const total = Math.max(0, Number(seconds));
  const mins = String(Math.floor(total / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function QuizPlayer({
  quiz, questions, quizId, onDone, onBack, data, quizData, attemptsLeft,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mergedQuiz = useMemo(() => quiz || data || quizData || {}, [data, quiz, quizData]);
  const quizUuid = useMemo(() => getQuizUuid(mergedQuiz, quizId), [mergedQuiz, quizId]);

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(
    mergedQuiz?.time_limit ? Number(mergedQuiz.time_limit) : null
  );
  const [violations, setViolations] = useState([]);
  const [tabWarning, setTabWarning] = useState(false);

  const shuffledQuestions = useMemo(() => {
    const source = normalizeQuestions(mergedQuiz, questions);
    if (!source.length) return [];
    const shuffled = [...source];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.map(q => ({
      ...q,
      answers: [...q.answers].sort(() => Math.random() - 0.5)
    }));
  }, [mergedQuiz, questions]);

  const totalQuestions = shuffledQuestions.length;
  const currentQuestion = shuffledQuestions[current];

  const logViolation = useCallback(async (type) => {
    const violation = { type, timestamp: Date.now() };
    setViolations(prev => [...prev, violation]);
    try {
      await api.post(`/quizzes/${quizUuid}/violation`, violation);
    } catch (err) {
      console.error('Failed to log violation:', err);
    }
  }, [quizUuid]);

  // === 1. МОНИТОРИНГ ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК ===
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab_switch');
        setTabWarning(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [logViolation]);

  // === 2. БЛОКИРОВКА КОПИРОВАНИЯ (событие copy + Ctrl+C / Cmd+C) ===
  useEffect(() => {
    const handleCopy = (e) => {
      e.preventDefault();
      logViolation('copy_attempt');
      return false;
    };
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [logViolation]);

  // === 3. БЛОКИРОВКА ПРАВОЙ КНОПКИ МЫШИ ===
  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
      logViolation('right_click');
      return false;
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, [logViolation]);

  // === 4. БЛОКИРОВКА CTRL+C (keydown), CTRL+V, CTRL+U, CTRL+S, F12 ===
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        logViolation('devtools_open');
        return false;
      }
      // Ctrl+C и Cmd+C (macOS)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        logViolation('copy_attempt');
        return false;
      }
      if (e.ctrlKey && ['v', 'u', 's'].includes(e.key)) {
        e.preventDefault();
        logViolation(`ctrl_${e.key}`);
        return false;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [logViolation]);

  // === 5. ТАЙМЕР ===
  useEffect(() => {
    if (mergedQuiz?.time_limit) setTimeLeft(Number(mergedQuiz.time_limit));
  }, [mergedQuiz?.time_limit]);

  useEffect(() => {
    if (timeLeft == null) return;
    if (timeLeft <= 0 && !result && !submitting && totalQuestions > 0) {
      handleSubmit();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, result, submitting, totalQuestions]);

  const progress = useMemo(() => {
    if (!totalQuestions) return 0;
    return ((current + 1) / totalQuestions) * 100;
  }, [current, totalQuestions]);

  const handleSelect = (answerId) => {
    const questionId = currentQuestion?.id;
    if (questionId == null) return;
    setSelected((prev) => ({ ...prev, [questionId]: answerId }));
  };

  const handleSubmit = async () => {
    if (submitting || !quizUuid || !user) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await api.post(`/quizzes/${quizUuid}/attempt`, {
        answers: selected,
        time_spent: mergedQuiz?.time_limit ? mergedQuiz.time_limit - (timeLeft ?? 0) : 0,
        violations,
      });
      setResult(response.data || {});
      if (typeof onDone === 'function') onDone(response.data || {});
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
        requestError?.message ||
        'Не удалось отправить результаты квиза.'
      );
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (typeof onBack === 'function') { onBack(); return; }
    if (window.history.length > 1) { navigate(-1); return; }
    navigate('/quizzes');
  };

  if (!shuffledQuestions.length) {
    return (
      <div className="quiz-page quiz-page--empty">
        <div className="quiz-page__status">
          <p>У этого квиза пока нет вопросов для прохождения.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" onClick={handleBack} className="btn btn-outline">Вернуться назад</button>
            <Link to="/quizzes" className="btn btn-primary">Перейти в каталог</Link>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    const percent = Number(result?.percent ?? result?.percent_score ?? 0);
    const score = Number(result?.score ?? 0);
    const maxScore = Number(result?.maxScore ?? result?.max_score ?? 0);
    const passed = Boolean(result?.isPassed ?? result?.is_passed);
    const violationsCount = violations.length;
    return (
      <div className="quiz-page quiz-page--result">
        <div className="quiz-page__status" style={{ maxWidth: 720 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{passed ? '🏆' : '📚'}</div>
          <h2 style={{ marginBottom: 12 }}>{passed ? 'Квиз пройден!' : 'Попробуй ещё раз'}</h2>
          <p style={{ fontSize: 32, fontWeight: 'bold', margin: '16px 0' }}>
            {percent.toFixed(0)}% — {score}/{maxScore}
          </p>
          {violationsCount > 0 && (
            <div className="violations-warning">⚠️ Зафиксировано нарушений: {violationsCount}</div>
          )}
          {error && <p style={{ color: '#ffb4b4' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 24 }}>
            <button type="button" onClick={handleBack} className="btn btn-outline">Вернуться назад</button>
            <button type="button" onClick={() => window.location.reload()} className="btn btn-primary">Пройти ещё раз</button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="quiz-page quiz-page--error">
        <div className="quiz-page__status">
          <p>Не удалось загрузить вопрос квиза.</p>
          <button type="button" onClick={handleBack} className="btn btn-outline">Вернуться назад</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <div className="quiz-page__shell">
        <div className="quiz-player">

          {/* Предупреждение о переключении вкладки */}
          {tabWarning && (
            <div className="quiz-player__tab-warning">
              <div className="quiz-player__tab-warning-inner">
                <span style={{ fontSize: 32 }}>⚠️</span>
                <strong>Нарушение зафиксировано!</strong>
                <p>Вы переключились на другую вкладку или свернули браузер. Нарушение записано.</p>
                <button type="button" className="quiz-player__primary" onClick={() => setTabWarning(false)}>
                  Продолжить квиз
                </button>
              </div>
            </div>
          )}

          <div className="quiz-player__top">
            <div className="quiz-player__meta">
              <span className="quiz-player__badge">{mergedQuiz?.quiz_type || 'classic'}</span>
              {mergedQuiz?.difficulty ? <span className="quiz-player__badge">{mergedQuiz.difficulty}</span> : null}
              {attemptsLeft !== undefined && attemptsLeft !== null && attemptsLeft <= 3 && (
                <span className={`quiz-player__badge ${attemptsLeft === 1 ? 'badge-danger' : 'badge-warning'}`}>
                  ⚠️ {attemptsLeft === 1 ? 'Последняя попытка!' : `Осталось: ${attemptsLeft}`}
                </span>
              )}
              {timeLeft != null ? (
                <span className="quiz-player__timer">⏱ {formatTimeLeft(timeLeft)}</span>
              ) : null}
            </div>
            <div className="quiz-player__counter">{current + 1} / {totalQuestions}</div>
          </div>

          <div className="quiz-player__progress">
            <div className="quiz-player__progress-bar" style={{ width: `${progress}%` }} />
          </div>

          <div className="quiz-player__card">
            <div className="quiz-player__question-index">Вопрос {current + 1}</div>
            <h1 className="quiz-player__question">{currentQuestion.text}</h1>

            {currentQuestion.image ? (
              <div className="quiz-player__image-wrap">
                <img
                  src={currentQuestion.image.startsWith('http')
                    ? currentQuestion.image
                    : `${window.location.origin}${currentQuestion.image}`}
                  alt={currentQuestion.text}
                />
              </div>
            ) : null}

            <div className="quiz-player__answers">
              {currentQuestion.answers.map((answer) => {
                const isSelected = selected[currentQuestion.id] === answer.id;
                return (
                  <button
                    key={answer.id}
                    type="button"
                    className={`quiz-player__answer ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(answer.id)}
                  >
                    {answer.text}
                  </button>
                );
              })}
            </div>

            {error ? <div className="quiz-player__error">{error}</div> : null}

            <div className="quiz-player__actions">
              <button
                type="button"
                className="quiz-player__secondary"
                onClick={() => setCurrent((v) => Math.max(0, v - 1))}
                disabled={current === 0 || submitting}
              >
                ← Назад
              </button>
              {current < shuffledQuestions.length - 1 ? (
                <button
                  type="button"
                  className="quiz-player__primary"
                  onClick={() => setCurrent((v) => Math.min(shuffledQuestions.length - 1, v + 1))}
                  disabled={submitting}
                >
                  Далее →
                </button>
              ) : (
                <button
                  type="button"
                  className="quiz-player__primary quiz-player__submit"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Отправляем…' : '✅ Завершить'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
