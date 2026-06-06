import React from 'react';
import { Link } from 'react-router-dom';
import './QuizCard.css';

const TYPE_LABELS = {
  classic: 'Классика', timed: 'На время', picture: 'С картинками',
  open: 'Открытый', learning: 'Обучающий', team: 'Командный'
};

const DIFF_LABELS = { easy: 'Лёгкий', medium: 'Средний', hard: 'Сложный' };

export default function QuizCard({ quiz }) {
  const imgSrc = quiz.cover_image
    ? (quiz.cover_image.startsWith('http') ? quiz.cover_image
      : `${window.location.origin}${quiz.cover_image}`)
    : null;

  return (
    <Link to={`/quiz/${quiz.uuid}`} className="quiz-card">
      <div className="quiz-card-img">
        {imgSrc
          ? <img src={imgSrc} alt={quiz.title} loading="lazy" />
          : <div className="quiz-card-placeholder">{quiz.category_icon || '🎯'}</div>
        }
        <span className={`diff-badge diff-${quiz.difficulty}`}>{DIFF_LABELS[quiz.difficulty]}</span>
      </div>
      <div className="quiz-card-body">
        <div className="quiz-card-meta">
          <span className="type-label">{TYPE_LABELS[quiz.quiz_type] || quiz.quiz_type}</span>
          {quiz.category_name && (
            <span className="cat-label">{quiz.category_icon} {quiz.category_name}</span>
          )}
        </div>
        <h3 className="quiz-card-title">{quiz.title}</h3>
        {quiz.description && (
          <p className="quiz-card-desc">{quiz.description.slice(0, 90)}{quiz.description.length > 90 ? '…' : ''}</p>
        )}
        <div className="quiz-card-footer">
          <span className="quiz-card-stat">📝 {quiz.questions_count || 0} вопр.</span>
          <span className="quiz-card-stat">▶ {(quiz.plays_count || 0).toLocaleString()}</span>
          {quiz.time_limit && <span className="quiz-card-stat">⏱ {Math.floor(quiz.time_limit / 60)} мин</span>}
          <span className="quiz-card-author">@{quiz.author_name}</span>
        </div>
      </div>
    </Link>
  );
}
