// js/admin.js - VERSIÓN FIREBASE
import FirebaseService from './firebase-service.js';

let unsubscribeReservations = null;

document.addEventListener('DOMContentLoaded', () => {
    // Admin Auth Check
    FirebaseService.onAuthChange(async (user) => {
        if (!user) {
            window.location.href = 'admin-login.html';
            return;
        }

        const isAdmin = await FirebaseService.checkIfAdmin(user.email);
        if (!isAdmin) {
            alert('No tenés permisos de administrador');
            await FirebaseService.logout();
            window.location.href = 'admin-login.html';
            return;
        }

        // Usuario es admin, inicializar el panel
        initializeAdminPanel();
    });
});

// Helper: Parse date string as local date to avoid timezone issues
function parseLocalDate(dateString) {
    // dateString is "YYYY-MM-DD"
    const [year, month, day] = dateString.split('-').map(Number);
    // month is 1-indexed in string, 0-indexed in Date constructor
    return new Date(year, month - 1, day);
}


async function initializeAdminPanel() {
    // Navigation
    const tabs = document.querySelectorAll('.nav-item[data-tab]');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');

            // Refresh data
            if (tab.dataset.tab === 'reservations') renderReservations();
            if (tab.dataset.tab === 'calendar') renderAdminCalendar();
            if (tab.dataset.tab === 'news') renderAdminNews();
            if (tab.dataset.tab === 'times') renderTimeSlots();
            if (tab.dataset.tab === 'price') renderPrice();
            if (tab.dataset.tab === 'free-tables') renderFreeTablesAdmin();
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await FirebaseService.logout();
        window.location.href = 'admin-login.html';
    });

    // --- Reservations Logic ---
    const reservationsTable = document.querySelector('#reservationsTable tbody');
    const reservationsTotalAmountEl = document.getElementById('reservationsTotalAmount');
    const searchInput = document.getElementById('searchReservations');
    const searchDateStart = document.getElementById('searchDateStart');
    const searchDateEnd = document.getElementById('searchDateEnd');
    const searchStatus = document.getElementById('searchStatus');
    const clearReservationFiltersBtn = document.getElementById('clearReservationFiltersBtn');
    const deleteSelectedReservationsBtn = document.getElementById('deleteSelectedReservationsBtn');
    const selectAllReservations = document.getElementById('selectAllReservations');

    const selectedReservations = new Set();

    let currentPage = 1;
    let itemsPerPage = 20;
    const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const currentPageDisplay = document.getElementById('currentPageDisplay');

    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', (e) => {
            itemsPerPage = parseInt(e.target.value, 10);
            currentPage = 1;
            renderReservations();
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderReservations();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            currentPage++;
            renderReservations();
        });
    }

    async function renderReservations() {
        const reservations = await FirebaseService.getReservations();
        const filter = searchInput.value.toLowerCase();
        const startDate = searchDateStart.value;
        const endDate = searchDateEnd.value;
        const statusFilter = searchStatus.value;

        const filtered = reservations.filter(r => {
            const matchesText = r.userName.toLowerCase().includes(filter) ||
                r.game.toLowerCase().includes(filter);

            const resDate = r.date.split('T')[0];

            let matchesDate = true;
            if (startDate) matchesDate = matchesDate && resDate >= startDate;
            if (endDate) matchesDate = matchesDate && resDate <= endDate;

            let matchesStatus = true;
            if (statusFilter) {
                if (statusFilter === 'pending') {
                    matchesStatus = r.status === 'pending' || r.status === 'pending_payment';
                } else {
                    matchesStatus = r.status === statusFilter;
                }
            }

            return matchesText && matchesDate && matchesStatus;
        });

        const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

        if (currentPage > totalPages) {
            currentPage = totalPages;
        } else if (currentPage < 1) {
            currentPage = 1;
        }

        if (currentPageDisplay) {
            currentPageDisplay.textContent = currentPage;
            currentPageDisplay.style.backgroundColor = '#EDEDF1';
            currentPageDisplay.style.borderColor = '#D6D8E1';
            currentPageDisplay.style.color = 'var(--foreground)';
            currentPageDisplay.style.fontWeight = '600';
        }

        if (prevPageBtn) {
            prevPageBtn.disabled = currentPage <= 1;
            prevPageBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
            prevPageBtn.style.cursor = currentPage <= 1 ? 'not-allowed' : 'pointer';
        }

        if (nextPageBtn) {
            nextPageBtn.disabled = currentPage >= totalPages;
            nextPageBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
            nextPageBtn.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
        }

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedReservations = filtered.slice(startIndex, endIndex);

        reservationsTable.innerHTML = '';

        if (selectAllReservations) selectAllReservations.checked = false;

        const existingReservations = new Set(filtered.map(r => r.id));
        const removedSelections = [];

        selectedReservations.forEach(id => {
            if (!existingReservations.has(id)) {
                removedSelections.push(id);
            }
        });

        removedSelections.forEach(id => selectedReservations.delete(id));
        updateDeleteButtonState();

        if (paginatedReservations.length === 0) {
            reservationsTable.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 2rem; color: #666;">
                        ${filtered.length === 0 ? 'No hay reservas que coincidan con los filtros' : 'No hay reservas en esta página'}
                    </td>
                </tr>
            `;
        } else {
            reservationsTable.innerHTML = paginatedReservations.map(r => {
                let statusClass = 'status-pending';
                let statusLabel = 'Pendiente';

                if (r.status === 'confirmed') {
                    statusClass = 'status-confirmed';
                    statusLabel = 'Aceptada';
                } else if (r.status === 'pending_payment' || r.status === 'pending') {
                    statusClass = 'status-pending';
                    statusLabel = 'Pendiente de pago';
                } else if (r.status === 'rejected') {
                    statusClass = 'status-rejected';
                    statusLabel = 'Rechazada';
                }

                // CORREGIDO: Usar el precio histórico guardado en la reserva
                const historicalPrice = r.pricePerPerson || (r.total / (r.people || 1));
                const totalAmount = r.total || ((r.people || 0) * historicalPrice);
                const isChecked = selectedReservations.has(r.id);
                const occupancy = `${r.people || 0}/4`;

                return `
                <tr>
                    <td style="text-align: center;">
                        <input type="checkbox" class="reservation-checkbox" data-id="${r.id}" 
                               ${isChecked ? 'checked' : ''}
                               style="width: 16px; height: 16px; cursor: pointer;">
                    </td>
                    <td>${parseLocalDate(r.date).toLocaleDateString()}</td>
                    <td>${r.time}</td>
                    <td>${r.userName}</td>
                    <td>${r.phone || '-'}</td>
                    <td>${r.game}</td>
                    <td>${r.people}</td>
                    <td>${occupancy}</td>
                    <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                    <td>$${totalAmount.toLocaleString('es-AR')}</td>
                    <td>
                        <button class="btn btn-edit-blue" onclick="editRes('${r.id}')" style="margin-right: 0.5rem;"><span class="material-symbols-outlined" style="font-size: 16px;">edit_square</span> Editar</button>
                        <button class="btn btn-delete-red" onclick="deleteRes('${r.id}')"><span class="material-symbols-outlined" style="font-size: 16px;">delete</span> Eliminar</button>
                    </td>
                </tr>
                `;
            }).join('');
        }

        if (reservationsTotalAmountEl) {
            const totalRevenue = filtered.reduce((sum, r) => {
                // CORREGIDO: Usar el total histórico guardado en cada reserva
                const reservationTotal = r.total || ((r.people || 0) * (r.pricePerPerson || 5000));
                return sum + reservationTotal;
            }, 0);

            reservationsTotalAmountEl.textContent = `$${totalRevenue.toLocaleString('es-AR')}`;
        }
    }

    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('reservation-checkbox')) {
            const reservationId = e.target.dataset.id;
            if (e.target.checked) {
                selectedReservations.add(reservationId);
            } else {
                selectedReservations.delete(reservationId);
                if (selectAllReservations) selectAllReservations.checked = false;
            }
            updateDeleteButtonState();
        }
    });

    searchInput.addEventListener('input', renderReservations);
    searchDateStart.addEventListener('change', renderReservations);
    searchDateEnd.addEventListener('change', renderReservations);
    searchStatus.addEventListener('change', renderReservations);

    if (clearReservationFiltersBtn) {
        clearReservationFiltersBtn.addEventListener('click', () => {
            if (searchDateStart) searchDateStart.value = '';
            if (searchDateEnd) searchDateEnd.value = '';
            if (searchStatus) searchStatus.value = '';
            selectedReservations.clear();
            if (selectAllReservations) selectAllReservations.checked = false;
            renderReservations();
        });
    }

    window.deleteRes = async (id) => {
        if (confirm('¿Estás seguro de eliminar esta reserva?')) {
            await FirebaseService.deleteReservation(id);
            renderReservations();
        }
    };

    window.editRes = async (id) => {
        const reservations = await FirebaseService.getReservations();
        const reservation = reservations.find(r => r.id === id);

        if (!reservation) {
            alert('Reserva no encontrada');
            return;
        }

        window.currentEditId = id;

        const dateObj = parseLocalDate(reservation.date);
        const formattedDate = dateObj.toISOString().split('T')[0];
        document.getElementById('editDate').value = formattedDate;

        const editTimeSelect = document.getElementById('editTime');
        const timeSlots = await FirebaseService.getTimeSlots();
        editTimeSelect.innerHTML = '';
        timeSlots.forEach(slot => {
            const opt = document.createElement('option');
            opt.value = slot.label;
            opt.textContent = slot.label;
            editTimeSelect.appendChild(opt);
        });
        editTimeSelect.value = reservation.time;
        document.getElementById('editClient').value = reservation.userName;
        document.getElementById('editPhone').value = reservation.phone || '';
        document.getElementById('editGame').value = reservation.game;
        document.getElementById('editPeople').value = reservation.people;
        document.getElementById('editStatus').value = reservation.status;

        document.getElementById('editModal').classList.add('open');
    };

    window.closeEditModal = () => {
        document.getElementById('editModal').classList.remove('open');
        window.currentEditId = null;
    };

    window.saveEditReservation = async () => {
        if (!window.currentEditId) return;

        const updates = {
            date: document.getElementById('editDate').value,
            time: document.getElementById('editTime').value,
            userName: document.getElementById('editClient').value,
            phone: document.getElementById('editPhone').value,
            game: document.getElementById('editGame').value,
            people: parseInt(document.getElementById('editPeople').value),
            status: document.getElementById('editStatus').value
        };

        if (!updates.date || !updates.time || !updates.userName || !updates.game || !updates.people) {
            alert('Por favor, completá todos los campos');
            return;
        }

        const success = await FirebaseService.updateReservation(window.currentEditId, updates);

        if (success) {
            closeEditModal();
            renderReservations();
            alert('Reserva actualizada correctamente');
        } else {
            alert('Error al actualizar la reserva');
        }
    };

    if (selectAllReservations) {
        selectAllReservations.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.reservation-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
                const reservationId = checkbox.dataset.id;
                if (e.target.checked) {
                    selectedReservations.add(reservationId);
                } else {
                    selectedReservations.delete(reservationId);
                }
            });
            updateDeleteButtonState();
        });
    }

    if (deleteSelectedReservationsBtn) {
        deleteSelectedReservationsBtn.addEventListener('click', async () => {
            if (selectedReservations.size === 0) return;

            if (confirm(`¿Estás seguro de que deseas eliminar las ${selectedReservations.size} reservas seleccionadas?`)) {
                for (const id of selectedReservations) {
                    await FirebaseService.deleteReservation(id);
                }
                selectedReservations.clear();
                if (selectAllReservations) selectAllReservations.checked = false;
                renderReservations();
            }
        });
    }

    function updateDeleteButtonState() {
        if (deleteSelectedReservationsBtn) {
            deleteSelectedReservationsBtn.disabled = selectedReservations.size === 0;
        }
    }

 // --- Calendar Logic ---
let adminDate = new Date();
const adminCalendarGrid = document.getElementById('adminCalendarGrid');
const adminMonthDisplay = document.getElementById('adminMonthDisplay');

const dateManagementPanel = document.getElementById('dateManagementPanel');
const selectedDateDisplay = document.getElementById('selectedDateDisplay');
const toggleBlockBtn = document.getElementById('toggleBlockBtn');
const specialDateName = document.getElementById('specialDateName');
const saveSpecialDateBtn = document.getElementById('saveSpecialDateBtn');
const deleteSpecialDateBtn = document.getElementById('deleteSpecialDateBtn');

let selectedDateString = null;
let cachedBlockedDates = [];
let cachedSpecialDates = {};

// Listeners en tiempo real para fechas
let unsubscribeBlockedDates = FirebaseService.onBlockedDatesChange((dates) => {
    cachedBlockedDates = dates;
    renderAdminCalendar();
});

let unsubscribeSpecialDates = FirebaseService.onSpecialDatesChange((dates) => {
    cachedSpecialDates = dates;
    renderAdminCalendar();
});

document.getElementById('adminPrevMonth').addEventListener('click', () => {
    adminDate.setMonth(adminDate.getMonth() - 1);
    renderAdminCalendar();
});

document.getElementById('adminNextMonth').addEventListener('click', () => {
    adminDate.setMonth(adminDate.getMonth() + 1);
    renderAdminCalendar();
});

function renderAdminCalendar() {
    const year = adminDate.getFullYear();
    const month = adminDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    adminMonthDisplay.textContent = new Intl.DateTimeFormat('es-ES', { 
        month: 'long', 
        year: 'numeric' 
    }).format(adminDate);
    
    adminCalendarGrid.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
        adminCalendarGrid.appendChild(document.createElement('div'));
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const dateString = date.toISOString().split('T')[0];
        const div = document.createElement('div');
        div.className = 'calendar-day';
        div.textContent = i;

        if (cachedBlockedDates.includes(dateString)) {
            div.classList.add('disabled');
            div.style.backgroundColor = '#fee2e2';
            div.style.color = '#ef4444';
        } else if (cachedSpecialDates[dateString]) {
            div.style.backgroundColor = '#dbeafe';
            div.style.color = '#1e40af';
            div.style.fontWeight = 'bold';
            div.title = cachedSpecialDates[dateString];
            const indicator = document.createElement('div');
            indicator.style.fontSize = '0.6rem';
            indicator.textContent = '★';
            div.appendChild(indicator);
        }

        if (selectedDateString === dateString) {
            div.style.border = '2px solid var(--primary)';
        }

        div.addEventListener('click', () => {
            selectDate(dateString, date);
        });

        adminCalendarGrid.appendChild(div);
    }
}

function selectDate(dateString, dateObj) {
    selectedDateString = dateString;

    dateManagementPanel.style.opacity = '1';
    dateManagementPanel.style.pointerEvents = 'auto';

    selectedDateDisplay.textContent = dateObj.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    specialDateName.value = cachedSpecialDates[dateString] || '';

    renderAdminCalendar();
}

toggleBlockBtn.addEventListener('click', async () => {
    if (!selectedDateString) return;
    
    try {
        toggleBlockBtn.disabled = true;
        toggleBlockBtn.textContent = 'Procesando...';
        
        await FirebaseService.toggleBlockDate(selectedDateString);
        
        toggleBlockBtn.disabled = false;
        toggleBlockBtn.textContent = 'Bloquear / Desbloquear';
        
        // No necesitamos renderizar manualmente, el listener lo hará
    } catch (error) {
        console.error('Error al bloquear/desbloquear fecha:', error);
        alert('Error al actualizar la fecha. Intentá de nuevo.');
        toggleBlockBtn.disabled = false;
        toggleBlockBtn.textContent = 'Bloquear / Desbloquear';
    }
});

saveSpecialDateBtn.addEventListener('click', async () => {
    if (!selectedDateString || !specialDateName.value.trim()) {
        alert('Ingresá un nombre para la fecha especial');
        return;
    }
    
    try {
        saveSpecialDateBtn.disabled = true;
        saveSpecialDateBtn.textContent = 'Guardando...';
        
        await FirebaseService.saveSpecialDate(selectedDateString, specialDateName.value.trim());
        
        saveSpecialDateBtn.disabled = false;
        saveSpecialDateBtn.textContent = 'Guardar';
        
        alert('Fecha especial guardada correctamente');
        
        // No necesitamos renderizar manualmente, el listener lo hará
    } catch (error) {
        console.error('Error al guardar fecha especial:', error);
        alert('Error al guardar la fecha especial. Intentá de nuevo.');
        saveSpecialDateBtn.disabled = false;
        saveSpecialDateBtn.textContent = 'Guardar';
    }
});

deleteSpecialDateBtn.addEventListener('click', async () => {
    if (!selectedDateString) return;
    
    if (!confirm('¿Estás seguro de eliminar esta fecha especial?')) return;
    
    try {
        deleteSpecialDateBtn.disabled = true;
        deleteSpecialDateBtn.textContent = 'Eliminando...';
        
        await FirebaseService.deleteSpecialDate(selectedDateString);
        
        specialDateName.value = '';
        deleteSpecialDateBtn.disabled = false;
        deleteSpecialDateBtn.textContent = 'Borrar';
        
        // No necesitamos renderizar manualmente, el listener lo hará
    } catch (error) {
        console.error('Error al eliminar fecha especial:', error);
        alert('Error al eliminar la fecha especial. Intentá de nuevo.');
        deleteSpecialDateBtn.disabled = false;
        deleteSpecialDateBtn.textContent = 'Borrar';
    }
});

// Renderizar calendario inicial
renderAdminCalendar();

    const newsTitle = document.getElementById('newsTitle');
    const newsDesc = document.getElementById('newsDesc');
    const newsImg = document.getElementById('newsImg');
    const adminNewsList = document.getElementById('adminNewsList');

    document.getElementById('addNewsBtn').addEventListener('click', async () => {
        if (!newsTitle.value || !newsDesc.value) return alert('Completá los campos');

        await FirebaseService.addNews({
            title: newsTitle.value,
            description: newsDesc.value,
            image: newsImg.value || 'https://via.placeholder.com/300'
        });

        newsTitle.value = '';
        newsDesc.value = '';
        newsImg.value = '';
        renderAdminNews();
    });

    async function renderAdminNews() {
        const news = await FirebaseService.getNews();
        adminNewsList.innerHTML = news.map(n => `
            <div class="card flex gap-4 p-4 items-center">
                <img src="${n.image}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
                <div style="flex: 1;">
                    <h4 class="font-bold">${n.title}</h4>
                    <p class="text-sm text-muted">${n.description.substring(0, 50)}...</p>
                </div>
                <button class="btn btn-destructive" style="padding: 0.25rem 0.5rem;" onclick="deleteNews('${n.id}')">X</button>
            </div>
        `).join('');
    }

    window.deleteNews = async (id) => {
        if (confirm('¿Borrar novedad?')) {
            await FirebaseService.deleteNews(id);
            renderAdminNews();
        }
    };

    // --- Price Logic ---
    const priceInput = document.getElementById('priceInput');
    const paymentAliasInput = document.getElementById('paymentAlias');

    async function renderPrice() {
        if (!priceInput || !paymentAliasInput) return;

        const currentPrice = await FirebaseService.getPrice();
        priceInput.value = currentPrice;

        const currentAlias = await FirebaseService.getPaymentAlias();
        paymentAliasInput.value = currentAlias;
    }

    const savePriceBtn = document.getElementById('savePriceBtn');
    if (savePriceBtn) {
        savePriceBtn.addEventListener('click', async () => {
            if (!confirm('¿Estás seguro de que deseas actualizar el precio por persona?')) {
                return;
            }

            const newPrice = parseInt(priceInput.value, 10);
            if (isNaN(newPrice) || newPrice <= 0) {
                alert('Ingresá un precio válido mayor a 0');
                return;
            }
            await FirebaseService.setPrice(newPrice);
            showToast('Precio actualizado correctamente', 'success');
        });
    }

    const saveAliasBtn = document.getElementById('saveAliasBtn');
    if (saveAliasBtn) {
        saveAliasBtn.addEventListener('click', async () => {
            if (!confirm('¿Estás seguro de que deseas actualizar el alias de transferencia?')) {
                return;
            }

            const newAlias = paymentAliasInput.value.trim();
            if (!newAlias) {
                showToast('El alias no puede estar vacío', 'error');
                return;
            }
            await FirebaseService.setPaymentAlias(newAlias);
            showToast('Alias actualizado correctamente', 'success');
        });
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg ${type === 'success' ? 'bg-green-500' : 'bg-red-500'
            } text-white`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // --- Time Slots Logic ---
    const timeSlotLabel = document.getElementById('timeSlotLabel');
    const timeSlotActive = document.getElementById('timeSlotActive');
    const adminTimeSlotsList = document.getElementById('adminTimeSlotsList');

    document.getElementById('addTimeSlotBtn').addEventListener('click', async () => {
        const label = (timeSlotLabel.value || '').trim();
        const active = timeSlotActive.checked;
        if (!label) {
            alert('Ingresá un horario válido, por ejemplo 17:00 - 19:00');
            return;
        }

        await FirebaseService.addTimeSlot({ label, active });

        timeSlotLabel.value = '';
        timeSlotActive.checked = true;
        renderTimeSlots();
    });

    async function renderTimeSlots() {
        const timeSlots = await FirebaseService.getTimeSlots();
        if (!adminTimeSlotsList) return;

        if (timeSlots.length === 0) {
            adminTimeSlotsList.innerHTML = '<p class="text-sm text-muted">No hay horarios configurados.</p>';
            return;
        }

        adminTimeSlotsList.innerHTML = timeSlots.map(slot => `
            <div class="card flex items-center justify-between p-4">
                <div>
                    <p class="font-bold">${slot.label}</p>
                    <p class="text-sm ${slot.active ? 'text-green-600' : 'text-muted'}">${slot.active ? 'Activo' : 'Bloqueado'}</p>
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-outline" onclick="toggleTimeSlot('${slot.id}')">${slot.active ? 'Bloquear' : 'Activar'}</button>
                    <button class="btn btn-destructive" onclick="deleteTimeSlot('${slot.id}')">Eliminar</button>
                </div>
            </div>
        `).join('');
    }

    window.toggleTimeSlot = async (id) => {
        await FirebaseService.toggleTimeSlotActive(id);
        renderTimeSlots();
    };

    window.deleteTimeSlot = async (id) => {
        await FirebaseService.deleteTimeSlot(id);
        renderTimeSlots();
    };

    // --- Free Play Tables Logic ---
    const freeTableNumber = document.getElementById('freeTableNumber');
    const freeTableGame = document.getElementById('freeTableGame');
    const freeTableCapacity = document.getElementById('freeTableCapacity');
    const freeTableDate = document.getElementById('freeTableDate');
    const freeTableTimeRange = document.getElementById('freeTableTimeRange');
    const adminFreeTablesList = document.getElementById('adminFreeTablesList');
    const addFreeTableBtn = document.getElementById('addFreeTableBtn');

    const editFreeTableModal = document.getElementById('editFreeTableModal');
    const editFreeTableNumber = document.getElementById('editFreeTableNumber');
    const editFreeTableGame = document.getElementById('editFreeTableGame');
    const editFreeTableCapacity = document.getElementById('editFreeTableCapacity');
    const editFreeTableDate = document.getElementById('editFreeTableDate');
    const editFreeTableTimeRange = document.getElementById('editFreeTableTimeRange');
    let currentFreeTableEditId = null;

    if (addFreeTableBtn) {
        addFreeTableBtn.addEventListener('click', async () => {
            const number = parseInt(freeTableNumber.value, 10);
            const game = (freeTableGame.value || '').trim();
            const capacity = parseInt(freeTableCapacity.value, 10);
            const date = freeTableDate ? freeTableDate.value : '';
            const timeRange = freeTableTimeRange ? (freeTableTimeRange.value || '').trim() : '';

            if (isNaN(number) || number <= 0) {
                alert('Ingresá un número de mesa válido');
                return;
            }
            if (!game) {
                alert('Ingresá el nombre del juego');
                return;
            }
            if (isNaN(capacity) || capacity <= 0) {
                alert('Ingresá una cantidad de cupos válida');
                return;
            }

            await FirebaseService.addFreePlayTable({ number, game, capacity, date: date || null, timeRange: timeRange || null });

            freeTableNumber.value = '';
            freeTableGame.value = '';
            freeTableCapacity.value = '';
            if (freeTableDate) freeTableDate.value = '';
            if (freeTableTimeRange) freeTableTimeRange.value = '';

            renderFreeTablesAdmin();
        });
    }

    async function renderFreeTablesAdmin() {
        if (!adminFreeTablesList) return;

        const tables = await FirebaseService.getFreePlayTables();
        if (!tables.length) {
            adminFreeTablesList.innerHTML = '<p class="text-sm text-muted">No hay mesas configuradas.</p>';
            return;
        }

        adminFreeTablesList.innerHTML = tables.map(t => {
            const playersList = (t.players || []).map(p =>
                p.phone ? `${p.userName} - TEL: ${p.phone}` : p.userName
            ).join(', ');
            const playersText = playersList || 'Sin inscriptos todavía';
            const dateText = t.date ? parseLocalDate(t.date).toLocaleDateString('es-ES') : 'Fecha a definir';
            const timeText = t.timeRange || 'Horario a definir';
            return `
                <div class="card flex items-center justify-between p-4">
                    <div class="w-full">
                        <div class="flex justify-between items-start mb-2">
                            <p class="font-bold">Mesa N° ${t.number} - ${t.game}</p>
                            <span class="text-sm bg-gray-100 px-2 py-1 rounded">${(t.players || []).length}/${t.capacity} cupos</span>
                        </div>
                        <p class="text-sm text-muted mb-2">${dateText} | ${timeText}</p>
                        <div class="bg-gray-50 p-2 rounded text-sm">
                            <p class="font-medium text-sm mb-1">Jugadores:</p>
                            <p class="text-muted">${playersText || 'Ningún jugador anotado'}</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-outline" onclick="editFreeTable('${t.id}')">Editar</button>
                        <button class="btn btn-destructive" onclick="deleteFreeTable('${t.id}')">Eliminar</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.editFreeTable = async (id) => {
        const tables = await FirebaseService.getFreePlayTables();
        const table = tables.find(t => t.id === id);
        if (!table) {
            alert('Mesa no encontrada');
            return;
        }

        if (!editFreeTableModal || !editFreeTableNumber || !editFreeTableGame || !editFreeTableCapacity) {
            alert('No se encontró el modal de edición de mesa. Recargá el admin e intentá de nuevo.');
            return;
        }

        currentFreeTableEditId = id;
        editFreeTableNumber.value = table.number;
        editFreeTableGame.value = table.game;
        editFreeTableCapacity.value = table.capacity;
        if (editFreeTableDate) editFreeTableDate.value = table.date || '';
        if (editFreeTableTimeRange) editFreeTableTimeRange.value = table.timeRange || '';

        editFreeTableModal.classList.add('open');
    };

    window.closeEditFreeTableModal = () => {
        if (!editFreeTableModal) return;
        editFreeTableModal.classList.remove('open');
        currentFreeTableEditId = null;
    };

    window.saveEditFreeTable = async () => {
        if (!currentFreeTableEditId) {
            closeEditFreeTableModal();
            return;
        }

        const number = parseInt(editFreeTableNumber.value, 10);
        const game = (editFreeTableGame.value || '').trim();
        const capacity = parseInt(editFreeTableCapacity.value, 10);
        const date = editFreeTableDate ? editFreeTableDate.value : '';
        const timeRange = editFreeTableTimeRange ? (editFreeTableTimeRange.value || '').trim() : '';

        if (isNaN(number) || number <= 0) {
            alert('Ingresá un número de mesa válido');
            return;
        }
        if (!game) {
            alert('Ingresá el nombre del juego');
            return;
        }
        if (isNaN(capacity) || capacity <= 0) {
            alert('Ingresá una cantidad de cupos válida');
            return;
        }

        const success = await FirebaseService.updateFreePlayTable(currentFreeTableEditId, {
            number,
            game,
            capacity,
            date: date || null,
            timeRange: timeRange || null
        });
        if (!success) {
            alert('No se pudo actualizar la mesa');
            return;
        }

        closeEditFreeTableModal();
        renderFreeTablesAdmin();
    };

    window.deleteFreeTable = async (id) => {
        if (!confirm('¿Eliminar esta mesa? Se borrarán también los jugadores inscriptos.')) return;
        await FirebaseService.deleteFreePlayTable(id);
        renderFreeTablesAdmin();
    };

    // Initial render
    renderReservations();
}