import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Navbar from './components/common/Navbar';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import QuizPage from './pages/QuizPage';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/Auth';
import './assets/css/global.css';
import CreateQuiz from './pages/admin/CreateQuiz';
import MyQuizzes from './pages/creator/MyQuizzes';
import CreateQuizCreator from './pages/creator/CreateQuiz';
import Stats from './pages/admin/Stats';


function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border-light)',
      padding: '28px 0',
      textAlign: 'center',
      color: 'var(--text-secondary)',
      fontSize: 14,
      marginTop: 'auto'
    }}>
      <span>⚡ <strong style={{color:'var(--text-accent)'}}>Квизория</strong> — платформа интерактивных квизов © 2024</span>
    </footer>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navbar />
          <div style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/quizzes" element={<Catalog />} />
              <Route path="/quiz/:uuid" element={<QuizPage />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/admin/quiz/create" element={<CreateQuiz />} />
              <Route path="/admin/quiz/edit/:id" element={<CreateQuiz />} />
              <Route path="/creator/quizzes" element={<MyQuizzes />} />
<Route path="/creator/quizzes/new" element={<CreateQuiz />} />
<Route path="/creator/quizzes/:id/edit" element={<CreateQuiz />} />
<Route path="/admin/stats" element={<Stats />} />
              <Route path="*" element={
                <div style={{ textAlign: 'center', padding: '100px 20px' }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
                  <h1 style={{ color: 'var(--text-white)', marginBottom: 8 }}>404 — Страница не найдена</h1>
                  <a href="/" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: 16 }}>На главную</a>
                </div>
              } />
            </Routes>
          </div>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
