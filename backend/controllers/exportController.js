const { pool } = require('../config/database');
const ExcelJS = require('exceljs');

exports.exportResultsToExcel = async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT u.name, u.email, q.title, qr.score, qr.completed_at
            FROM quiz_results qr
            JOIN users u ON qr.user_id = u.id
            JOIN quizzes q ON qr.quiz_id = q.id
            ORDER BY qr.completed_at DESC
        `);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Результаты');

        worksheet.columns = [
            { header: 'Имя', key: 'name', width: 20 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Квиз', key: 'title', width: 30 },
            { header: 'Баллы', key: 'score', width: 10 },
            { header: 'Дата', key: 'completed_at', width: 20 }
        ];

        worksheet.addRows(results);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=results.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};
