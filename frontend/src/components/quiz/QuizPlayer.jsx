import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
      text: question?.text || question?.prompt || `Question ${index + 1}`,
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
  quiz,
  questions,
  quizId,
  onDone,
  onBack,
  data,
  quizData,
}) {
  const navigate = useNavigate();
  const mergedQuiz = useMemo(() => quiz || data || quizData || {}, [data, quiz, quizData]);
  const quizUuid = useMemo(() => getQuizUuid(mergedQuiz, quizId), [mergedQuiz, quizId]);
  const normalizedQuestions = useMemo(
    () => normalizeQuestions(mergedQuiz, questions),
    [mergedQuiz, questions]
  );

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(
    mergedQuiz?.time_limit ? Number(mergedQuiz.time_limit) : null
  );

  const totalQuestions = normalizedQuestions.length;
  const currentQuestion = normalizedQuestions[current];

  useEffect(() => {
    if (mergedQuiz?.time_limit) {
      setTimeLeft(Number(mergedQuiz.time_limit));
    }
  }, [mergedQuiz?.time_limit]);

  useEffect(() => {
    if (timeLeft == null) return undefined;
    if (timeLeft <= 0) {
      handleSubmit();
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setTimeLeft((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [timeLeft]);

  const progress = useMemo(() => {
    if (!totalQuestions) return 0;
    return ((current + 1) / totalQuestions) * 100;
  }, [current, totalQuestions]);

  const handleSelect = (answerId) => {
    const questionId = currentQuestion?.id;
    if (questionId == null) return;
    setSelected((prev) => ({
      ...prev,
      [questionId]: answerId,
    }));
  };

  const handleSubmit = async () => {
    if (submitting || !quizUuid) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await api.post(`/quizzes/${quizUuid}/attempt`, {
        answers: selected,
        time_spent: mergedQuiz?.time_limit ? mergedQuiz.time_limit - (timeLeft ?? 0) : 0,
        violations: [],
      });

      setResult(response.data || {});
      if (typeof onDone === 'function') {
        onDone(response.data || {});
      }
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
    if (typeof onBack === 'function') {
      onBack();
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/quizzes');
  };

  if (!normalizedQuestions.length) {
    return (
      <div className="quiz-page quiz-page--empty">
        <div className="quiz-page__status">
          <p>У этого квиза пока нет вопросов для прохождения.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" onClick={handleBack}>
              Вернуться назад
            </button>
            <Link to="/quizzes">Перейти в каталог</Link>
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

    return (
      <div className="quiz-page quiz-page--empty">
        <div className="quiz-page__status" style={{ maxWidth: 720 }}>
          <p style={{ fontSize: 22, marginBottom: 6 }}>{passed ? 'Квиз пройден!' : 'Попробуй ещё раз'}</p>
          <p style={{ marginBottom: 0 }}>
            Результат: {percent.toFixed(0)}% — {score}/{maxScore}
          </p>
          {error ? <p style={{ color: '#ffb4b4' }}>{error}</p> : null}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" onClick={handleBack}>
              Вернуться назад
            </button>
            <button type="button" onClick={() => window.location.reload()}>
              Пройти ещё раз
            </button>
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
          <button type="button" onClick={handleBack}>
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <div className="quiz-page__shell">
        <div className="quiz-player">
          <div className="quiz-player__top">
            <div className="quiz-player__meta">
              <span className="quiz-player__badge">{mergedQuiz?.quiz_type || 'classic'}</span>
              {mergedQuiz?.difficulty ? <span className="quiz-player__badge">{mergedQuiz.difficulty}</span> : null}
              {timeLeft != null ? (
                <span className="quiz-player__timer">⏱ {formatTimeLeft(timeLeft)}</span>
              ) : null}
            </div>

            <div className="quiz-player__counter">
              {current + 1} / {totalQuestions}
            </div>
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
                onClick={() => setCurrent((value) => Math.max(0, value - 1))}
                disabled={current === 0 || submitting}
              >
                Назад
              </button>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {current < normalizedQuestions.length - 1 ? (
                  <button
                    type="button"
                    className="quiz-player__primary"
                    onClick={() => setCurrent((value) => Math.min(normalizedQuestions.length - 1, value + 1))}
                    disabled={submitting}
                  >
                    Далее
                  </button>
                ) : (
                  <button
                    type="button"
                    className="quiz-player__primary"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? 'Отправляем…' : 'Завершить'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
