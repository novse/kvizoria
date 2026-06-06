import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import './CreateQuizForm.css';

const DIFFICULTIES = [
  { value: 'easy',   label: '🟢 Лёгкий',  color: '#10B981' },
  { value: 'medium', label: '🟡 Средний', color: '#F59E0B' },
  { value: 'hard',   label: '🔴 Сложный', color: '#EF4444' },
];

const QUIZ_TYPES = [
  { value: 'classic',  label: 'Классический' },
  { value: 'timed',    label: 'На время' },
  { value: 'picture',  label: 'С картинками' },
  { value: 'learning', label: 'Обучающий' },
];

const makeAnswer = () => ({ text: '', is_correct: false });
const makeQuestion = () => ({
  text: '',
  explanation: '',
  time_limit: '',
  answers: [
    { text: '', is_correct: true },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ],
});

export default function CreateQuizForm({ isAdmin }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = !!id;
  const coverInputRef = useRef(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    quiz_type: 'classic',
    difficulty: 'medium',
    time_limit: '',
    category_id: '',
  });
  const [questions, setQuestions] = useState([makeQuestion()]);
  const [categories, setCategories] = useState([]);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data || []));
    if (isEdit) {
      const endpoint = isAdmin ? `/admin/quizzes/${id}/edit` : `/creator/quizzes/${id}`;
      api.get(endpoint).then(r => {
        const q = r.data;
        setForm({
          title: q.title || '',
          description: q.description || '',
          quiz_type: q.quiz_type || 'classic',
          difficulty: q.difficulty || 'medium',
          time_limit: q.time_limit ? Math.floor(q.time_limit / 60) : '',
          category_id: q.category_id || '',
        });
        if (q.cover_image) setCoverPreview(q.cover_image.startsWith('http') ? q.cover_image : `${window.location.origin}${q.cover_image}`);
        if (q.questions?.length) {
          setQuestions(q.questions.map(qq => ({
            text: qq.text || '',
            explanation: qq.explanation || '',
            time_limit: qq.time_limit || '',
            answers: qq.answers?.map(a => ({ text: a.text || '', is_correct: !!a.is_correct })) || [makeAnswer(), makeAnswer(), makeAnswer(), makeAnswer()],
          })));
        }
      });
    }
  }, [id, isAdmin, isEdit]);

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const removeCover = () => {
    setCoverFile(null);
    setCoverPreview('');
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  // Question helpers
  const updateQuestion = (qIdx, field, value) => {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, [field]: value } : q));
  };

  const updateAnswer = (qIdx, aIdx, field, value) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const answers = q.answers.map((a, j) => {
        if (field === 'is_correct') return { ...a, is_correct: j === aIdx };
        return j === aIdx ? { ...a, [field]: value } : a;
      });
      return { ...q, answers };
    }));
  };

  const addAnswer = (qIdx) => {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, answers: [...q.answers, makeAnswer()] } : q));
  };

  const removeAnswer = (qIdx, aIdx) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx || q.answers.length <= 2) return q;
      const answers = q.answers.filter((_, j) => j !== aIdx);
      // if removed answer was correct, set first as correct
      if (!answers.some(a => a.is_correct)) answers[0].is_correct = true;
      return { ...q, answers };
    }));
  };

  const addQuestion = () => setQuestions(prev => [...prev, makeQuestion()]);
  const removeQuestion = (qIdx) => {
    if (questions.length <= 1) return;
    setQuestions(prev => prev.filter((_, i) => i !== qIdx));
  };

  const moveQuestion = (qIdx, dir) => {
    const newIdx = qIdx + dir;
    if (newIdx < 0 || newIdx >= questions.length) return;
    setQuestions(prev => {
      const arr = [...prev];
      [arr[qIdx], arr[newIdx]] = [arr[newIdx], arr[qIdx]];
      return arr;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate
    if (!form.title.trim()) return setError('Введите название квиза');
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text.trim()) return setError(`Заполните текст вопроса ${i + 1}`);
      if (questions[i].answers.some(a => !a.text.trim())) return setError(`Заполните все варианты ответа в вопросе ${i + 1}`);
      if (!questions[i].answers.some(a => a.is_correct)) return setError(`Отметьте правильный ответ в вопросе ${i + 1}`);
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title.trim());
      formData.append('description', form.description.trim());
      formData.append('quiz_type', form.quiz_type);
      formData.append('difficulty', form.difficulty);
      if (form.time_limit) formData.append('time_limit', Number(form.time_limit) * 60);
      if (form.category_id) formData.append('category_id', form.category_id);
      if (coverFile) formData.append('cover', coverFile);

      const qs = questions.map((q, i) => ({
        text: q.text.trim(),
        explanation: q.explanation.trim() || null,
        time_limit: q.time_limit ? Number(q.time_limit) : null,
        question_type: 'single',
        points: 1,
        order_num: i,
        answers: q.answers.map(a => ({ text: a.text.trim(), is_correct: a.is_correct })),
      }));
      formData.append('questions', JSON.stringify(qs));

      if (isEdit) {
        const endpoint = isAdmin ? `/admin/quizzes/${id}` : `/creator/quizzes/${id}`;
        await api.put(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSuccess('Квиз обновлён!');
      } else {
        const endpoint = isAdmin ? '/admin/quizzes' : '/quizzes';
        await api.post(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSuccess('Квиз создан и опубликован!');
        setForm({ title: '', description: '', quiz_type: 'classic', difficulty: 'medium', time_limit: '', category_id: '' });
        setQuestions([makeQuestion()]);
        removeCover();
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  const backLink = isAdmin ? '/admin' : '/creator/quizzes';
  const backLabel = isAdmin ? '← Админ-панель' : '← Мои квизы';

  return (
    <div className="cqf-page">
      <div className="cqf-container">

        {/* Header */}
        <div className="cqf-header">
          <Link to={backLink} className="cqf-back">{backLabel}</Link>
          <div>
            <h1 className="cqf-title">{isEdit ? 'Редактировать квиз' : 'Создать квиз'}</h1>
            <p className="cqf-subtitle">Заполни информацию и добавь вопросы</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="cqf-form">

          {/* ── SECTION 1: Cover + Basic Info ── */}
          <div className="cqf-card">
            <div className="cqf-card-title">📋 Основная информация</div>

            <div className="cqf-cover-row">
              {/* Cover upload */}
              <div className="cqf-cover-wrap">
                <div
                  className={`cqf-cover-drop ${coverPreview ? 'has-image' : ''}`}
                  onClick={() => coverInputRef.current?.click()}
                >
                  {coverPreview
                    ? <img src={coverPreview} alt="Обложка" className="cqf-cover-img" />
                    : <div className="cqf-cover-placeholder">
                        <span className="cqf-cover-icon">🖼️</span>
                        <span className="cqf-cover-hint">Нажми чтобы загрузить обложку</span>
                        <span className="cqf-cover-hint2">JPG, PNG, WebP · до 5MB</span>
                      </div>
                  }
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverChange}
                    style={{ display: 'none' }}
                  />
                </div>
                {coverPreview && (
                  <button type="button" className="cqf-cover-remove" onClick={removeCover}>✕ Удалить обложку</button>
                )}
              </div>

              {/* Basic fields */}
              <div className="cqf-basic-fields">
                <div className="cqf-field">
                  <label className="cqf-label">Название квиза *</label>
                  <input
                    className="cqf-input"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Например, Великие открытия в науке"
                    required
                  />
                </div>

                <div className="cqf-field">
                  <label className="cqf-label">Описание</label>
                  <textarea
                    className="cqf-input cqf-textarea"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Краткое описание квиза..."
                    rows={3}
                  />
                </div>

                <div className="cqf-row-3">
                  <div className="cqf-field">
                    <label className="cqf-label">Категория</label>
                    <select className="cqf-input" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                      <option value="">Без категории</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                  <div className="cqf-field">
                    <label className="cqf-label">Тип квиза</label>
                    <select className="cqf-input" value={form.quiz_type} onChange={e => setForm(f => ({ ...f, quiz_type: e.target.value }))}>
                      {QUIZ_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="cqf-field">
                    <label className="cqf-label">Общее время (мин)</label>
                    <input
                      className="cqf-input"
                      type="number"
                      min="1"
                      max="180"
                      value={form.time_limit}
                      onChange={e => setForm(f => ({ ...f, time_limit: e.target.value }))}
                      placeholder="Без лимита"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Difficulty selector */}
            <div className="cqf-field" style={{ marginTop: 16 }}>
              <label className="cqf-label">Сложность</label>
              <div className="cqf-difficulty-row">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    className={`cqf-diff-btn ${form.difficulty === d.value ? 'active' : ''}`}
                    style={{ '--diff-color': d.color }}
                    onClick={() => setForm(f => ({ ...f, difficulty: d.value }))}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── SECTION 2: Questions ── */}
          <div className="cqf-questions-header">
            <div>
              <h2 className="cqf-section-title">❓ Вопросы</h2>
              <p className="cqf-section-sub">{questions.length} вопр. · Отметь правильный ответ радиокнопкой</p>
            </div>
            <button type="button" className="cqf-add-q-btn" onClick={addQuestion}>+ Добавить вопрос</button>
          </div>

          {questions.map((q, qIdx) => (
            <div key={qIdx} className="cqf-card cqf-q-card">
              <div className="cqf-q-header">
                <div className="cqf-q-num">#{qIdx + 1}</div>
                <div className="cqf-q-actions">
                  <button type="button" className="cqf-icon-btn" onClick={() => moveQuestion(qIdx, -1)} disabled={qIdx === 0} title="Выше">↑</button>
                  <button type="button" className="cqf-icon-btn" onClick={() => moveQuestion(qIdx, 1)} disabled={qIdx === questions.length - 1} title="Ниже">↓</button>
                  <button type="button" className="cqf-icon-btn cqf-icon-del" onClick={() => removeQuestion(qIdx)} disabled={questions.length <= 1} title="Удалить">✕</button>
                </div>
              </div>

              <div className="cqf-field">
                <label className="cqf-label">Текст вопроса *</label>
                <input
                  className="cqf-input"
                  value={q.text}
                  onChange={e => updateQuestion(qIdx, 'text', e.target.value)}
                  placeholder={`Вопрос ${qIdx + 1}...`}
                  required
                />
              </div>

              <div className="cqf-q-meta">
                <div className="cqf-field">
                  <label className="cqf-label">⏱ Время на вопрос (сек)</label>
                  <input
                    className="cqf-input"
                    type="number"
                    min="5"
                    max="300"
                    value={q.time_limit}
                    onChange={e => updateQuestion(qIdx, 'time_limit', e.target.value)}
                    placeholder="Без лимита"
                  />
                </div>
                <div className="cqf-field" style={{ flex: 2 }}>
                  <label className="cqf-label">💡 Объяснение (показывается после ответа)</label>
                  <input
                    className="cqf-input"
                    value={q.explanation}
                    onChange={e => updateQuestion(qIdx, 'explanation', e.target.value)}
                    placeholder="Необязательно..."
                  />
                </div>
              </div>

              {/* Answers */}
              <div className="cqf-answers-label">
                <span className="cqf-label">Варианты ответов</span>
                <span className="cqf-hint">🔘 — правильный ответ</span>
              </div>
              <div className="cqf-answers-list">
                {q.answers.map((a, aIdx) => (
                  <div key={aIdx} className={`cqf-answer-row ${a.is_correct ? 'is-correct' : ''}`}>
                    <input
                      type="radio"
                      name={`correct_${qIdx}`}
                      checked={a.is_correct}
                      onChange={() => updateAnswer(qIdx, aIdx, 'is_correct', true)}
                      className="cqf-radio"
                      title="Правильный ответ"
                    />
                    <input
                      className="cqf-input cqf-answer-input"
                      value={a.text}
                      onChange={e => updateAnswer(qIdx, aIdx, 'text', e.target.value)}
                      placeholder={`Вариант ${aIdx + 1}`}
                      required
                    />
                    {q.answers.length > 2 && (
                      <button type="button" className="cqf-icon-btn cqf-icon-del" onClick={() => removeAnswer(qIdx, aIdx)} title="Удалить вариант">✕</button>
                    )}
                  </div>
                ))}
              </div>
              {q.answers.length < 6 && (
                <button type="button" className="cqf-add-answer-btn" onClick={() => addAnswer(qIdx)}>+ Добавить вариант</button>
              )}
            </div>
          ))}

          <button type="button" className="cqf-add-q-btn cqf-add-q-btn--large" onClick={addQuestion}>
            + Добавить вопрос
          </button>

          {/* Errors / Success */}
          {error && <div className="cqf-error">⚠️ {error}</div>}
          {success && <div className="cqf-success">✅ {success}</div>}

          {/* Submit */}
          <div className="cqf-submit-row">
            <Link to={backLink} className="cqf-cancel-btn">Отмена</Link>
            <button type="submit" className="cqf-submit-btn" disabled={loading}>
              {loading ? 'Сохраняем…' : isEdit ? '💾 Сохранить изменения' : '🚀 Создать квиз'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
