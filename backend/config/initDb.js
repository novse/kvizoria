const pool = require('./db');
const bcrypt = require('bcryptjs');

async function initDatabase() {
    const conn = await pool.getConnection();
    try {
        console.log('🗄️  Проверяем базу данных...');

        const [[connectionInfo]] = await conn.query(`
      SELECT DATABASE() AS database_name, @@hostname AS host, @@port AS port
    `);

        console.log(
            `🔌 Подключение: ${connectionInfo.database_name}@${connectionInfo.host}:${connectionInfo.port}`
        );

        // ─── SCHEMA ───────────────────────────────────────────────
        await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) UNIQUE NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('user','creator','admin') DEFAULT 'user',
        avatar VARCHAR(255) DEFAULT NULL,
        bio TEXT DEFAULT NULL,
        reset_token VARCHAR(255) DEFAULT NULL,
        reset_expires DATETIME DEFAULT NULL,
        is_blocked TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

        await conn.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        icon VARCHAR(50) DEFAULT '🎯',
        color VARCHAR(20) DEFAULT '#7C3AED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

        await conn.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) UNIQUE NOT NULL,
        slug VARCHAR(255) UNIQUE DEFAULT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        cover_image VARCHAR(255) DEFAULT NULL,
        category_id INT DEFAULT NULL,
        author_id INT NOT NULL,
        quiz_type ENUM('classic','timed','picture','open','learning','team') DEFAULT 'classic',
        difficulty ENUM('easy','medium','hard') DEFAULT 'medium',
        time_limit INT DEFAULT NULL COMMENT 'секунды, NULL = без ограничений',
        max_attempts INT DEFAULT 3,
        is_public TINYINT(1) DEFAULT 1,
        is_published TINYINT(1) DEFAULT 0,
        shuffle_questions TINYINT(1) DEFAULT 1,
        shuffle_answers TINYINT(1) DEFAULT 1,
        pass_score INT DEFAULT 60 COMMENT 'минимальный % для сдачи',
        plays_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

        const [[slugColumn]] = await conn.query(`
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'quizzes'
        AND column_name = 'slug'
    `);

        if (slugColumn.count === 0) {
            await conn.query(`ALTER TABLE quizzes ADD COLUMN slug VARCHAR(255) UNIQUE DEFAULT NULL`);
        }

        await conn.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quiz_id INT NOT NULL,
        text VARCHAR(1000) NOT NULL,
        image VARCHAR(255) DEFAULT NULL,
        question_type ENUM('single','multiple','text') DEFAULT 'single',
        explanation TEXT DEFAULT NULL,
        points INT DEFAULT 1,
        time_limit INT DEFAULT NULL,
        order_num INT DEFAULT 0,
        UNIQUE KEY unique_quiz_question (quiz_id, text(191)),
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

        await conn.query(`
      CREATE TABLE IF NOT EXISTS answers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        question_id INT NOT NULL,
        text VARCHAR(500) NOT NULL,
        is_correct TINYINT(1) DEFAULT 0,
        order_num INT DEFAULT 0,
        UNIQUE KEY unique_question_answer (question_id, text(191)),
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

        await conn.query(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) UNIQUE NOT NULL,
        quiz_id INT NOT NULL,
        user_id INT NOT NULL,
        score INT DEFAULT 0,
        max_score INT DEFAULT 0,
        percent_score DECIMAL(5,2) DEFAULT 0,
        time_spent INT DEFAULT 0 COMMENT 'секунды',
        is_passed TINYINT(1) DEFAULT 0,
        violations_count INT DEFAULT 0,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

        await conn.query(`
      CREATE TABLE IF NOT EXISTS attempt_answers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attempt_id INT NOT NULL,
        question_id INT NOT NULL,
        answer_id INT DEFAULT NULL,
        text_answer VARCHAR(500) DEFAULT NULL,
        is_correct TINYINT(1) DEFAULT 0,
        FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

        await conn.query(`
      CREATE TABLE IF NOT EXISTS violations_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attempt_id INT DEFAULT NULL,
        user_id INT NOT NULL,
        quiz_id INT NOT NULL,
        violation_type ENUM('tab_switch','copy_text','right_click','hotkey','time_exceeded') NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

        await conn.query(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quiz_id INT NOT NULL,
        user_id INT NOT NULL,
        best_score INT DEFAULT 0,
        best_percent DECIMAL(5,2) DEFAULT 0,
        best_time INT DEFAULT 0,
        attempts_count INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_quiz_user (quiz_id, user_id),
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

        await conn.query(`
      CREATE TABLE IF NOT EXISTS db_initialized (
        id INT PRIMARY KEY DEFAULT 1,
        initialized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        console.log('🌱 Заполняем базу данных тестовыми данными...');

        // ─── CATEGORIES ───────────────────────────────────────────
        await conn.query(`
      INSERT IGNORE INTO categories (name, slug, icon, color) VALUES
      ('Наука и природа', 'science', '🔬', '#7C3AED'),
      ('История', 'history', '📜', '#DC2626'),
      ('Поп-культура', 'popculture', '🎬', '#DB2777'),
      ('Информационные технологии', 'it', '💻', '#2563EB'),
      ('Спорт', 'sport', '⚽', '#16A34A'),
      ('География', 'geography', '🌍', '#0891B2'),
      ('Кино и музыка', 'cinema', '🎵', '#D97706'),
      ('Литература', 'literature', '📚', '#7C3AED')
    `);

        // ─── USERS ────────────────────────────────────────────────
        const adminHash = await bcrypt.hash('Admin2024!', 10);
        const creatorHash = await bcrypt.hash('Creator2024!', 10);
        const userHash = await bcrypt.hash('User2024!', 10);

        await conn.query(`
      INSERT IGNORE INTO users (uuid, username, email, password_hash, role, bio) VALUES
      (UUID(), 'admin', 'admin@kvizoria.ru', ?, 'admin', 'Главный администратор платформы Квизория'),
      (UUID(), 'elena_creator', 'elena@kvizoria.ru', ?, 'creator', 'Создаю образовательные квизы по истории и науке'),
      (UUID(), 'test_user', 'user@kvizoria.ru', ?, 'user', 'Люблю проходить квизы по вечерам')
    `, [adminHash, creatorHash, userHash]);

        const [[adminRow]] = await conn.query(`SELECT id FROM users WHERE username = 'admin'`);
        const [[creatorRow]] = await conn.query(`SELECT id FROM users WHERE username = 'elena_creator'`);
        const [[userRow]] = await conn.query(`SELECT id FROM users WHERE username = 'test_user'`);
        const adminId = adminRow.id;
        const creatorId = creatorRow.id;
        const userId = userRow.id;

        // ─── QUIZZES ──────────────────────────────────────────────
        const quizData = [
            {
                slug: 'great-science-breakthroughs',
                title: 'Великие открытия в науке',
                desc: 'Проверь свои знания о самых важных научных открытиях человечества — от теории относительности до ДНК.',
                cover: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=600&q=80',
                cat: 1, author: creatorId, type: 'classic', diff: 'medium', time: 600, attempts: 3
            },
            {
                slug: 'russian-history-from-rurik',
                title: 'История России: от Рюрика до наших дней',
                desc: 'Углублённый квиз по ключевым событиям российской истории. Для тех, кто знает историю не по учебникам.',
                cover: 'https://images.unsplash.com/photo-1547448415-e9f5b28e570d?w=600&q=80',
                cat: 2, author: creatorId, type: 'timed', diff: 'hard', time: 900, attempts: 2
            },
            {
                slug: 'marvel-vs-dc',
                title: 'Marvel против DC: кто знает комиксы лучше?',
                desc: 'Знаешь, кто такой Thanos и почему Batman не супергерой? Докажи это здесь!',
                cover: 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=600&q=80',
                cat: 3, author: adminId, type: 'picture', diff: 'easy', time: 300, attempts: 5
            },
            {
                slug: 'programming-basics',
                title: 'Основы программирования',
                desc: 'Переменные, циклы, функции — база для каждого разработчика. Подходит для начинающих.',
                cover: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80',
                cat: 4, author: adminId, type: 'classic', diff: 'easy', time: 480, attempts: 10
            },
            {
                slug: 'world-cup',
                title: 'Чемпионат мира по футболу',
                desc: 'Все чемпионы, рекорды, легенды. Насколько хорошо ты знаешь историю главного турнира планеты?',
                cover: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=80',
                cat: 5, author: creatorId, type: 'classic', diff: 'medium', time: 420, attempts: 3
            },
            {
                slug: 'world-capitals',
                title: 'Столицы мира',
                desc: 'Знаешь ли ты столицы всех стран? От простых до самых неожиданных — проверь себя!',
                cover: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80',
                cat: 6, author: adminId, type: 'timed', diff: 'medium', time: 360, attempts: 5
            },
            {
                slug: 'rock-legends',
                title: 'Легенды рок-музыки',
                desc: 'Beatles, Queen, Led Zeppelin, Nirvana — знаешь ли ты всё о культовых группах?',
                cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80',
                cat: 7, author: creatorId, type: 'picture', diff: 'medium', time: 540, attempts: 3
            },
            {
                slug: 'russian-classic-literature',
                title: 'Русская классическая литература',
                desc: 'Пушкин, Толстой, Достоевский, Чехов — насколько хорошо ты помнишь школьную программу?',
                cover: 'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=600&q=80',
                cat: 8, author: creatorId, type: 'learning', diff: 'hard', time: 720, attempts: 2
            }
        ];

        for (const q of quizData) {
            await conn.query(`
        INSERT IGNORE INTO quizzes (slug, uuid, title, description, cover_image, category_id, author_id,
          quiz_type, difficulty, time_limit, max_attempts, is_public, is_published,
          shuffle_questions, shuffle_answers, plays_count)
        VALUES (?, UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 1, FLOOR(RAND()*500)+20)
      `, [q.slug, q.title, q.desc, q.cover, q.cat, q.author, q.type, q.diff, q.time, q.attempts]);
        }

        // ─── QUESTIONS & ANSWERS ──────────────────────────────────
        const [[q1]] = await conn.query(`SELECT id FROM quizzes WHERE title LIKE '%науке%' LIMIT 1`);
        const [[q2]] = await conn.query(`SELECT id FROM quizzes WHERE title LIKE '%России%' LIMIT 1`);
        const [[q3]] = await conn.query(`SELECT id FROM quizzes WHERE title LIKE '%Marvel%' LIMIT 1`);
        const [[q4]] = await conn.query(`SELECT id FROM quizzes WHERE title LIKE '%программирования%' LIMIT 1`);
        const [[q5]] = await conn.query(`SELECT id FROM quizzes WHERE title LIKE '%футбол%' LIMIT 1`);

        async function insertQA(quizId, text, image, explanation, answers) {
            const [res] = await conn.query(
                `INSERT IGNORE INTO questions (quiz_id, text, image, question_type, explanation, points, order_num)
         VALUES (?, ?, ?, 'single', ?, 1, 0)`,
                [quizId, text, image || null, explanation]
            );

            let qId = res.insertId;
            if (!qId) {
                const [[existingQuestion]] = await conn.query(
                    `SELECT id FROM questions WHERE quiz_id = ? AND text = ? LIMIT 1`,
                    [quizId, text]
                );
                qId = existingQuestion?.id || 0;
            }

            if (!qId) {
                throw new Error(`Не удалось получить id вопроса: ${text}`);
            }

            for (const [ans, correct] of answers) {
                await conn.query(
                    `INSERT IGNORE INTO answers (question_id, text, is_correct) VALUES (?, ?, ?)`,
                    [qId, ans, correct ? 1 : 0]
                );
            }
        }

        await insertQA(q1.id, 'Кто сформулировал специальную теорию относительности?', null,
            'Альберт Эйнштейн опубликовал специальную теорию относительности в 1905 году.',
            [['Альберт Эйнштейн', true], ['Исаак Ньютон', false], ['Никола Тесла', false], ['Макс Планк', false]]);

        await insertQA(q1.id, 'Что изучает эпигенетика?', null,
            'Эпигенетика изучает изменения экспрессии генов, не связанные с изменением последовательности ДНК.',
            [['Изменения генов без смены ДНК', true], ['Строение клеточных мембран', false], ['Мутации ДНК', false], ['Эволюцию видов', false]]);

        await insertQA(q1.id, 'В каком году была расшифрована структура ДНК?', null,
            'Уотсон и Крик описали двойную спираль ДНК в 1953 году.',
            [['1953', true], ['1944', false], ['1961', false], ['1972', false]]);

        await insertQA(q1.id, 'Какая планета имеет наибольшее количество лун?', null,
            'Сатурн имеет 146 известных лун — больше, чем любая другая планета Солнечной системы.',
            [['Сатурн', true], ['Юпитер', false], ['Уран', false], ['Нептун', false]]);

        await insertQA(q1.id, 'Как называется единица информации в квантовых вычислениях?', null,
            'Кубит (квантовый бит) — аналог классического бита в квантовых компьютерах.',
            [['Кубит', true], ['Квант', false], ['Фотон', false], ['Нейрон', false]]);

        await insertQA(q2.id, 'В каком году произошло Крещение Руси?', null,
            'Крещение Руси состоялось в 988 году при князе Владимире Святославиче.',
            [['988', true], ['862', false], ['1054', false], ['1240', false]]);

        await insertQA(q2.id, 'Кто возглавлял Советское государство в период Великой Отечественной войны?', null,
            'Иосиф Сталин был Верховным Главнокомандующим СССР во время Великой Отечественной войны.',
            [['Иосиф Сталин', true], ['Вячеслав Молотов', false], ['Климент Ворошилов', false], ['Георгий Жуков', false]]);

        await insertQA(q2.id, 'Когда завершилась Куликовская битва?', null,
            'Куликовская битва произошла 8 сентября 1380 года и завершилась победой русских войск под руководством Дмитрия Донского.',
            [['1380', true], ['1242', false], ['1410', false], ['1552', false]]);

        await insertQA(q2.id, 'Как называлась столица Руси до Москвы?', null,
            'Киев был столицей Киевской Руси и одним из крупнейших городов средневековой Европы.',
            [['Киев', true], ['Новгород', false], ['Суздаль', false], ['Смоленск', false]]);

        await insertQA(q3.id, 'Как настоящее имя Тони Старка?', null,
            'Тони Старк — Железный человек, гениальный изобретатель и миллиардер из вселенной Marvel.',
            [['Тони Старк', true], ['Стив Роджерс', false], ['Питер Паркер', false], ['Брюс Уэйн', false]]);

        await insertQA(q3.id, 'В каком году вышел первый фильм киновселенной Marvel (MCU)?', null,
            'Кинематографическая вселенная Marvel началась с фильма «Железный человек» в 2008 году.',
            [['2008', true], ['2010', false], ['2012', false], ['2005', false]]);

        await insertQA(q3.id, 'Кто такой Thanos по происхождению?', null,
            'Танос — представитель расы Вечных с планеты Титан, один из главных злодеев MCU.',
            [['Вечный с Титана', true], ['Скруллский генерал', false], ['Асгардец', false], ['Землянин-мутант', false]]);

        await insertQA(q4.id, 'Что такое переменная в программировании?', null,
            'Переменная — именованная область памяти для хранения данных, значение которой может меняться.',
            [['Именованная область памяти', true], ['Постоянное число', false], ['Тип данных', false], ['Имя функции', false]]);

        await insertQA(q4.id, 'Какой оператор используется для сравнения в большинстве языков?', null,
            'Оператор == используется для сравнения значений. В некоторых языках также используют === для строгого сравнения.',
            [['==', true], ['=', false], [':=', false], ['<>', false]]);

        await insertQA(q4.id, 'Что означает аббревиатура HTML?', null,
            'HTML расшифровывается как HyperText Markup Language — язык гипертекстовой разметки.',
            [['HyperText Markup Language', true], ['High Tech Modern Language', false], ['Hyper Transfer Markup Link', false], ['Home Tool Markup Language', false]]);

        await insertQA(q4.id, 'Что такое цикл в программировании?', null,
            'Цикл — конструкция, которая позволяет многократно выполнять один и тот же блок кода.',
            [['Повторяющийся блок кода', true], ['Одноразовая функция', false], ['Тип переменной', false], ['Условный оператор', false]]);

        await insertQA(q4.id, 'Что хранит массив?', null,
            'Массив — структура данных, хранящая упорядоченную коллекцию элементов одного типа.',
            [['Набор элементов под одним именем', true], ['Одно значение', false], ['Только числа', false], ['Функции', false]]);

        await insertQA(q5.id, 'Какая страна выиграла больше всего Чемпионатов мира по футболу?', null,
            'Бразилия выиграла Чемпионат мира 5 раз (1958, 1962, 1970, 1994, 2002) — больше всех в истории.',
            [['Бразилия (5 раз)', true], ['Германия (4 раза)', false], ['Италия (4 раза)', false], ['Аргентина (3 раза)', false]]);

        await insertQA(q5.id, 'Кто является рекордсменом по количеству голов на Чемпионатах мира?', null,
            'Мирослав Клозе забил 16 голов на чемпионатах мира (2002-2014), это абсолютный рекорд.',
            [['Мирослав Клозе (16 голов)', true], ['Роналду (15 голов)', false], ['Пеле (12 голов)', false], ['Герд Мюллер (14 голов)', false]]);

        await insertQA(q5.id, 'В какой стране прошёл Чемпионат мира 2018 года?', null,
            'Чемпионат мира 2018 года проходил в России, а победу одержала сборная Франции.',
            [['Россия', true], ['Бразилия', false], ['Германия', false], ['ЮАР', false]]);

        const [[attemptsCount]] = await conn.query('SELECT COUNT(*) AS count FROM quiz_attempts');
        if (attemptsCount.count === 0) {
            await conn.query(`
        INSERT INTO quiz_attempts (uuid, quiz_id, user_id, score, max_score, percent_score, time_spent, is_passed, violations_count)
        VALUES
        (UUID(), ?, ?, 4, 5, 80.00, 342, 1, 0),
        (UUID(), ?, ?, 3, 5, 60.00, 285, 1, 1),
        (UUID(), ?, ?, 5, 5, 100.00, 198, 1, 0)
      `, [q1.id, userId, q1.id, userId, q1.id, userId]);
        }

        await conn.query(`
      INSERT INTO leaderboard (quiz_id, user_id, best_score, best_percent, best_time, attempts_count)
      VALUES (?, ?, 5, 100.00, 198, 3)
      ON DUPLICATE KEY UPDATE best_score=VALUES(best_score), best_percent=VALUES(best_percent), attempts_count=VALUES(attempts_count)
    `, [q1.id, userId]);

        await conn.query(`
      INSERT INTO db_initialized (id) VALUES (1)
      ON DUPLICATE KEY UPDATE initialized_at = CURRENT_TIMESTAMP
    `);

        const [[categoriesCountAfter]] = await conn.query('SELECT COUNT(*) AS count FROM categories');
        const [[usersCountAfter]] = await conn.query('SELECT COUNT(*) AS count FROM users');
        const [[quizzesCountAfter]] = await conn.query('SELECT COUNT(*) AS count FROM quizzes');
        const [[questionsCountAfter]] = await conn.query('SELECT COUNT(*) AS count FROM questions');
        const [[answersCountAfter]] = await conn.query('SELECT COUNT(*) AS count FROM answers');

        console.log('✅ База данных успешно заполнена!');
        console.log(
            `📊 Counts: categories=${categoriesCountAfter.count}, users=${usersCountAfter.count}, quizzes=${quizzesCountAfter.count}, questions=${questionsCountAfter.count}, answers=${answersCountAfter.count}`
        );
        console.log('👤 Аккаунты:');
        console.log('   admin / Admin2024!');
        console.log('   elena_creator / Creator2024!');
        console.log('   test_user / User2024!');

        if (
            categoriesCountAfter.count === 0 ||
            usersCountAfter.count === 0 ||
            quizzesCountAfter.count === 0 ||
            questionsCountAfter.count === 0 ||
            answersCountAfter.count === 0
        ) {
            throw new Error('Seed completed but some tables are still empty');
        }

    } catch (err) {
        console.error('❌ Ошибка инициализации БД:', err.message);
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = initDatabase;