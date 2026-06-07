const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const authCtrl = require('../controllers/authController');
const quizCtrl = require('../controllers/quizController');
const adminCtrl = require('../controllers/adminController');
const { auth, adminOnly, creatorOrAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const exportController = require('../controllers/exportController');
const creatorCtrl = require('../controllers/creatorController');
const statsController = require('../controllers/statsController');

// ─── AUTH ─────────────────────────────────────────────────────
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', auth, authCtrl.me);
router.put('/auth/profile', auth, upload.single('avatar'), authCtrl.updateProfile);
router.put('/auth/change-password', auth, authCtrl.changePassword);
router.post('/auth/forgot-password', authCtrl.forgotPassword);
router.post('/auth/reset-password', authCtrl.resetPassword);

// ─── QUIZZES ──────────────────────────────────────────────────
router.get('/quizzes', quizCtrl.getQuizzes);
router.get('/quizzes/:uuid', quizCtrl.getQuiz);
router.post('/quizzes', auth, upload.single('cover'), quizCtrl.createQuiz);
router.post('/quizzes/:uuid/publish', auth, quizCtrl.publishQuiz);
router.post('/quizzes/:uuid/attempt', auth, quizCtrl.submitAttempt);
router.get('/quizzes/:uuid/leaderboard', quizCtrl.getLeaderboard);
router.get('/quizzes/:uuid/check-attempts', auth, quizCtrl.checkAttemptsLimit);

// ─── VIOLATIONS LOGGING ───────────────────────────────────────
router.post('/quizzes/:uuid/violation', auth, async (req, res) => {
    try {
        const { uuid } = req.params;
        const { type, timestamp } = req.body;
        const [[quiz]] = await pool.query('SELECT id FROM quizzes WHERE uuid = ?', [uuid]);
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
        const ALLOWED_TYPES = ['tab_switch', 'copy_attempt', 'right_click', 'ctrl_v', 'ctrl_u', 'ctrl_s', 'devtools_open'];
        const safeType = ALLOWED_TYPES.includes(type) ? type : String(type).slice(0, 50);
        await pool.query(
            `INSERT INTO violations_log (user_id, quiz_id, violation_type, description, created_at)
             VALUES (?, ?, ?, ?, FROM_UNIXTIME(?/1000))`,
            [req.user.id, quiz.id, safeType, `Обнаружено нарушение: ${safeType}`, timestamp || Date.now()]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Violation log error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── CATEGORIES ───────────────────────────────────────────────
router.get('/categories', quizCtrl.getCategories);

// ─── USER ─────────────────────────────────────────────────────
router.get('/user/history', auth, quizCtrl.getUserHistory);

// ─── ADMIN ───────────────────────────────────────────────────
router.get('/admin/dashboard', auth, adminOnly, adminCtrl.getDashboard);
router.get('/admin/users', auth, adminOnly, adminCtrl.getUsers);
router.put('/admin/users/:id', auth, adminOnly, adminCtrl.updateUser);
router.get('/admin/quizzes', auth, adminOnly, adminCtrl.getAllQuizzes);
router.put('/admin/quizzes/:id/toggle', auth, adminOnly, adminCtrl.togglePublish);
router.delete('/admin/quizzes/:id', auth, adminOnly, adminCtrl.deleteQuiz);
router.get('/admin/violations', auth, adminOnly, adminCtrl.getViolations);
router.get('/admin/categories', auth, adminOnly, adminCtrl.getCategories);
router.post('/admin/categories', auth, adminOnly, adminCtrl.createCategory);
router.delete('/admin/categories/:id', auth, adminOnly, adminCtrl.deleteCategory);
router.get('/admin/export-results', auth, adminOnly, exportController.exportResultsToExcel);
router.post('/admin/quizzes', auth, adminOnly, upload.single('cover'), adminCtrl.createQuizAdmin);
router.get('/admin/quizzes/:id/edit', auth, adminOnly, adminCtrl.getQuizForEdit);
router.put('/admin/quizzes/:id', auth, adminOnly, adminCtrl.updateQuiz);
router.get('/admin/stats', auth, adminOnly, statsController.getAdminStats);

// ─── CREATOR ─────────────────────────────────────────────────
router.get('/creator/quizzes', auth, creatorOrAdmin, creatorCtrl.getMyQuizzes);
router.post('/creator/quizzes', auth, creatorOrAdmin, upload.single('cover'), creatorCtrl.createQuiz);
router.put('/creator/quizzes/:id/toggle-publish', auth, creatorOrAdmin, creatorCtrl.togglePublish);
router.get('/creator/quizzes/:id', auth, creatorOrAdmin, creatorCtrl.getQuizForEdit);
router.put('/creator/quizzes/:id', auth, creatorOrAdmin, creatorCtrl.updateQuiz);
router.delete('/creator/quizzes/:id', auth, creatorOrAdmin, creatorCtrl.deleteQuiz);
router.get('/creator/results', auth, creatorOrAdmin, creatorCtrl.getQuizResults);
router.get('/creator/violations', auth, creatorOrAdmin, creatorCtrl.getQuizViolations);
router.get('/creator/export-results', auth, creatorOrAdmin, creatorCtrl.exportResultsToExcel);

module.exports = router;
