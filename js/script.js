/**
 * Основной скрипт для MAX приложения "Центр профилактики"
 * Версия: 1.0
 */

(function() {
    'use strict';

    const WebApp = window.WebApp;

    // ==============================================
    // НАСТРОЙКИ
    // ==============================================
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwGjcIY-s9Gm5yIjmUz9qIxe9K_AP7Xi9NnyMN-pSHuFe7a4TU0b9YG3y5Y6rmPUMi0Mw/exec';
    const POLICY_URL = 'https://disk.yandex.ru/d/KrLs5xKSHHgzmA';
    const MAX_FILES = 10;

    // ==============================================
    // DOM ЭЛЕМЕНТЫ
    // ==============================================
    const mainScreen = document.getElementById('mainScreen');
    const formScreen = document.getElementById('formScreen');
    const ecasOverlay = document.getElementById('ecasOverlay');
    const ecasResultOverlay = document.getElementById('ecasResultOverlay');
    const ecasSiteOverlay = document.getElementById('ecasSiteOverlay');
    const ecasBackBtn = document.getElementById('ecasBackBtn');
    const ecasResultBackBtn = document.getElementById('ecasResultBackBtn');
    const ecasSiteBackBtn = document.getElementById('ecasSiteBackBtn');
    const formContent = document.getElementById('formContent');
    const backToMainBtn = document.getElementById('backToMainBtn');

    // ==============================================
    // ПЕРЕМЕННЫЕ ДЛЯ ФАЙЛОВ
    // ==============================================
    let selectedFiles = [];
    const fileInput = document.getElementById('fileInput');
    const fileUploadArea = document.getElementById('fileUploadArea');
    const filePreviewGrid = document.getElementById('filePreviewGrid');
    const fileCount = document.getElementById('fileCount');

    // ==============================================
    // 📞 МАСКА ДЛЯ ТЕЛЕФОНА
    // ==============================================
    function phoneMask(input) {
        if (!input) return;
        input.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.substring(0, 11);
            if (value.length > 0) {
                if (value[0] === '8' || value[0] === '7') {
                    value = '7' + value.substring(1);
                } else {
                    value = '7' + value;
                }
            }
            let formattedValue = '';
            if (value.length > 0) {
                formattedValue = '+7';
                if (value.length > 1) {
                    formattedValue += ' (' + value.substring(1, 4);
                }
                if (value.length >= 5) {
                    formattedValue += ') ' + value.substring(4, 7);
                }
                if (value.length >= 8) {
                    formattedValue += '-' + value.substring(7, 9);
                }
                if (value.length >= 10) {
                    formattedValue += '-' + value.substring(9, 11);
                }
            }
            e.target.value = formattedValue;
        });
        input.addEventListener('focus', function(e) {
            if (!e.target.value) {
                e.target.value = '+7';
            }
        });
    }

    // ==============================================
    // 🖼️ СЖАТИЕ ИЗОБРАЖЕНИЯ
    // ==============================================
    function compressImage(file, maxWidth = 300, maxHeight = 300, quality = 0.5) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = function(event) {
                const img = new Image();
                img.src = event.target.result;
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    }

    // ==============================================
    // 🚀 ОТПРАВКА В GOOGLE SHEETS
    // ==============================================
    async function sendToGoogleSheets(data) {
        try {
            const dataToSend = {
                ...data,
                timestamp: new Date().toLocaleString('ru-RU')
            };

            console.log('📤 Отправка в Google Sheets:', {
                type: dataToSend.type,
                dataSize: JSON.stringify(dataToSend).length,
                hasFiles: !!(dataToSend.files && dataToSend.files.length)
            });

            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSend)
            });

            console.log('📬 Данные отправлены (режим no-cors)');
            showToast('✅ Заявка отправлена успешно!', 'success');

            if (WebApp && WebApp.HapticFeedback) {
                WebApp.HapticFeedback.notificationOccurred('success');
            }

            return true;

        } catch (error) {
            console.error('❌ Ошибка:', error);
            showToast('❌ Ошибка отправки: ' + error.message, 'error');

            if (WebApp && WebApp.HapticFeedback) {
                WebApp.HapticFeedback.notificationOccurred('error');
            }

            return false;
        }
    }

    // ==============================================
    // 🖼️ ЗАГРУЗКА ФАЙЛОВ
    // ==============================================
    function updateFileUI() {
        fileCount.textContent = `Выбрано: ${selectedFiles.length} / ${MAX_FILES}`;
        filePreviewGrid.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'file-preview-item';
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.alt = file.name;
                item.appendChild(img);
            } else {
                const icon = document.createElement('div');
                icon.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.6);font-size:24px;';
                icon.innerHTML = '<i class="fas fa-file"></i>';
                item.appendChild(icon);
            }
            const nameDiv = document.createElement('div');
            nameDiv.className = 'file-name';
            nameDiv.textContent = file.name.length > 12 ? file.name.substring(0, 10) + '…' : file.name;
            item.appendChild(nameDiv);
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file';
            removeBtn.innerHTML = '×';
            removeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                selectedFiles.splice(index, 1);
                updateFileUI();
            });
            item.appendChild(removeBtn);
            filePreviewGrid.appendChild(item);
        });
    }

    function handleFiles(files) {
        const remaining = MAX_FILES - selectedFiles.length;
        const filesToAdd = Array.from(files).slice(0, remaining);
        filesToAdd.forEach(file => {
            if (file.type.startsWith('image/')) {
                selectedFiles.push(file);
            }
        });
        updateFileUI();
        if (files.length > remaining) {
            showToast(`Можно загрузить не более ${MAX_FILES} файлов`, 'warning');
        }
    }

    // ==============================================
    // 📱 НАВИГАЦИЯ
    // ==============================================
    function showMainScreen() {
        mainScreen.classList.add('active');
        formScreen.classList.remove('active');
        ecasOverlay.classList.remove('active');
        ecasResultOverlay.classList.remove('active');
        ecasSiteOverlay.classList.remove('active');
        document.body.style.overflow = '';
        if (WebApp) {
            WebApp.BackButton.show();
        }
    }

    function showFormScreen(formHtml) {
        mainScreen.classList.remove('active');
        formScreen.classList.add('active');
        ecasOverlay.classList.remove('active');
        ecasResultOverlay.classList.remove('active');
        ecasSiteOverlay.classList.remove('active');
        formContent.innerHTML = formHtml;
        window.scrollTo(0, 0);
        if (WebApp && WebApp.HapticFeedback) {
            WebApp.HapticFeedback.impactOccurred('light');
        }
    }

    function openEcas() {
        ecasOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (WebApp) {
            WebApp.BackButton.show();
        }
    }

    function closeEcas() {
        ecasOverlay.classList.remove('active');
        document.body.style.overflow = '';
        showMainScreen();
    }

    function openEcasResult() {
        document.getElementById('graffitiAddress').value = '';
        selectedFiles = [];
        updateFileUI();
        ecasResultOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (WebApp) {
            WebApp.BackButton.show();
        }
    }

    function closeEcasResult() {
        ecasResultOverlay.classList.remove('active');
        document.body.style.overflow = '';
        showMainScreen();
    }

    function openEcasSite() {
        document.getElementById('siteUrl').value = '';
        ecasSiteOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (WebApp) {
            WebApp.BackButton.show();
        }
    }

    function closeEcasSite() {
        ecasSiteOverlay.classList.remove('active');
        document.body.style.overflow = '';
        showMainScreen();
    }

    // ==============================================
    // 📢 TOAST
    // ==============================================
    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastText = document.getElementById('toastText');
        toastText.innerText = message;
        toast.classList.add('show');
        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        else if (type === 'warning') icon = 'fa-exclamation-triangle';
        else if (type === 'error') icon = 'fa-times-circle';
        toast.innerHTML = `<i class="fas ${icon}"></i><span id="toastText">${message}</span>`;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    // ==============================================
    // 🔗 ГЛОБАЛЬНЫЕ ФУНКЦИИ
    // ==============================================
    window.openEcasResult = function() { openEcasResult(); };
    window.openEcasSite = function() { openEcasSite(); };

    // ==============================================
    // 🎯 ОБРАБОТЧИКИ СОБЫТИЙ
    // ==============================================

    // Навигация
    backToMainBtn.addEventListener('click', showMainScreen);
    ecasBackBtn.addEventListener('click', closeEcas);
    ecasResultBackBtn.addEventListener('click', closeEcasResult);
    ecasSiteBackBtn.addEventListener('click', closeEcasSite);

    // Загрузка файлов
    fileUploadArea.addEventListener('click', function() { fileInput.click(); });
    fileUploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    fileUploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
    });
    fileUploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', function(e) {
        handleFiles(e.target.files);
        this.value = '';
    });

    // ==============================================
    // 📝 ОТПРАВКА ФОРМЫ GRAFFITI
    // ==============================================
    document.getElementById('submitGraffitiBtn').addEventListener('click', async function() {
        const address = document.getElementById('graffitiAddress')?.value.trim();

        if (!address) {
            showToast('Введите адрес', 'warning');
            return;
        }

        if (selectedFiles.length === 0) {
            showToast('Загрузите хотя бы одно фото', 'warning');
            return;
        }

        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сжатие фото...';

        try {
            const compressedFiles = await Promise.all(
                selectedFiles.map(file => compressImage(file, 300, 300, 0.5))
            );

            console.log('✅ Фото сжаты. Количество:', compressedFiles.length);
            console.log('📊 Размер данных:',
                (compressedFiles.reduce((acc, f) => acc + f.length, 0) / 1024 / 1024).toFixed(2), 'MB'
            );

            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';

            const graffitiData = {
                type: 'graffiti',
                address: address,
                files: compressedFiles
            };

            await sendToGoogleSheets(graffitiData);

            setTimeout(() => {
                closeEcasResult();
                showToast('✅ Заявка отправлена!', 'success');
            }, 1500);

        } catch (error) {
            console.error('❌ Ошибка:', error);
            showToast('❌ Ошибка: ' + error.message, 'error');
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить заявку';
        }
    });

    // ==============================================
    // 🌐 ОТПРАВКА ФОРМЫ SITE
    // ==============================================
    document.getElementById('submitSiteBtn').addEventListener('click', async function() {
        const siteUrl = document.getElementById('siteUrl')?.value.trim();

        if (!siteUrl) {
            showToast('Введите адрес сайта', 'warning');
            return;
        }

        try {
            new URL(siteUrl);
        } catch {
            showToast('Введите корректный URL', 'warning');
            return;
        }

        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';

        try {
            const siteData = {
                type: 'site',
                site: siteUrl
            };

            await sendToGoogleSheets(siteData);

            setTimeout(() => {
                closeEcasSite();
                showToast('✅ Сайт отправлен!', 'success');
            }, 1500);

        } catch (error) {
            console.error('❌ Ошибка:', error);
            showToast('❌ Ошибка отправки', 'error');
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить';
        }
    });

    // ==============================================
    // 📋 КОНСУЛЬТАЦИЯ
    // ==============================================
    document.getElementById('menuConsult').addEventListener('click', function() {
        const formHtml = `
            <h1 style="font-size: clamp(22px, 6vw, 26px); margin-bottom: 16px; color: #1D1D1D; display: flex; align-items: center; gap: 12px;">
                <i class="fas fa-comments" style="color: #781EB4; background: rgba(120,30,180,0.1); padding: clamp(10px, 3vw, 12px); border-radius: 16px; font-size: clamp(22px, 6vw, 26px);"></i>
                Консультация
            </h1>
            <div class="form-section">
                <div class="form-group">
                    <label style="color: #1D1D1D;"><i class="fas fa-user" style="color: #781EB4;"></i> Фамилия и имя</label>
                    <input type="text" id="consultName" placeholder="Иванов Иван" autocomplete="name">
                </div>
                <div class="form-group">
                    <label style="color: #1D1D1D;"><i class="fas fa-phone" style="color: #781EB4;"></i> Номер телефона</label>
                    <input type="tel" id="consultPhone" placeholder="+7 (___) ___-__-__" autocomplete="tel">
                </div>
                <div class="form-group">
                    <label style="color: #1D1D1D;"><i class="fas fa-sync" style="color: #781EB4;"></i> Тип консультации</label>
                    <div class="radio-group">
                        <div class="radio-item"><input type="radio" name="consultType" id="consultPrimary" value="Первично" checked><label for="consultPrimary" style="color: #1D1D1D;">Первично</label></div>
                        <div class="radio-item"><input type="radio" name="consultType" id="consultRepeated" value="Повторно"><label for="consultRepeated" style="color: #1D1D1D;">Повторно</label></div>
                    </div>
                </div>
            </div>
            <div class="policy-text" style="color: #1D1D1D; border-left-color: #781EB4;">
                <i class="fas fa-shield" style="color: #781EB4;"></i>
                Нажимая на кнопку, вы даете согласие на <a href="#" onclick="window.WebApp.openLink('${POLICY_URL}'); return false;">обработку персональных данных</a> и соглашаетесь c <a href="#" onclick="window.WebApp.openLink('${POLICY_URL}'); return false;">политикой конфиденциальности</a>.
            </div>
            <button class="button" id="submitConsultBtn"><i class="fas fa-check-circle"></i> Записаться</button>
        `;
        showFormScreen(formHtml);
        phoneMask(document.getElementById('consultPhone'));
        document.getElementById('submitConsultBtn').addEventListener('click', function() {
            const name = document.getElementById('consultName')?.value.trim();
            const phone = document.getElementById('consultPhone')?.value.trim();
            if (!name) { showToast('Введите фамилию и имя', 'warning'); return; }
            if (!phone || phone === '+7') { showToast('Введите номер телефона', 'warning'); return; }
            const consultType = document.querySelector('input[name="consultType"]:checked')?.value || 'Первично';
            sendToGoogleSheets({ type: 'consultation', fullName: name, phone: phone, consultType: consultType });
            setTimeout(() => { showMainScreen(); }, 2000);
        });
    });

    // ==============================================
    // 📨 ПРИГЛАШЕНИЕ
    // ==============================================
    document.getElementById('menuInvite').addEventListener('click', function() {
        const formHtml = `
            <h1 style="font-size: clamp(22px, 6vw, 26px); margin-bottom: 16px; color: #1D1D1D; display: flex; align-items: center; gap: 12px;">
                <i class="fas fa-calendar-alt" style="color: #781EB4; background: rgba(120,30,180,0.1); padding: clamp(10px, 3vw, 12px); border-radius: 16px; font-size: clamp(22px, 6vw, 26px);"></i>
                Приглашение
            </h1>
            <div class="form-section">
                <div class="form-group"><label style="color: #1D1D1D;"><i class="fas fa-user-tie" style="color: #781EB4;"></i> ФИО</label><input type="text" id="inviteFullName" placeholder="Иванов Иван Иванович"></div>
                <div class="form-group"><label style="color: #1D1D1D;"><i class="fas fa-briefcase" style="color: #781EB4;"></i> Должность</label><input type="text" id="invitePosition" placeholder="Директор, специалист..."></div>
                <div class="form-group"><label style="color: #1D1D1D;"><i class="fas fa-phone" style="color: #781EB4;"></i> Номер телефона</label><input type="tel" id="invitePhone" placeholder="+7 (___) ___-__-__"></div>
                <div class="form-group"><label style="color: #1D1D1D;"><i class="fas fa-city" style="color: #781EB4;"></i> Муниципальное образование</label><input type="text" id="inviteMunicipality" placeholder="г. Ижевск, Завьяловский р-н..."></div>
                <div class="form-group"><label style="color: #1D1D1D;"><i class="fas fa-building" style="color: #781EB4;"></i> Организация</label><input type="text" id="inviteOrg" placeholder="ООО Пример, Школа №1..."></div>
            </div>
            <div class="policy-text" style="color: #1D1D1D; border-left-color: #781EB4;">
                <i class="fas fa-shield" style="color: #781EB4;"></i>
                Нажимая на кнопку, вы даете согласие на <a href="#" onclick="window.WebApp.openLink('${POLICY_URL}'); return false;">обработку персональных данных</a> и соглашаетесь c <a href="#" onclick="window.WebApp.openLink('${POLICY_URL}'); return false;">политикой конфиденциальности</a>.
            </div>
            <button class="button" id="submitInviteBtn"><i class="fas fa-paper-plane"></i> Отправить приглашение</button>
        `;
        showFormScreen(formHtml);
        phoneMask(document.getElementById('invitePhone'));
        document.getElementById('submitInviteBtn').addEventListener('click', function() {
            const fullName = document.getElementById('inviteFullName')?.value.trim();
            const position = document.getElementById('invitePosition')?.value.trim();
            const phone = document.getElementById('invitePhone')?.value.trim();
            const municipality = document.getElementById('inviteMunicipality')?.value.trim();
            const org = document.getElementById('inviteOrg')?.value.trim();
            if (!fullName || !position || !phone || !municipality || !org) { showToast('Заполните все поля', 'warning'); return; }
            if (phone === '+7') { showToast('Введите номер телефона', 'warning'); return; }
            sendToGoogleSheets({ type: 'event_invite', fullName, position, phone, municipality, organization: org });
            setTimeout(() => { showMainScreen(); }, 2000);
        });
    });

    // ==============================================
    // 🏠 ЕЦАС
    // ==============================================
    document.getElementById('menuECAS').addEventListener('click', function() {
        openEcas();
    });

    // ==============================================
    // ⚙️ ИНИЦИАЛИЗАЦИЯ MAX WEB APP
    // ==============================================
    if (!WebApp) {
        alert('⚠️ Приложение запущено не в MAX.');
    } else {
        function applyMaxTheme() {
            const body = document.body;
            const theme = WebApp.colorScheme || WebApp.theme || 'light';
            if (theme === 'dark' || theme === 'night' || theme === 'black') {
                body.classList.add('dark-theme');
            } else {
                body.classList.remove('dark-theme');
            }
        }

        applyMaxTheme();
        WebApp.onEvent('themeChanged', function() { applyMaxTheme(); });
        if (WebApp.onEvent) {
            WebApp.onEvent('colorSchemeChanged', applyMaxTheme);
        }

        WebApp.ready();
        WebApp.enableClosingConfirmation();
        WebApp.BackButton.show();
        WebApp.BackButton.onClick(() => {
            const overlay = document.getElementById('ecasOverlay');
            const result = document.getElementById('ecasResultOverlay');
            const site = document.getElementById('ecasSiteOverlay');
            if (site.classList.contains('active')) {
                closeEcasSite();
            } else if (result.classList.contains('active')) {
                closeEcasResult();
            } else if (overlay.classList.contains('active')) {
                closeEcas();
            } else if (formScreen.classList.contains('active')) {
                showMainScreen();
            } else {
                WebApp.close();
            }
        });
    }

    // ==============================================
    // 🚀 СТАРТ
    // ==============================================
    function initUserData() {
        const user = WebApp?.initDataUnsafe?.user;
        if (user) {
            console.log('Пользователь MAX:', user);
        }
    }

    showMainScreen();
    initUserData();

})();
