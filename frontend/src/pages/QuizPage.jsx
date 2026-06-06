import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import QuizPlayer from '../components/quiz/QuizPlayer';

function normalizeQuiz(payload) {
  const rawQuiz = payload?.quiz ?? payload?.data?.quiz ?? payload?.data ?? payload;

  if (!rawQuiz || typeof rawQuiz !== 'object') {
    return null;
  }

  const questions = Array.isArray(rawQuiz.questions)
    ? rawQuiz.questions
    : Array.isArray(rawQuiz.quiz_questions)
      ? rawQuiz.quiz_questions
      : Array.isArray(rawQuiz.items)
        ? rawQuiz.items
        : [];

  return {
    ...rawQuiz,
    questions,
  };
}

export default function QuizPage() {
  const { uuid } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, checkAttemptsLimit } = useAuth();

  const initialQuiz = useMemo(() => {
    return location.state?.quiz ? normalizeQuiz({ quiz: location.state.quiz }) : null;
  }, [location.state?.quiz]);

  const routeQuizUuid = useMemo(() => {
    return uuid || initialQuiz?.uuid || initialQuiz?.id || initialQuiz?._id || '';
  }, [initialQuiz?._id, initialQuiz?.id, initialQuiz?.uuid, uuid]);

  const [quiz, setQuiz] = useState(initialQuiz);
  const [loading, setLoading] = useState(!(initialQuiz && Array.isArray(initialQuiz.questions) && initialQuiz.questions.length > 0));
  const [error, setError] = useState('');
  
  // Новые состояния для лимита попыток
  const [attemptsCheck, setAttemptsCheck] = useState({ allowed: true, attemptsLeft: null, message: '' });
  const [checkingAttempts, setCheckingAttempts] = useState(false);

  // Загрузка квиза
  useEffect(() => {
    let isActive = true;
    const hasQuestions = Array.isArray(initialQuiz?.questions) && initialQuiz.questions.length > 0;

    if (initialQuiz && hasQuestions) {
      setQuiz(initialQuiz);
      setLoading(false);
      setError('');
      return () => {
        isActive = false;
      };
    }

    if (!routeQuizUuid) {
      setQuiz(null);
      setLoading(false);
      setError('Не удалось открыть квиз: не найден идентификатор.');
      return () => {
        isActive = false;
      };
    }

    const loadQuiz = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await api.get(`/quizzes/${routeQuizUuid}`);
        const normalizedQuiz = normalizeQuiz(response.data);

        if (!isActive) {
          return;
        }

        if (!normalizedQuiz) {
          setQuiz(null);
          setError('Квиз не найден или не содержит данных для прохождения.');
          return;
        }

        setQuiz(normalizedQuiz);
      } catch (requestError) {
        if (!isActive) {
          return;
        }

        const message =
          requestError?.response?.data?.message ||
          requestError?.message ||
          'Не удалось загрузить квиз. Попробуйте открыть его ещё раз.';

        setQuiz(null);
        setError(message);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadQuiz();

    return () => {
      isActive = false;
    };
  }, [initialQuiz, routeQuizUuid]);

  // Проверка лимита попыток (только для авторизованных пользователей)
  useEffect(() => {
    const checkAttempts = async () => {
      if (!user || !quiz || !routeQuizUuid) return;
      
      setCheckingAttempts(true);
      try {
        const check = await checkAttemptsLimit(routeQuizUuid);
        setAttemptsCheck(check);
      } catch (err) {
        console.error('Failed to check attempts limit:', err);
        // Если ошибка, всё равно разрешаем прохождение, но логируем
        setAttemptsCheck({ allowed: true, attemptsLeft: null, message: '' });
      } finally {
        setCheckingAttempts(false);
      }
    };

    checkAttempts();
  }, [user, quiz, routeQuizUuid, checkAttemptsLimit]);

  if (loading || checkingAttempts) {
    return (
      <div className="quiz-page quiz-page--loading">
        <div className="quiz-page__status">
          <div className="spinner"></div>
          <p>{checkingAttempts ? 'Проверяем доступные попытки...' : 'Загружаем квиз…'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-page quiz-page--error">
        <div className="quiz-page__status">
          <p>{error}</p>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-outline">
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="quiz-page quiz-page--empty">
        <div className="quiz-page__status">
          <p>Квиз не удалось открыть.</p>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-outline">
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  // Проверка лимита попыток
  if (!attemptsCheck.allowed) {
    return (
      <div className="quiz-page quiz-page--blocked">
        <div className="quiz-page__status" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
          <h2 style={{ marginBottom: 12 }}>Лимит попыток исчерпан</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
            {attemptsCheck.message || 'Вы использовали все доступные попытки для этого квиза.'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button type="button" onClick={() => navigate(-1)} className="btn btn-outline">
              ← Назад
            </button>
            <button type="button" onClick={() => navigate('/quizzes')} className="btn btn-primary">
              В каталог
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return (
      <div className="quiz-page quiz-page--empty">
        <div className="quiz-page__status">
          <p>У этого квиза пока нет вопросов для прохождения.</p>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-outline">
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <QuizPlayer 
      quiz={quiz} 
      questions={quiz.questions} 
      data={quiz} 
      quizData={quiz} 
      quizId={routeQuizUuid}
      attemptsLeft={attemptsCheck.attemptsLeft}
    />
  );
}
