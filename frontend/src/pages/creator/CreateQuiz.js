import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

export default function CreateQuiz() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    quiz_type: 'classic',
    time_limit: 300,
    questions: [
      { text: '', options: ['', '', '', ''], correct: 0 }
    ]
  });
  const [loading, setLoading] = useState(false);

  const addQuestion = () => {
    setForm({
      ...form,
      questions: [...form.questions, { text: '', options: ['', '', '', ''], correct: 0 }]
    });
  };

  const updateQuestion = (idx, field, value) => {
    const newQuestions = [...form.questions];
    newQuestions[idx][field] = value;
    setForm({ ...form, questions: newQuestions });
  };

  const updateOption = (qIdx, oIdx, value) => {
    const newQuestions = [...form.questions];
    newQuestions[qIdx].options[oIdx] = value;
    setForm({ ...form, questions: newQuestions });
  };

  const submitQuiz = async () => {
    if (!form.title) return alert('Введите название');
    setLoading(true);
    try {
      const res = await api.post('/quizzes', form);
      navigate('/creator/quizzes');
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      <h1>Создание квиза</h1>

      <div style={fieldStyle}>
        <label>Название *</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          style={inputStyle}
        />
      </div>

      <div style={fieldStyle}>
        <label>Описание</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={inputStyle}
        />
      </div>

      <div style={fieldStyle}>
        <label>Тип квиза</label>
        <select
          value={form.quiz_type}
          onChange={(e) => setForm({ ...form, quiz_type: e.target.value })}
          style={inputStyle}
        >
          <option value="classic">Классический</option>
          <option value="timed">На время</option>
          <option value="picture">С картинками</option>
        </select>
      </div>

      <div style={fieldStyle}>
        <label>Время на прохождение (секунд)</label>
        <input
          type="number"
          value={form.time_limit}
          onChange={(e) => setForm({ ...form, time_limit: +e.target.value })}
          style={inputStyle}
        />
      </div>

      <hr />

      <h3>Вопросы:</h3>
      {form.questions.map((q, qIdx) => (
        <div key={qIdx} style={cardStyle}>
          <input
            placeholder="Текст вопроса"
            value={q.text}
            onChange={(e) => updateQuestion(qIdx, 'text', e.target.value)}
            style={inputStyle}
          />
          <div style={{ marginTop: 12 }}>
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input
                  type="radio"
                  name={`correct_${qIdx}`}
                  checked={q.correct === oIdx}
                  onChange={() => updateQuestion(qIdx, 'correct', oIdx)}
                />
                <input
                  placeholder={`Вариант ${oIdx + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button onClick={addQuestion} style={{ ...buttonStyle, background: '#2196f3', marginRight: 12 }}>
        + Добавить вопрос
      </button>

      <button onClick={submitQuiz} disabled={loading} style={buttonStyle}>
        {loading ? 'Создаём...' : '📤 Сохранить квиз'}
      </button>
    </div>
  );
}

const fieldStyle = { marginBottom: 20 };
const inputStyle = { width: '100%', padding: 10, marginTop: 5, border: '1px solid #ccc', borderRadius: 6 };
const buttonStyle = { padding: '10px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', background: '#4caf50', color: 'white', fontWeight: 'bold' };
const cardStyle = { padding: 16, border: '1px solid #ddd', borderRadius: 8, marginBottom: 16, background: '#f9f9f9' };