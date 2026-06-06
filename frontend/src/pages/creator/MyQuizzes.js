import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import { Link } from 'react-router-dom';

export default function MyQuizzes() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      const res = await api.get('/creator/quizzes');
      setQuizzes(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  const deleteQuiz = async (id) => {
    if (!window.confirm('Удалить квиз?')) return;
    try {
      await api.delete(`/creator/quizzes/${id}`);
      loadQuizzes();
    } catch (err) {
      alert('Ошибка удаления');
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Мои квизы</h1>
        <Link to="/creator/quizzes/new">
          <button style={buttonStyle}>+ Создать квиз</button>
        </Link>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
        {quizzes.map((quiz) => (
          <div key={quiz.id} style={cardStyle}>
            <div>
              <h3 style={{ margin: '0 0 8px' }}>{quiz.title}</h3>
              <p style={{ margin: 0, color: '#666' }}>{quiz.description || 'Нет описания'}</p>
              <small>Статус: {quiz.is_published ? '✅ Опубликован' : '📝 Черновик'}</small>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Link to={`/creator/quizzes/${quiz.id}/edit`}>
                <button style={{ ...buttonStyle, background: '#2196f3' }}>✏️ Редактировать</button>
              </Link>
              <button onClick={() => deleteQuiz(quiz.id)} style={{ ...buttonStyle, background: '#f44336' }}>
                🗑️ Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const buttonStyle = {
  padding: '10px 20px',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  color: 'white',
  background: '#4caf50',
  fontWeight: 'bold',
};

const cardStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 20,
  border: '1px solid #ddd',
  borderRadius: 12,
  background: '#fff',
};