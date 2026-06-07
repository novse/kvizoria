const { pool } = require('../config/database');
const ExcelJS = require('exceljs');

exports.exportResultsToExcel = async (req, res) => {
    try {
        const [results] = await pool.query(`
            SELECT 
                u.username AS name,
                u.email,
                q.title AS quiz_title,
                qa.score,
                qa.max_score,
                qa.percent_score,
                CASE WHEN qa.is_passed = 1 THEN 'Да' ELSE 'Нет' END AS passed,
                qa.completed_at
            FROM quiz_attempts qa
            JOIN users u ON qa.user_id = u.id
            JOIN quizzes q ON qa.quiz_id = q.id
            ORDER BY qa.completed_at DESC
        `);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Результаты');

        worksheet.columns = [
            { header: 'Пользователь', key: 'name',          width: 22 },
            { header: 'Email',        key: 'email',         width: 30 },
            { header: 'Квиз',         key: 'quiz_title',    width: 35 },
            { header: 'Баллы',        key: 'score',         width: 10 },
            { header: 'Макс. баллы',  key: 'max_score',     width: 12 },
            { header: '% результат',  key: 'percent_score', width: 14 },
            { header: 'Сдано',        key: 'passed',        width: 10 },
            { header: 'Дата',         key: 'completed_at',  width: 22 },
        ];

        // Стиль заголовка
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern', pattern: 'solid',
            fgColor: { argb: 'FF7C3AED' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        results.forEach(r => {
            worksheet.addRow({
                ...r,
                percent_score: Number(r.percent_score).toFixed(1) + '%',
                completed_at: r.completed_at ? new Date(r.completed_at).toLocaleString('ru') : '',
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=kvizoria-results.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};
