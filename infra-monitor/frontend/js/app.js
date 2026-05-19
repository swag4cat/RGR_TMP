const API_URL = 'http://localhost:8000';

let map = null;
let markers = [];
let currentUser = null;

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

            const usernameSpan = document.getElementById('username');
            if (usernameSpan) usernameSpan.innerText = currentUser.username;

            showDashboard();
            loadObjects();

            if (currentUser.role === 'admin') {
                const tabsContainer = document.getElementById('admin-tabs');
                if (tabsContainer) tabsContainer.classList.remove('hidden');
                initTabs();
                loadUsers();
                loadPendingRequests();
                loadLogs();
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

function showLoginForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const dashboard = document.getElementById('dashboard');

    if (loginForm) loginForm.classList.remove('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    if (dashboard) dashboard.classList.add('hidden');
}

function showRegisterForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const dashboard = document.getElementById('dashboard');

    if (loginForm) loginForm.classList.add('hidden');
    if (registerForm) registerForm.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');
}

function showDashboard() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const dashboard = document.getElementById('dashboard');
    const adminTabs = document.getElementById('admin-tabs');

    if (loginForm) loginForm.classList.add('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');

    if (adminTabs) {
        if (currentUser && currentUser.role === 'admin') {
            adminTabs.classList.remove('hidden');
        } else {
            adminTabs.classList.add('hidden');
        }
    }

    initMap();
}

function initMap() {
    if (map) return;
    map = L.map('map').setView([55.7558, 37.6173], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            contents.forEach(content => content.classList.add('hidden'));
            document.getElementById(tabId).classList.remove('hidden');

            tabs.forEach(b => {
                b.classList.remove('bg-blue-600', 'text-white');
                b.classList.add('text-gray-600');
            });
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('text-gray-600');
        });
    });
}

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

function updateStats(objects) {
    document.getElementById('total-objects').innerText = objects.length;
    const normal = objects.filter(o => o.status === 'normal').length;
    const alert = objects.filter(o => o.status === 'alert').length;
    document.getElementById('normal-objects').innerText = normal;
    document.getElementById('alert-objects').innerText = alert;
    document.getElementById('incidents-today').innerText = alert;
}

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

async function updateActionPanel(objects) {
    const panel = document.getElementById('action-panel');
    if (!panel) return;
    const token = localStorage.getItem('access_token');

    if (currentUser.role === 'admin') {
        let operators = [];
        let assignments = [];

        try {
            const usersRes = await fetch(`${API_URL}/users/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (usersRes.ok) {
                const allUsers = await usersRes.json();
                operators = allUsers.filter(u =>
                    u.role === 'operator' &&
                    (u.status === 'ACTIVE' || u.status === 'active')
                );
                console.log('Найдено операторов:', operators.length);
            }

            const objectsRes = await fetch(`${API_URL}/objects/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const allObjects = objectsRes.ok ? await objectsRes.json() : [];

            assignments = operators
                .filter(op => op.assigned_object_id)
                .map(op => {
                    const obj = allObjects.find(o => o.id === op.assigned_object_id);
                    return {
                        operator_id: op.id,
                        operator_name: op.username,
                        object_id: op.assigned_object_id,
                        object_name: obj ? obj.name : 'Неизвестный объект'
                    };
                });
        } catch (error) {
            console.error('Error loading data:', error);
        }

        panel.innerHTML = `
            <!-- Добавление объекта -->
            <div class="mb-6 pb-4 border-b">
                <h2 class="text-lg font-semibold mb-3">➕ Добавление объекта</h2>
                <form id="create-object-form" class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input type="text" id="obj-name" placeholder="Название" class="border rounded-lg px-3 py-2" required>
                    <input type="text" id="obj-type" placeholder="Тип" class="border rounded-lg px-3 py-2" required>
                    <input type="text" id="obj-coords" placeholder="Координаты (кликните на карте)" class="border rounded-lg px-3 py-2 bg-gray-100" readonly required>
                    <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded-lg">➕ Добавить</button>
                </form>
                <div class="mt-2 text-sm text-gray-500">Кликните на карте, чтобы выбрать место</div>
            </div>

            <!-- Привязка оператора -->
            <div class="mb-6 pb-4 border-b">
                <h2 class="text-lg font-semibold mb-3">🔗 Привязка оператора к объекту</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <select id="assign-operator-id" class="border rounded-lg px-3 py-2">
                        <option value="">Выберите оператора</option>
                        ${operators.map(op => `<option value="${op.id}">${op.username} (${op.email || ''})</option>`).join('')}
                    </select>
                    <select id="assign-object-id" class="border rounded-lg px-3 py-2">
                        <option value="">Выберите объект</option>
                        ${objects.map(obj => `<option value="${obj.id}">${obj.name}</option>`).join('')}
                    </select>
                    <button id="assign-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg">🔗 Привязать</button>
                </div>
            </div>

            <!-- Таблица текущих привязок -->
            <div class="mb-6">
                <h2 class="text-lg font-semibold mb-3">📋 Текущие привязки операторов</h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm border">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="p-2 text-left">Оператор</th>
                                <th class="p-2 text-left">Объект</th>
                                <th class="p-2 text-left">Действие</th>
                            </tr>
                        </thead>
                        <tbody id="assignments-table">
                            ${assignments.length === 0 ?
                                `<tr><td colspan="3" class="text-center py-4 text-gray-500">Нет привязанных операторов</td></tr>` :
                                assignments.map(a => `
                                    <tr class="border-b">
                                        <td class="p-2">${a.operator_name} (ID: ${a.operator_id})</td>
                                        <td class="p-2">${a.object_name} (ID: ${a.object_id})</td>
                                        <td class="p-2">
                                            <button onclick="unassignOperator(${a.operator_id})" class="bg-red-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-700">
                                                🔓 Отвязать
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        let clickLat = null, clickLng = null;

        map.off('click');
        map.on('click', (e) => {
            clickLat = e.latlng.lat;
            clickLng = e.latlng.lng;
            const coordInput = document.getElementById('obj-coords');
            if (coordInput) coordInput.value = `${clickLat.toFixed(6)}, ${clickLng.toFixed(6)}`;
        });

        const createForm = document.getElementById('create-object-form');
        if (createForm) {
            createForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!clickLat) return alert('Кликните на карте, чтобы выбрать место');

                const name = document.getElementById('obj-name').value;
                const type = document.getElementById('obj-type').value;

                const res = await fetch(`${API_URL}/objects/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name,
                        type,
                        latitude: clickLat,
                        longitude: clickLng,
                        description: ''
                    })
                });

                if (res.ok) {
                    alert('Объект создан');
                    loadObjects();
                    createForm.reset();
                    document.getElementById('obj-coords').value = '';
                    clickLat = null;
                } else {
                    alert('Ошибка создания');
                }
            });
        }

        const assignBtn = document.getElementById('assign-btn');
        if (assignBtn) {
            assignBtn.addEventListener('click', async () => {
                const userId = document.getElementById('assign-operator-id').value;
                const objectId = document.getElementById('assign-object-id').value;

                if (!userId || !objectId) {
                    return alert('Выберите оператора и объект');
                }

                const res = await fetch(`${API_URL}/admin/assign-operator/${userId}/${objectId}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.message && data.message.includes('reassigned')) {
                        alert('✅ Оператор перепривязан к новому объекту');
                    } else {
                        alert('✅ Оператор привязан к объекту');
                    }
                    loadObjects();
                } else {
                    alert('❌ Ошибка привязки');
                }
            });
        }

    } else if (currentUser.role === 'operator') {
        const myObject = objects.find(o => o.id === currentUser.assigned_object_id);
        if (!myObject) {
            panel.innerHTML = `<div class="text-red-600">⚠️ Вам не назначен объект. Обратитесь к администратору.</div>`;
        } else {
            panel.innerHTML = `
                <h2 class="text-lg font-semibold mb-3">🚨 Управление объектом: ${myObject.name}</h2>
                <button id="alert-btn" class="bg-red-600 text-white px-6 py-3 rounded-lg text-lg font-bold hover:bg-red-700">
                    <i class="fas fa-exclamation-triangle"></i> ТРЕВОГА!
                </button>
            `;

            const alertBtn = document.getElementById('alert-btn');
            if (alertBtn) {
                alertBtn.addEventListener('click', async () => {
                    const res = await fetch(`${API_URL}/objects/${myObject.id}/alert`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        alert('🚨 Тревога активирована! Инженер будет вызван.');
                        loadObjects();
                    } else {
                        alert('❌ Ошибка');
                    }
                });
            }
        }

    } else if (currentUser.role === 'engineer') {
        const alertObjects = objects.filter(o => o.status === 'alert');
        if (alertObjects.length === 0) {
            panel.innerHTML = `<div class="text-green-600">✅ Нет активных тревог. Отдыхайте :)</div>`;
        } else {
            panel.innerHTML = `
                <h2 class="text-lg font-semibold mb-3">⚠️ Активные тревоги</h2>
                <div class="space-y-2">
                    ${alertObjects.map(obj => `
                        <div class="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                            <div>
                                <span class="font-bold">${obj.name}</span>
                                <span class="text-sm text-gray-500 ml-2">${obj.type}</span>
                            </div>
                            <button onclick="resolveAlert(${obj.id})" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                                <i class="fas fa-check"></i> Решено
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
}

window.resolveAlert = async (objectId) => {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${API_URL}/objects/${objectId}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        alert('Инцидент закрыт');
        loadObjects();
    } else alert('Ошибка');
};

async function loadUsers() {
    const token = localStorage.getItem('access_token');
    try {
        const res = await fetch(`${API_URL}/users/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const users = await res.json();
            const tbody = document.getElementById('users-table');
            if (tbody) {
                if (users.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4">Нет пользователей</td></tr>`;
                } else {
                    tbody.innerHTML = users.map(u => `
                        <tr class="border-b">
                            <td class="p-2">${u.id}</td>
                            <td class="p-2">${u.username}</td>
                            <td class="p-2">${u.email}</td>
                            <td class="p-2">${u.role}</td>
                            <td class="p-2">${u.status}</td>
                            <td class="p-2"><button onclick="deleteUser(${u.id})" class="text-red-600">Удалить</button></td>
                        </tr>
                    `).join('');
                }
            }
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function loadPendingRequests() {
    const token = localStorage.getItem('access_token');
    try {
        const res = await fetch(`${API_URL}/users/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const users = await res.json();
            const tbody = document.getElementById('requests-table');
            if (tbody) {
                if (users.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Нет заявок</td></tr>`;
                } else {
                    tbody.innerHTML = users.map(u => `
                        <tr class="border-b">
                            <td class="p-2">${u.id}</td>
                            <td class="p-2">${u.username}</td>
                            <td class="p-2">${u.email}</td>
                            <td class="p-2">${new Date(u.created_at).toLocaleString()}</td>
                            <td class="p-2">
                                <select id="role-${u.id}" class="border rounded px-2 py-1">
                                    <option value="operator">Оператор</option>
                                    <option value="engineer">Инженер</option>
                                    <option value="admin">Админ</option>
                                </select>
                                <button onclick="approveUser(${u.id})" class="bg-green-600 text-white px-3 py-1 rounded ml-2">✅</button>
                                <button onclick="deleteUser(${u.id})" class="bg-red-600 text-white px-3 py-1 rounded ml-1">❌</button>
                            </td>
                        </tr>
                    `).join('');
                }
            }
        }
    } catch (error) {
        console.error('Error loading requests:', error);
    }
}

window.approveUser = async (userId) => {
    const roleSelect = document.getElementById(`role-${userId}`);
    const role = roleSelect?.value || 'operator';
    const token = localStorage.getItem('access_token');
    await fetch(`${API_URL}/users/${userId}/approve?role=${role}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    loadPendingRequests();
    loadUsers();
};

window.deleteUser = async (userId) => {
    if (!confirm('Удалить пользователя?')) return;
    const token = localStorage.getItem('access_token');
    await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    loadPendingRequests();
    loadUsers();
};

async function loadLogs() {
    const token = localStorage.getItem('access_token');
    try {
        const res = await fetch(`${API_URL}/logs/?limit=50`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const logs = await res.json();
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

document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('access_token');
    location.reload();
});

document.getElementById('login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `username=${username}&password=${password}`
        });
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('access_token', data.access_token);
            location.reload();
        } else {
            const err = await res.json();
            document.getElementById('login-error').innerText = err.detail || 'Ошибка';
            document.getElementById('login-error').classList.remove('hidden');
        }
    } catch (error) {
        document.getElementById('login-error').innerText = 'Ошибка соединения';
        document.getElementById('login-error').classList.remove('hidden');
    }
});

document.getElementById('register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        if (res.ok) {
            document.getElementById('register-success').innerText = 'Регистрация успешна! Ожидайте подтверждения.';
            document.getElementById('register-success').classList.remove('hidden');
            setTimeout(() => showLoginForm(), 2000);
        } else {
            const err = await res.json();
            document.getElementById('register-error').innerText = err.detail || 'Ошибка';
            document.getElementById('register-error').classList.remove('hidden');
        }
    } catch (error) {
        document.getElementById('register-error').innerText = 'Ошибка соединения';
        document.getElementById('register-error').classList.remove('hidden');
    }
});

document.getElementById('show-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
});

document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
});

// Отвязка оператора
window.unassignOperator = async (userId) => {
    if (!confirm('Отвязать оператора от объекта?')) return;
    const token = localStorage.getItem('access_token');

    try {
        const response = await fetch(`${API_URL}/admin/unassign-operator/${userId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            alert('✅ Оператор отвязан от объекта');
            loadObjects();
        } else {
            alert('❌ Ошибка отвязки');
        }
    } catch (error) {
        alert('Ошибка: ' + error);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
