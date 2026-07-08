/**
 * Сервер для загрузки фото на Яндекс Диск
 * Запуск: node server.js
 */

const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();

// ==============================================
// НАСТРОЙКИ
// ==============================================
const YANDEX_TOKEN = 'y0__wgBEK7j9bkHGJOLRSDg8fyZGGkJNrFUsvxQDHgRPKRY8Qnepuhp'; // 👈 Сюда вставляем токен

// Путь на Яндекс Диске, куда будут сохраняться фото
const YANDEX_FOLDER = 'ЕЦАС_фото';

// ==============================================
// НАСТРОЙКА СЕРВЕРА
// ==============================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Настройка multer для приёма файлов
const upload = multer({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB на файл
});

// ==============================================
// ЭНДПОИНТ ДЛЯ ЗАГРУЗКИ ФОТО
// ==============================================
app.post('/upload-to-yandex', upload.array('photos', 10), async (req, res) => {
    try {
        const files = req.files;
        const address = req.body.address || '';
        
        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, error: 'Нет файлов' });
        }

        console.log(`📸 Получено ${files.length} фото для адреса: ${address}`);
        
        const uploadedUrls = [];

        for (const file of files) {
            try {
                // Формируем имя файла
                const timestamp = Date.now();
                const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
                const fileName = `${timestamp}_${safeName}`;
                const diskPath = `disk:/${YANDEX_FOLDER}/${fileName}`;

                console.log(`📤 Загрузка: ${fileName}`);

                // 1. Получаем ссылку для загрузки от Яндекса
                const uploadUrlResponse = await fetch(
                    `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(diskPath)}&overwrite=true`,
                    {
                        method: 'GET',
                        headers: { 'Authorization': `OAuth ${YANDEX_TOKEN}` }
                    }
                );

                if (!uploadUrlResponse.ok) {
                    const errorText = await uploadUrlResponse.text();
                    throw new Error(`Яндекс API (получение ссылки): ${errorText}`);
                }

                const { href } = await uploadUrlResponse.json();

                // 2. Загружаем файл по полученной ссылке
                const uploadResponse = await fetch(href, {
                    method: 'PUT',
                    body: file.buffer,
                    headers: { 'Content-Type': file.mimetype || 'image/jpeg' }
                });

                if (!uploadResponse.ok) {
                    throw new Error(`Яндекс API (загрузка): ${uploadResponse.status}`);
                }

                // 3. Получаем публичную ссылку на файл
                const publishResponse = await fetch(
                    `https://cloud-api.yandex.net/v1/disk/resources/publish?path=${encodeURIComponent(diskPath)}`,
                    {
                        method: 'PUT',
                        headers: { 'Authorization': `OAuth ${YANDEX_TOKEN}` }
                    }
                );

                if (!publishResponse.ok) {
                    const errorText = await publishResponse.text();
                    throw new Error(`Яндекс API (публикация): ${errorText}`);
                }

                const publicData = await publishResponse.json();
                uploadedUrls.push(publicData.public_url);

                console.log(`✅ Загружено: ${fileName}`);

            } catch (fileError) {
                console.error(`❌ Ошибка загрузки файла:`, fileError);
                // Продолжаем с остальными файлами
            }
        }

        console.log(`✅ Загружено ${uploadedUrls.length} из ${files.length} фото`);

        res.json({
            success: true,
            count: uploadedUrls.length,
            urls: uploadedUrls,
            address: address
        });

    } catch (error) {
        console.error('❌ Ошибка:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Неизвестная ошибка'
        });
    }
});

// ==============================================
// ЗАПУСК СЕРВЕРА
// ==============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📁 Папка на Яндекс Диске: ${YANDEX_FOLDER}`);
    console.log('📸 Эндпоинт: POST /upload-to-yandex');
});
