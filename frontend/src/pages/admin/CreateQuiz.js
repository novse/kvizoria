import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useNavigate, useParams } from 'react-router-dom';

export default function CreateQuiz() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [form, setForm] = useState({
        title: '',
        description: '',
        quiz_type: 'classic',
        time_limit: 300,
        category_id: 1,
        questions: [{ text: '', options: ['', '', '', ''], correct: 0 }]
    });
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/categories').then(res => setCategories(res.data));
        if (isEdit) {
            api.get(`/admin/quizzes/${id}/edit`).then(res => {
                setForm(res.data);
            });
        }
    }, [id, isEdit]);

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

    const updateOption = (qIdx, optIdx, value) => {
        const newQuestions = [...form.questions];
        newQuestions[qIdx].options[optIdx] = value;
        setForm({ ...form, questions: newQuestions });
    };

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isEdit) {
                await api.put(`/admin/quizzes/${id}`, form);
            } else {
                await api.post('/admin/quizzes', form);
            }
            navigate('/admin');
        } catch (err) {
            alert('Ошибка: ' + err.response?.data?.error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 32 }}>
            <h1>{isEdit ? 'Редактировать квиз' : 'Создать квиз'}</h1>
            <form onSubmit={submit}>
                <div style={{ marginBottom: 20 }}>
                    <label>Название</label>
                    <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                           style={inputStyle} required />
                </div>
                <div style={{ marginBottom: 20 }}>
                    <label>Описание</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                              style={inputStyle} rows={3} />
                </div>
                <div style={{ marginBottom: 20 }}>
                    <label>Тип квиза</label>
                    <select value={form.quiz_type} onChange={e => setForm({ ...form, quiz_type: e.target.value })} style={inputStyle}>
                        <option value="classic">Классический</option>
                        <option value="timed">На время</option>
                        <option value="picture">Картинки</option>
                    </select>
                </div>
                <div style={{ marginBottom: 20 }}>
                    <label>Категория</label>
                    <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} style={inputStyle}>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <h3>Вопросы</h3>
                {form.questions.map((q, qIdx) => (
                    <div key={qIdx} style={questionStyle}>
                        <input type="text" placeholder="Текст вопроса" value={q.text}
                               onChange={e => updateQuestion(qIdx, 'text', e.target.value)}
                               style={inputStyle} required />
                        <div style={{ marginTop: 10 }}>
                            {q.options.map((opt, optIdx) => (
                                <input key={optIdx} type="text" placeholder={`Вариант ${optIdx + 1}`}
                                       value={opt} onChange={e => updateOption(qIdx, optIdx, e.target.value)}
                                       style={{ ...inputStyle, marginBottom: 8 }} required />
                            ))}
                        </div>
                        <select value={q.correct} onChange={e => updateQuestion(qIdx, 'correct', parseInt(e.target.value))} style={inputStyle}>
                            {q.options.map((_, optIdx) => (
                                <option key={optIdx} value={optIdx}>Правильный ответ: вариант {optIdx + 1}</option>
                            ))}
                        </select>
                    </div>
                ))}
                
                <button type="button" onClick={addQuestion} style={buttonStyle}>+ Добавить вопрос</button>
                <button type="submit" disabled={loading} style={{ ...buttonStyle, marginLeft: 10, background: '#4CAF50' }}>
                    {loading ? 'Сохраняем...' : 'Сохранить квиз'}
                </button>
            </form>
        </div>
    );
}

const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(5, 8, 13, 0.92)',
    color: '#f4f7fb',
    outline: 'none',
    fontSize: 15,
    marginTop: 5
};

const buttonStyle = {
    padding: '12px 24px',
    border: '1px solid rgba(142, 231, 200, 0.28)',
    background: 'linear-gradient(135deg, rgba(142, 231, 200, 0.2), rgba(48, 242, 184, 0.08))',
    color: '#ecfff7',
    fontWeight: 800,
    cursor: 'pointer',
    marginTop: 10
};

const questionStyle = {
    border: '1px solid rgba(255,255,255,0.1)',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8
};