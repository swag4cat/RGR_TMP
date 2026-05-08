// API URL
const API_URL = 'http://localhost:8000';

// Глобальные переменные
let map = null;
let markers = [];
let currentUser = null;

// Проверка авторизации
async function checkAuth() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        showLoginForm();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            currentUser = await response.json();
            document.getElementById('username').innerText = currentUser.username;
            showDashboard();
            loadObjects();
            if (currentUser.role === 'admin') {
                loadLogs();
                document.getElementById('logs-panel').classList.remove('hidden');
            }
        } else {
            localStorage.removeItem('access_token');
            showLoginForm();
        }
    } catch (error) {
        console.error('Auth error:', error);
        showLoginForm();
    }
}

// Показать форму логина
function showLoginForm() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
}

// Показать дашборд
function showDashboard() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    initMap();
}

// Инициализация карты
function initMap() {
    if (map) return;
    map = L.map('map').setView([55.7558, 37.6173], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

// Загрузка объектов
async function loadObjects() {
    const token = localStorage.getItem('access_token');
    try {
        const response = await fetch(`${API_URL}/objects/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const objects = await response.json();
            updateStats(objects);
            updateMap(objects);
            updateActionPanel(objects);
            renderObjectsList(objects);
        }
    } catch (error) {
        console.error('Error loading objects:', error);
    }
}

// Обновление статистики
function updateStats(objects) {
    document.getElementById('total-objects').innerText = objects.length;
    const normal = objects.filter(o => o.status === 'normal').length;
    const alert = objects.filter(o => o.status === 'alert').length;
    document.getElementById('normal-objects').innerText = normal;
    document.getElementById('alert-objects').innerText = alert;
    document.getElementById('incidents-today').innerText = alert;
}

// Обновление карты
function updateMap(objects) {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    objects.forEach(obj => {
        let color = '#10b981';
        let statusText = 'Норма';

        if (obj.status === 'alert') {
            color = '#ef4444';
            statusText = 'ТРЕВОГА!';
        } else if (obj.status === 'warning') {
            color = '#f59e0b';
            statusText = 'Внимание';
        }

        const customIcon = L.divIcon({
            html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); ${obj.status === 'alert' ? 'animation: pulse 1s infinite;' : ''}">⚠️</div>`,
                                     iconSize: [24, 24],
                                     popupAnchor: [0, -12]
        });

        const marker = L.marker([obj.latitude, obj.longitude], { icon: customIcon })
        .addTo(map)
        .bindPopup(`
        <b>${obj.name}</b><br>
        Тип: ${obj.type}<br>
        Статус: <span style="color: ${color}">${statusText}</span>
        `);

        markers.push(marker);
    });
}

// Отображение списка объектов
function renderObjectsList(objects) {
    const tbody = document.getElementById('objects-table');
    if (!tbody) return;

    const isAdmin = currentUser && currentUser.role === 'admin';

    tbody.innerHTML = objects.map(obj => `
    <tr class="border-b">
    <td class="p-2">${obj.id}</td>
    <td class="p-2">${obj.name}</td>
    <td class="p-2">${obj.type}</td>
    <td class="p-2">${obj.latitude.toFixed(4)}, ${obj.longitude.toFixed(4)}</td>
    <td class="p-2">
    <span class="px-2 py-1 rounded text-xs text-white ${obj.status === 'alert' ? 'bg-red-500' : (obj.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500')}">
    ${obj.status}
    </span>
    </td>
    <td class="p-2">
    ${isAdmin ? `
        <button onclick="deleteObject(${obj.id})" class="text-red-600 hover:text-red-800 mr-2">
        <i class="fas fa-trash"></i>
        </button>
        <button onclick="editObject(${obj.id}, '${obj.name}')" class="text-blue-600 hover:text-blue-800">
        <i class="fas fa-edit"></i>
        </button>
        ` : '-'}
        </td>
        </tr>
        `).join('');
}

// Удаление объекта
window.deleteObject = async (id) => {
    if (!confirm('Удалить объект?')) return;
    const token = localStorage.getItem('access_token');
    try {
        const response = await fetch(`${API_URL}/objects/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            loadObjects();
        } else {
            alert('Ошибка удаления');
        }
    } catch (error) {
        alert('Ошибка: ' + error);
    }
};

// Редактирование объекта
window.editObject = async (id, oldName) => {
    const newName = prompt('Введите новое название:', oldName);
    if (!newName || newName === oldName) return;
    const token = localStorage.getItem('access_token');
    try {
        const response = await fetch(`${API_URL}/objects/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: newName })
        });
        if (response.ok) {
            loadObjects();
        } else {
            alert('Ошибка редактирования');
        }
    } catch (error) {
        alert('Ошибка: ' + error);
    }
};

// Панель действий в зависимости от роли
function updateActionPanel(objects) {
    const panel = document.getElementById('action-panel');
    if (!panel) return;

    if (currentUser.role === 'admin') {
        panel.innerHTML = `
        <h2 class="text-lg font-semibold mb-3">Администрирование</h2>
        <form id="create-object-form" class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <input type="text" id="obj-name" placeholder="Название объекта" class="border rounded-lg px-3 py-2" required>
        <input type="text" id="obj-type" placeholder="Тип (ТЭЦ, подстанция...)" class="border rounded-lg px-3 py-2" required>
        <input type="text" id="obj-coords" placeholder="Координаты (кликните на карте)" class="border rounded-lg px-3 py-2 bg-gray-100" readonly required>
        <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">+ Добавить объект</button>
        </form>
        <div class="mt-2 text-sm text-gray-500">
        <i class="fas fa-info-circle"></i> Кликните на карте, чтобы выбрать место для объекта
        </div>
        `;

        let clickLat = null, clickLng = null;

        map.on('click', (e) => {
            clickLat = e.latlng.lat;
            clickLng = e.latlng.lng;
            const coordInput = document.getElementById('obj-coords');
            if (coordInput) {
                coordInput.value = `${clickLat.toFixed(6)}, ${clickLng.toFixed(6)}`;
            }
        });

        const form = document.getElementById('create-object-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!clickLat) {
                    alert('Сначала кликните на карте, чтобы выбрать место');
                    return;
                }

                const name = document.getElementById('obj-name').value;
                const type = document.getElementById('obj-type').value;
                const token = localStorage.getItem('access_token');

                const response = await fetch(`${API_URL}/objects/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: name,
                        description: '',
                        type: type,
                        latitude: clickLat,
                        longitude: clickLng
                    })
                });

                if (response.ok) {
                    alert('Объект создан!');
                    loadObjects();
                    form.reset();
                                  document.getElementById('obj-coords').value = '';
                    clickLat = null;
                } else {
                    const error = await response.json();
                    alert('Ошибка: ' + JSON.stringify(error));
                }
            });
        }

    } else if (currentUser.role === 'operator') {
        panel.innerHTML = `
        <h2 class="text-lg font-semibold mb-3">Управление объектом</h2>
        <button id="alert-btn" class="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition text-lg font-bold">
        <i class="fas fa-exclamation-triangle"></i> ТРЕВОГА!
        </button>
        <p class="text-sm text-gray-500 mt-2">Нажмите кнопку для вызова инженера</p>
        `;

        const alertBtn = document.getElementById('alert-btn');
        if (alertBtn) {
            alertBtn.addEventListener('click', async () => {
                const token = localStorage.getItem('access_token');
                const response = await fetch(`${API_URL}/objects/1/alert`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    alert('Тревога активирована!');
                    loadObjects();
                } else {
                    alert('Ошибка: ' + response.status);
                }
            });
        }

    } else if (currentUser.role === 'engineer') {
        panel.innerHTML = `
        <h2 class="text-lg font-semibold mb-3">Инженерная панель</h2>
        <div class="text-gray-600">Ожидание инцидентов...</div>
        `;
    }
}

// Загрузка логов
async function loadLogs() {
    const token = localStorage.getItem('access_token');
    try {
        const response = await fetch(`${API_URL}/logs/?limit=20`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const logs = await response.json();
            const tbody = document.getElementById('logs-table');
            if (tbody) {
                tbody.innerHTML = logs.map(log => `
                <tr class="border-b">
                <td class="p-2">${new Date(log.created_at).toLocaleString()}</td>
                <td class="p-2">${log.action}</td>
                <td class="p-2">${JSON.stringify(log.details)}</td>
                </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading logs:', error);
    }
}

// Логаут
document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('access_token');
    window.location.reload();
});

// Логин
document.getElementById('login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `username=${username}&password=${password}`
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('access_token', data.access_token);
            window.location.reload();
        } else {
            document.getElementById('login-error').innerText = 'Неверный логин или пароль';
            document.getElementById('login-error').classList.remove('hidden');
        }
    } catch (error) {
        document.getElementById('login-error').innerText = 'Ошибка соединения с сервером';
        document.getElementById('login-error').classList.remove('hidden');
    }
});

// Запуск
checkAuth();
