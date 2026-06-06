const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/authController');
const quizCtrl = require('../controllers/quizController');  // ← Убедитесь, что ЭТА строка есть!
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
router.post('/auth/forgot-password', authCtrl.forgotPassword);
router.post('/auth/reset-password', authCtrl.resetPassword);

// ─── QUIZZES ──────────────────────────────────────────────────
router.get('/quizzes', quizCtrl.getQuizzes);
router.get('/quizzes/:uuid', quizCtrl.getQuiz);
router.post('/quizzes', auth, upload.single('cover'), quizCtrl.createQuiz);
router.post('/quizzes/:uuid/publish', auth, quizCtrl.publishQuiz);
router.post('/quizzes/:uuid/attempt', auth, quizCtrl.submitAttempt);
router.get('/quizzes/:uuid/leaderboard', quizCtrl.getLeaderboard);

// ─── NEW: CHECK ATTEMPTS LIMIT ────────────────────────────────
router.get('/quizzes/:uuid/check-attempts', auth, quizCtrl.checkAttemptsLimit);

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

router.get('/admin/export-results', exportController.exportResultsToExcel);
router.post('/admin/quizzes', auth, adminOnly, adminCtrl.createQuizAdmin);
router.get('/admin/quizzes/:id/edit', auth, adminOnly, adminCtrl.getQuizForEdit);
router.put('/admin/quizzes/:id', auth, adminOnly, adminCtrl.updateQuiz);
router.get('/admin/stats', auth, adminOnly, statsController.getAdminStats);

// ─── CREATOR (преподаватель) ─────────────────────────────────
router.get('/creator/quizzes', auth, creatorCtrl.getMyQuizzes);
router.post('/creator/quizzes', auth, upload.single('cover'), creatorCtrl.createQuiz);
router.get('/creator/quizzes/:id', auth, creatorCtrl.getQuizForEdit);
router.put('/creator/quizzes/:id', auth, creatorCtrl.updateQuiz);
router.delete('/creator/quizzes/:id', auth, creatorCtrl.deleteQuiz);

// ─── VIOLATIONS LOGGING ───────────────────────────────────────
//router.use('/api', require('./violations'));

module.exports = router;
