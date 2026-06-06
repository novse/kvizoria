import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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

  const initialQuiz = useMemo(() => {
    return location.state?.quiz ? normalizeQuiz({ quiz: location.state.quiz }) : null;
  }, [location.state?.quiz]);

  const routeQuizUuid = useMemo(() => {
    return uuid || initialQuiz?.uuid || initialQuiz?.id || initialQuiz?._id || '';
  }, [initialQuiz?._id, initialQuiz?.id, initialQuiz?.uuid, uuid]);

  const [quiz, setQuiz] = useState(initialQuiz);
  const [loading, setLoading] = useState(!(initialQuiz && Array.isArray(initialQuiz.questions) && initialQuiz.questions.length > 0));
  const [error, setError] = useState('');

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

  if (loading) {
    return (
      <div className="quiz-page quiz-page--loading">
        <div className="quiz-page__status">
          <p>Загружаем квиз…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-page quiz-page--error">
        <div className="quiz-page__status">
          <p>{error}</p>
          <button type="button" onClick={() => navigate(-1)}>
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
          <button type="button" onClick={() => navigate(-1)}>
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return (
      <div className="quiz-page quiz-page--empty">
        <div className="quiz-page__status">
          <p>У этого квиза пока нет вопросов для прохождения.</p>
          <button type="button" onClick={() => navigate(-1)}>
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  return <QuizPlayer quiz={quiz} questions={quiz.questions} data={quiz} quizData={quiz} quizId={routeQuizUuid} />;
}