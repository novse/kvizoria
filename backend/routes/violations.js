const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

// POST /api/quizzes/:uuid/violation - логирование нарушений во время теста
router.post('/quizzes/:uuid/violation', auth, async (req, res) => {
    try {
        const { uuid } = req.params;
        const { type, timestamp } = req.body;
        
        const [[quiz]] = await pool.query('SELECT id FROM quizzes WHERE uuid = ?', [uuid]);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        
        await pool.query(
            `INSERT INTO violations_log (user_id, quiz_id, violation_type, description, created_at)
             VALUES (?, ?, ?, ?, FROM_UNIXTIME(?/1000))`,
            [req.user.id, quiz.id, type, `Обнаружено нарушение: ${type}`, timestamp || Date.now()]
        );
        
        res.json({ success: true, message: 'Violation logged' });
    } catch (err) {
        console.error('Violation log error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
