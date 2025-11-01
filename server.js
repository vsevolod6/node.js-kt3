const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализация базы данных
const db = new sqlite3.Database('./urls.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
    } else {
        console.log('Подключение к SQLite установлено');
        initDatabase();
    }
});

// Создание таблицы
function initDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS urls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_url TEXT NOT NULL UNIQUE,
            short_code TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы:', err.message);
        }
    });
}

// Генерация короткого кода
function generateShortCode() {
    return crypto.randomBytes(4).toString('hex'); // 8 символов
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Маршрут для создания короткой ссылки
app.get('/create', (req, res) => {
    const originalUrl = req.query.url;
    
    if (!originalUrl) {
        return res.status(400).json({ error: 'Параметр url обязателен' });
    }

    // Проверка валидности URL
    try {
        new URL(originalUrl);
    } catch (err) {
        return res.status(400).json({ error: 'Некорректный URL' });
    }

    // Проверяем, есть ли уже такой URL в базе
    db.get('SELECT short_code FROM urls WHERE original_url = ?', [originalUrl], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }

        if (row) {
            // URL уже существует, возвращаем существующий код
            const shortUrl = `${req.protocol}://${req.get('host')}/${row.short_code}`;
            return res.json({ short_url: shortUrl });
        }

        // Создаем новую запись
        const shortCode = generateShortCode();
        
        db.run('INSERT INTO urls (original_url, short_code) VALUES (?, ?)', 
               [originalUrl, shortCode], function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    // Если код уже существует (маловероятно), генерируем новый
                    const newShortCode = generateShortCode();
                    db.run('INSERT INTO urls (original_url, short_code) VALUES (?, ?)', 
                           [originalUrl, newShortCode], function(err) {
                        if (err) {
                            return res.status(500).json({ error: 'Ошибка при создании ссылки' });
                        }
                        const shortUrl = `${req.protocol}://${req.get('host')}/${newShortCode}`;
                        res.json({ short_url: shortUrl });
                    });
                } else {
                    res.status(500).json({ error: 'Ошибка при создании ссылки' });
                }
            } else {
                const shortUrl = `${req.protocol}://${req.get('host')}/${shortCode}`;
                res.json({ short_url: shortUrl });
            }
        });
    });
});

// Маршрут для переадресации
app.get('/:shortCode', (req, res) => {
    const shortCode = req.params.shortCode;
    
    // Исключаем маршрут /create из обработки коротких кодов
    if (shortCode === 'create') {
        return res.redirect('/');
    }

    db.get('SELECT original_url FROM urls WHERE short_code = ?', [shortCode], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }

        if (row) {
            // Выполняем переадресацию
            res.redirect(301, row.original_url);
        } else {
            res.status(404).json({ error: 'Ссылка не найдена' });
        }
    });
});

// Корневой маршрут
app.get('/', (req, res) => {
    res.send(`
        <h1>Сервис сокращения URL</h1>
        <p>Для создания короткой ссылки используйте:</p>
        <code>GET /create?url=ВАШ_URL</code>
        <p>Пример: <a href="/create?url=https://google.com">/create?url=https://google.com</a></p>
    `);
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Доступен по адресу: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Подключение к БД закрыто');
        process.exit(0);
    });
});
