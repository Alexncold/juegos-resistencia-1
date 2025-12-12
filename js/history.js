// js/history.js - VERSIÓN FIREBASE
import FirebaseService from './firebase-service.js';

let currentUser = null;

FirebaseService.onAuthChange(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = FirebaseService.getLocalUser();
    if (currentUser) {
        await initializeHistory();
    }
});

// Helper: Parse date string as local date to avoid timezone issues
function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}


async function initializeHistory() {
    const els = {
        backToHome: document.getElementById('backToHome'),
        tableBody: document.getElementById('userHistoryBody'),
        emptyMsg: document.getElementById('historyEmpty'),
    };

    els.backToHome.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Obtener solo las reservas del usuario actual, filtrando en el servidor
    const userReservations = await FirebaseService.getReservations(currentUser.uid);

    // Ordenar por fecha (más reciente primero)
    userReservations.sort((a, b) => {
        const da = new Date(a.date || a.createdAt);
        const db = new Date(b.date || b.createdAt);
        return db - da;
    });

    if (!userReservations.length) {
        els.emptyMsg.style.display = 'block';
        return;
    }

    els.emptyMsg.style.display = 'none';

    userReservations.forEach(res => {
        const tr = document.createElement('tr');

        const date = res.date ? parseLocalDate(res.date) : null;
        const dateText = date ? date.toLocaleDateString('es-ES') : '-';

        const timeText = res.time || '-';
        const peopleText = typeof res.people === 'number' ? String(res.people) : '-';
        const gameText = res.game || '-';
        const totalText = typeof res.total === 'number' ? `$${res.total}` : '-';

        let statusClass = 'status-pending';
        let statusLabel = 'Pendiente';

        if (res.status === 'confirmed') {
            statusClass = 'status-confirmed';
            statusLabel = 'Aceptado';
        } else if (res.status === 'pending_payment' || res.status === 'pending') {
            statusClass = 'status-pending';
            statusLabel = 'Pendiente de pago';
        } else if (res.status === 'rejected') {
            statusClass = 'status-rejected';
            statusLabel = 'Rechazado';
        }

        tr.innerHTML = `
            <td>${dateText}</td>
            <td>${timeText}</td>
            <td>${peopleText}</td>
            <td>${gameText}</td>
            <td>${totalText}</td>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        `;

        els.tableBody.appendChild(tr);
    });
}