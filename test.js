const http = require('http');

function testUrlShortener() {
    const baseUrl = 'http://localhost:3000';
    
    // Тест создания короткой ссылки
    const testUrl = 'https://www.example.com/test-' + Date.now();
    const createUrl = `${baseUrl}/create?url=${encodeURIComponent(testUrl)}`;
    
    http.get(createUrl, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log('Создание ссылки:');
            console.log('Статус:', res.statusCode);
            console.log('Ответ:', data);
            
            if (res.statusCode === 200) {
                const response = JSON.parse(data);
                const shortUrl = response.short_url;
                console.log('\nКороткая ссылка создана:', shortUrl);
                
                // Тест переадресации
                console.log('\nТестирование переадресации...');
                http.get(shortUrl, (redirectRes) => {
                    console.log('Статус переадресации:', redirectRes.statusCode);
                    console.log('Перенаправление на:', redirectRes.headers.location);
                });
            }
        });
    }).on('error', (err) => {
        console.error('Ошибка теста:', err.message);
    });
}

// Запуск теста через 1 секунду после старта сервера
setTimeout(testUrlShortener, 1000);
