// js/app.js - VERSIÓN UNIFICADA (Opción 1: disponibilidad consultada en Firebase)
import FirebaseService from './firebase-service.js';

let currentUser = null;
let unsubscribeAuth = null;
let unsubscribeReservations = null; // para desuscribirse de cambios
let unsubscribeNews = null;
let unsubscribePrice = null;
let unsubscribeTimeSlots = null;
let unsubscribeFreePlay = null;

// Verificar autenticación al cargar
unsubscribeAuth = FirebaseService.onAuthChange(async (user) => {
    try {
        if (user) {
            currentUser = user;
            const localUser = FirebaseService.getLocalUser();
            if (localUser) {
                document.body.classList.remove('checking-auth');
                initializeApp(localUser);
            } else {
                window.location.href = 'login.html';
            }
        } else {
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Error en verificación de auth:', error);
        window.location.href = 'login.html';
    }
});

async function initializeApp(user) {
    // UI Elements (verifico existencia mínima donde tiene sentido)
    const els = {
        userName: document.getElementById('userName'),
        userAvatar: document.getElementById('userAvatar'),
        logoutBtn: document.getElementById('logoutBtn'),
        historyBtn: document.getElementById('historyBtn'),
        notificationsBtn: document.getElementById('notificationsBtn'),
        notificationsIcon: document.getElementById('notificationsIcon'),
        playFreeBtn: document.getElementById('playFreeBtn'),

        // Calendar
        currentMonthDisplay: document.getElementById('currentMonthDisplay'),
        prevMonthBtn: document.getElementById('prevMonth'),
        nextMonthBtn: document.getElementById('nextMonth'),
        calendarGrid: document.getElementById('calendarGrid'),

        // Time
        timeSlotsContainer: document.getElementById('timeSlotsContainer'),

        // People
        decreasePeople: document.getElementById('decreasePeople'),
        increasePeople: document.getElementById('increasePeople'),
        peopleCount: document.getElementById('peopleCount'),

        // Game
        gameRadios: document.getElementsByName('gameSelection'),
        gameInputContainer: document.getElementById('gameInputContainer'),
        gameNameInput: document.getElementById('gameNameInput'),

        // WhatsApp
        whatsappInput: document.getElementById('whatsappNumber'),

        // Summary
        summaryDate: document.getElementById('summaryDate'),
        summaryTime: document.getElementById('summaryTime'),
        summaryPeople: document.getElementById('summaryPeople'),
        summaryGame: document.getElementById('summaryGame'),
        summaryTotal: document.getElementById('summaryTotal'),
        payBtn: document.getElementById('payBtn'),
        errorMsg: document.getElementById('errorMsg'),

        // News
        newsContainer: document.getElementById('newsContainer'),

        // Reservation modal
        reservationModal: document.getElementById('reservationModal'),
        closeReservationModal: document.getElementById('closeReservationModal'),
        cancelReservationBtn: document.getElementById('cancelReservationBtn'),
        confirmReservationBtn: document.getElementById('confirmReservationBtn'),
        copyAliasBtn: document.getElementById('copyAliasBtn'),
        aliasText: document.getElementById('aliasText'),
        modalDate: document.getElementById('modalDate'),
        modalTime: document.getElementById('modalTime'),
        modalPeople: document.getElementById('modalPeople'),
        modalGame: document.getElementById('modalGame'),
        modalTotal: document.getElementById('modalTotal'),

        // Free play modal
        freePlayModal: document.getElementById('freePlayModal'),
        freePlayTablesContainer: document.getElementById('freePlayTablesContainer'),
        freePlayEmptyState: document.getElementById('freePlayEmptyState'),
        closeFreePlayModal: document.getElementById('closeFreePlayModal')
    };

    // State
    let state = {
        currentDate: new Date(),
        selectedDate: null, // Will store "YYYY-MM-DD" string instead of Date object
        selectedTime: null,
        people: 1,
        gameType: 'decide_later',
        gameName: '',
        phoneNumber: '',
        blockedDates: [], // Se llenará con listener
        specialDates: {}, // Se llenará con listener
        notificationDismissed: false,
        price: 5000
    };

    // Cache de reservas para cálculos de disponibilidad
    let cachedReservations = [];

    // Cargar precio en tiempo real
    unsubscribePrice = FirebaseService.onPriceChange((newPrice) => {
        state.price = newPrice;
        updateSummary();
        // Si el modal de reserva está abierto, actualizar total y texto
        if (els.reservationModal && els.reservationModal.classList.contains('active')) {
            // Podríamos llamar a showReservationModal() de nuevo o actualizar elementos puntuales
            const total = state.price * state.people;
            const formattedTotal = total.toLocaleString('es-AR');
            if (els.modalTotal) els.modalTotal.textContent = `$${formattedTotal}`;
            const transferAmountEl = document.getElementById('modalTransferAmount');
            if (transferAmountEl) transferAmountEl.textContent = `$${formattedTotal}`;
        }
    });

    // Listeners para fechas bloqueadas y especiales
    let unsubscribeBlockedDates = FirebaseService.onBlockedDatesChange((dates) => {
        state.blockedDates = dates;
        renderCalendar();
    });

    let unsubscribeSpecialDates = FirebaseService.onSpecialDatesChange((dates) => {
        state.specialDates = dates;
        renderCalendar();
    });

    // Cargar fechas iniciales
    try {
        state.blockedDates = await FirebaseService.getBlockedDates();
        state.specialDates = await FirebaseService.getSpecialDates();
    } catch (error) {
        console.warn('Error cargando fechas iniciales:', error);
    }

    // Subscripción a cambios de reservas (optimizada)
    unsubscribeReservations = FirebaseService.onReservationsChange(async (reservations) => {
        // Actualizar cache de reservas
        cachedReservations = reservations || [];

        // Solo actualizar time slots si hay una fecha seleccionada
        if (state.selectedDate) {
            renderTimeSlots();
        }
        // actualizar icono de notificaciones también puede ser útil
        updateNotificationsIcon();
    });

    // Cargar reservas inicialmente para poblar el cache ANTES de renderizar
    FirebaseService.getReservations()
        .then(initialReservations => {
            cachedReservations = initialReservations || [];
            console.log('✅ Initial reservations loaded:', cachedReservations.length);
            // Si ya hay una fecha seleccionada, renderizar los slots ahora
            if (state.selectedDate) {
                renderTimeSlots();
            }
        })
        .catch(err => {
            console.warn('⚠️ Error loading initial reservations:', err);
        });


    // Limpiar subscripciones cuando se cierra la página
    window.addEventListener('beforeunload', () => {
        const unsubs = [
            unsubscribeReservations,
            unsubscribeAuth,
            unsubscribeNews,
            unsubscribePrice,
            unsubscribeTimeSlots,
            unsubscribeFreePlay,
            unsubscribeBlockedDates,
            unsubscribeSpecialDates
        ];

        unsubs.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
    });

    // Init UI
    const firstName = (user.name || '').split(' ')[0] || 'Usuario';
    if (els.userName) els.userName.textContent = firstName;

    if (user.photoURL && els.userAvatar) {
        els.userAvatar.style.backgroundImage = `url(${user.photoURL})`;
        els.userAvatar.style.backgroundSize = 'cover';
        els.userAvatar.style.backgroundPosition = 'center';
        els.userAvatar.textContent = '';
    } else if (els.userAvatar) {
        els.userAvatar.textContent = user.avatar || firstName.charAt(0);
    }

    updateNotificationsIcon().catch(err => console.warn(err));
    // Listeners Real-time

    // Cache local para timeSlots (usado por renderTimeSlots)
    let cachedTimeSlots = [];

    unsubscribeTimeSlots = FirebaseService.onTimeSlotsChange((slots) => {
        cachedTimeSlots = slots;
        renderTimeSlots();
    });

    unsubscribeNews = FirebaseService.onNewsChange((news) => {
        renderNews(news);
    });

    unsubscribeFreePlay = FirebaseService.onFreePlayTablesChange((tables) => {
        renderFreePlayTables(tables);
    });

    // renderCalendar ya no necesita ser async ni esperar nada externo por ahora
    renderCalendar();
    // note: renderTimeSlots y renderNews se llaman al recibir data del listener

    // Event Listeners (con defensas por si faltan elementos)
    if (els.logoutBtn) {
        els.logoutBtn.addEventListener('click', async () => {
            await FirebaseService.logout();
            window.location.href = 'login.html';
        });
    }

    if (els.historyBtn) {
        els.historyBtn.addEventListener('click', () => {
            window.location.href = 'history.html';
        });
    }

    if (els.playFreeBtn && els.freePlayModal) {
        els.playFreeBtn.addEventListener('click', () => {
            // Ya se actualiza en tiempo real, solo mostrar el modal
            // El listener onFreePlayTablesChange mantiene la UI actualizada
            els.freePlayModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        if (els.closeFreePlayModal) {
            els.closeFreePlayModal.addEventListener('click', () => {
                els.freePlayModal.classList.remove('active');
                document.body.style.overflow = '';
            });
        }

        els.freePlayModal.addEventListener('click', (e) => {
            if (e.target === els.freePlayModal) {
                els.freePlayModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    if (els.notificationsBtn) {
        els.notificationsBtn.addEventListener('click', async (e) => {
            const dropdown = document.getElementById('notificationsDropdown');
            if (!dropdown) return;

            e.stopPropagation();
            dropdown.classList.toggle('hidden');

            const hasConfirmed = await hasConfirmedReservation();
            const notificationMessage = dropdown.querySelector('.notification-message span:first-child');
            const cardContent = dropdown.querySelector('.card-content');
            const checkIcon = document.getElementById('notificationCheckIcon');

            if (state.notificationDismissed || !hasConfirmed) {
                if (notificationMessage) {
                    notificationMessage.textContent = 'No tenés notificaciones nuevas';
                    notificationMessage.parentElement.style.fontWeight = '400';
                }
                if (cardContent) {
                    cardContent.style.backgroundColor = '#ffffff';
                }
                if (checkIcon) {
                    checkIcon.style.display = 'none';
                }
            } else {
                if (notificationMessage) {
                    notificationMessage.textContent = 'Tu reserva ha sido confirmada!';
                    notificationMessage.parentElement.style.fontWeight = '600';
                }
                if (cardContent) {
                    cardContent.style.backgroundColor = '#F6F7F9';
                }
                if (checkIcon) {
                    checkIcon.style.display = 'inline';
                }
            }
        });
    }

    // Cerrar dropdown si clickean fuera
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notificationsDropdown');
        if (!dropdown || dropdown.classList.contains('hidden')) return;

        const clickInsideDropdown = dropdown.contains(e.target);
        const clickOnButton = els.notificationsBtn && els.notificationsBtn.contains(e.target);

        if (!clickInsideDropdown && !clickOnButton) {
            dropdown.classList.add('hidden');
        }
    });

    const notificationCheckIcon = document.getElementById('notificationCheckIcon');
    if (notificationCheckIcon) {
        notificationCheckIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            state.notificationDismissed = true;

            const notificationMessage = document.querySelector('#notificationsDropdown .notification-message span:first-child');
            const cardContent = document.querySelector('#notificationsDropdown .card-content');
            const dropdown = document.getElementById('notificationsDropdown');

            if (notificationMessage) {
                notificationMessage.textContent = 'No tenés notificaciones nuevas';
                notificationMessage.parentElement.style.fontWeight = '400';
            }
            if (cardContent) {
                cardContent.style.backgroundColor = '#ffffff';
            }
            if (els.notificationsIcon) {
                els.notificationsIcon.textContent = 'notifications';
            }
            notificationCheckIcon.style.display = 'none';
            if (dropdown) {
                dropdown.classList.add('hidden');
            }
        });
    }

    if (els.prevMonthBtn) {
        els.prevMonthBtn.addEventListener('click', () => {
            const today = new Date();
            if (state.currentDate.getMonth() === today.getMonth() && state.currentDate.getFullYear() === today.getFullYear()) {
                return;
            }
            state.currentDate.setMonth(state.currentDate.getMonth() - 1);
            renderCalendar();
        });
    }

    if (els.nextMonthBtn) {
        els.nextMonthBtn.addEventListener('click', () => {
            state.currentDate.setMonth(state.currentDate.getMonth() + 1);
            renderCalendar();
        });
    }

    if (els.timeSlotsContainer) {
        els.timeSlotsContainer.addEventListener('click', (e) => {
            const timeSlot = e.target.closest('.time-slot');
            if (timeSlot) {
                if (timeSlot.classList.contains('unavailable')) {
                    alert('No hay mesas disponibles para este horario. Por favor, elegí otro horario.');
                    return;
                }

                document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
                timeSlot.classList.add('selected');
                state.selectedTime = timeSlot.dataset.time;
                updateSummary();
            }
        });
    }

    if (els.decreasePeople) {
        els.decreasePeople.addEventListener('click', () => {
            if (state.people > 1) {
                state.people--;
                if (els.peopleCount) els.peopleCount.textContent = state.people;
                updateSummary();
            }
        });
    }

    if (els.increasePeople) {
        els.increasePeople.addEventListener('click', () => {
            if (state.people < 6) {
                state.people++;
                if (els.peopleCount) els.peopleCount.textContent = state.people;
                updateSummary();
            }
        });
    }

    if (els.gameRadios && els.gameRadios.length) {
        els.gameRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.gameType = e.target.value;
                if (state.gameType === 'specific') {
                    if (els.gameInputContainer) els.gameInputContainer.classList.remove('hidden');
                } else {
                    if (els.gameInputContainer) els.gameInputContainer.classList.add('hidden');
                    state.gameName = '';
                    if (els.gameNameInput) els.gameNameInput.value = '';
                }
                updateSummary();
            });
        });
    }

    if (els.gameNameInput) {
        els.gameNameInput.addEventListener('input', (e) => {
            state.gameName = e.target.value;
            updateSummary();
        });
    }

    if (els.whatsappInput) {
        els.whatsappInput.addEventListener('input', (e) => {
            let value = e.target.value;
            if (value.startsWith('+')) {
                const rest = value.substring(1).replace(/[^0-9]/g, '');
                value = '+' + rest;
            } else {
                value = value.replace(/[^0-9]/g, '');
            }
            e.target.value = value;
            state.phoneNumber = value;
            updateSummary();
        });
    }

    if (els.payBtn) {
        els.payBtn.addEventListener('click', () => {
            if (!validate()) {
                alert('Por favor completá todos los pasos de la reserva: fecha, horario y juego (si elegiste "Tengo un juego en mente").');
                return;
            }
            showReservationModal();
        });
    }

    if (els.closeReservationModal) {
        els.closeReservationModal.addEventListener('click', closeReservationModal);
    }

    if (els.cancelReservationBtn) {
        els.cancelReservationBtn.addEventListener('click', closeReservationModal);
    }

    if (els.copyAliasBtn) {
        els.copyAliasBtn.addEventListener('click', copyAliasToClipboard);
    }

    if (els.confirmReservationBtn) {
        els.confirmReservationBtn.addEventListener('click', async () => {
            const gameName = state.gameType === 'specific' ? state.gameName : 'A decidir en el local';
            const total = state.price * state.people;

            const dateString = state.selectedDate; // Already a string "YYYY-MM-DD"
            console.log(`🎯 Creating reservation for date: ${dateString}`);

            const reservation = {
                userId: user.uid,
                userName: user.name,
                userEmail: user.email,
                phone: state.phoneNumber,
                date: dateString,
                time: state.selectedTime,
                people: state.people,
                game: gameName,
                total: total,
                status: 'pending_payment'
            };

            console.log(`💾 Reservation object:`, reservation);

            try {
                els.confirmReservationBtn.disabled = true;
                els.confirmReservationBtn.textContent = 'Guardando...';

                await FirebaseService.addReservation(reservation);

                // Forzar actualización de disponibilidad (consulta en Firebase para cada slot)
                await renderTimeSlots();

                closeReservationModal();
                alert('¡Reserva creada con éxito! Pronto nos pondremos en contacto para confirmar el pago.');
                window.location.href = 'history.html';
            } catch (error) {
                console.error('Error al crear reserva:', error);
                alert('Error al crear la reserva. Por favor intentá de nuevo.');
                els.confirmReservationBtn.disabled = false;
                els.confirmReservationBtn.textContent = 'Confirmar Reserva';
            }
        });
    }

    if (els.reservationModal) {
        els.reservationModal.addEventListener('click', (e) => {
            if (e.target === els.reservationModal) {
                closeReservationModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && els.reservationModal && els.reservationModal.style.display === 'flex') {
            closeReservationModal();
        }
    });

    // -----------------------
    // FUNCIONES PRINCIPALES
    // -----------------------

    function getLocalDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const result = `${year}-${month}-${day}`;
        console.log(`📅 getLocalDateString: ${date} -> ${result}`);
        return result;
    }

    // Helper: Parse date string as local date to avoid timezone issues
    function parseLocalDate(dateString) {
        // dateString is "YYYY-MM-DD"
        const [year, month, day] = dateString.split('-').map(Number);
        // month is 1-indexed in string, 0-indexed in Date constructor
        return new Date(year, month - 1, day);
    }

    // Función: Calcular disponibilidad desde cache de reservas
    function calculateSlotAvailability(dateString, timeSlot) {
        const MAX_TABLES = 4;

        console.log(`🔍 Checking availability for ${dateString} at ${timeSlot}`);
        console.log(`📊 Total cached reservations: ${cachedReservations.length}`);

        // Contar reservas para esta fecha y horario (excluyendo rechazadas)
        // AHORA: reservation.date ya es string "YYYY-MM-DD", comparación directa
        const occupiedCount = cachedReservations.filter(reservation => {
            console.log(`  🔎 Checking reservation: date="${reservation.date}" (type: ${typeof reservation.date}), time="${reservation.time}", status="${reservation.status}"`);

            if (reservation.status === 'rejected') {
                console.log(`    ❌ Skipped (rejected)`);
                return false;
            }
            if (reservation.time !== timeSlot) {
                console.log(`    ❌ Skipped (time mismatch: ${reservation.time} !== ${timeSlot})`);
                return false;
            }

            // Comparación directa de strings
            const matches = reservation.date === dateString;
            console.log(`    ${matches ? '✅' : '❌'} Date comparison: "${reservation.date}" === "${dateString}" = ${matches}`);

            if (matches) {
                console.log(`    ✓ MATCH FOUND: ${reservation.userName} - ${reservation.time} - Status: ${reservation.status}`);
            }

            return matches;
        }).length;

        console.log(`📈 Occupied: ${occupiedCount}/${MAX_TABLES} - Available: ${occupiedCount < MAX_TABLES}`);
        return {
            available: occupiedCount < MAX_TABLES,
            spotsLeft: Math.max(0, MAX_TABLES - occupiedCount),
            total: MAX_TABLES
        };
    }

    // Función: renderTimeSlots (usa cachedTimeSlots y verifica disponibilidad)
    function renderTimeSlots() {
        if (!els.timeSlotsContainer) return;

        const timeSlots = cachedTimeSlots || [];
        // Si aún no cargaron, podríamos mostrar un spinner, pero asumimos carga rápida.
        const activeSlots = (timeSlots || []).filter(slot => slot.active);

        if (!activeSlots.length) {
            els.timeSlotsContainer.innerHTML = '<p class="text-sm text-muted">No hay horarios disponibles. Consultá con el local.</p>';
            return;
        }

        els.timeSlotsContainer.innerHTML = '';

        for (const slot of activeSlots) {
            const div = document.createElement('div');
            div.className = 'time-slot';
            div.dataset.time = slot.label;

            const timeLabel = document.createElement('div');
            timeLabel.className = 'font-medium';
            timeLabel.textContent = slot.label;
            div.appendChild(timeLabel);

            if (state.selectedDate) {
                const dateString = state.selectedDate; // Already a string "YYYY-MM-DD"
                try {
                    // Calcular disponibilidad desde cache de reservas
                    const availability = calculateSlotAvailability(dateString, slot.label);
                    const availabilityEl = document.createElement('div');
                    availabilityEl.className = `availability ${availability.available ? 'available' : 'unavailable'}`;
                    availabilityEl.textContent = availability.available
                        ? `${availability.spotsLeft} mesa${availability.spotsLeft !== 1 ? 's' : ''} disponible${availability.spotsLeft !== 1 ? 's' : ''}`
                        : 'Cupos llenos';
                    div.appendChild(availabilityEl);

                    if (!availability.available) {
                        div.classList.add('unavailable');
                    }
                } catch (err) {
                    console.error('Error comprobando disponibilidad:', err);
                    const availabilityEl = document.createElement('div');
                    availabilityEl.className = 'availability unavailable';
                    availabilityEl.textContent = 'Error al comprobar disponibilidad';
                    div.appendChild(availabilityEl);
                    div.classList.add('unavailable');
                }
            }

            // Mantener la selección si este slot está seleccionado
            if (state.selectedTime === slot.label) {
                div.classList.add('selected');
            }

            els.timeSlotsContainer.appendChild(div);
        }
    }

    // Función: renderCalendar (similar a la versión consolidada)
    function renderCalendar() {
        if (!els.calendarGrid || !els.currentMonthDisplay) return;

        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        els.currentMonthDisplay.textContent = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(state.currentDate);

        els.calendarGrid.innerHTML = '';

        for (let i = 0; i < startingDay; i++) {
            const div = document.createElement('div');
            els.calendarGrid.appendChild(div);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dayOfWeek = date.getDay();
            const dateString = date.toISOString().split('T')[0];

            const div = document.createElement('div');
            div.className = 'calendar-day';
            div.textContent = i;

            // Reglas: se consideran "no laborables" por ejemplo 0,4,5,6 en la versión original.
            // Mantengo la lógica de código1: [0,4,5,6] como no habilitados.
            const isWeekend = [0, 4, 5, 6].includes(dayOfWeek);
            const isPast = date < today;
            const isBlocked = state.blockedDates.includes(dateString);
            // specialDates es un objeto en codigo1 (mapa) o array en codigo2; trato ambas opciones:
            let specialDateName = null;
            if (state.specialDates) {
                if (Array.isArray(state.specialDates)) {
                    const found = state.specialDates.find(sd => sd.date === dateString);
                    specialDateName = found ? found.name : null;
                } else {
                    specialDateName = state.specialDates[dateString] || null;
                }
            }

            if (!isWeekend || isPast || isBlocked) {
                div.classList.add('disabled');
            } else {
                if (specialDateName) {
                    div.style.backgroundColor = '#dbeafe';
                    div.style.color = '#1e40af';
                    div.style.fontWeight = 'bold';
                    div.title = specialDateName;

                    const indicator = document.createElement('div');
                    indicator.style.fontSize = '0.6rem';
                    indicator.textContent = '★';
                    div.appendChild(indicator);
                }

                div.addEventListener('click', async () => {
                    document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
                    div.classList.add('selected');

                    console.log(`🗓️ Calendar day clicked: ${i}`);
                    console.log(`🗓️ Creating date with: year=${year}, month=${month}, day=${i}`);
                    state.selectedDate = getLocalDateString(date); // Store as string
                    console.log(`🗓️ Selected date string:`, state.selectedDate);

                    // Limpiar selección de horario cuando se cambia de fecha
                    state.selectedTime = null;
                    document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));

                    const specialDateInfoEl = document.getElementById('specialDateInfo');
                    if (specialDateInfoEl) {
                        if (specialDateName) {
                            specialDateInfoEl.textContent = `★ ${specialDateName}`;
                            specialDateInfoEl.style.display = 'block';
                        } else {
                            specialDateInfoEl.style.display = 'none';
                        }
                    }

                    updateSummary();
                    renderTimeSlots(); // Renderizar con disponibilidad actualizada
                });
            }

            if (state.selectedDate && getLocalDateString(date) === state.selectedDate) {
                div.classList.add('selected');
            }

            els.calendarGrid.appendChild(div);
        }
    }

    function updateSummary() {
        if (els.summaryDate) {
            if (state.selectedDate) {
                const selectedDateObj = parseLocalDate(state.selectedDate);
                els.summaryDate.textContent = selectedDateObj.toLocaleDateString('es-ES');
            } else {
                els.summaryDate.textContent = '--/--/----';
            }
        }

        if (els.summaryTime) els.summaryTime.textContent = state.selectedTime || '--:--';
        if (els.summaryPeople) els.summaryPeople.textContent = state.people;

        if (els.summaryGame) {
            if (state.gameType === 'specific' && state.gameName) {
                els.summaryGame.textContent = state.gameName;
            } else if (state.gameType === 'specific') {
                els.summaryGame.textContent = '...';
            } else {
                els.summaryGame.textContent = 'A decidir en el local';
            }
        }

        const total = state.price * state.people;
        if (els.summaryTotal) {
            els.summaryTotal.textContent = `$${total}`;
        }

        validate(true);
    }

    function validate(silent = false) {
        let isValid = true;
        let error = '';

        if (!state.selectedDate) {
            isValid = false;
            error = 'Seleccioná una fecha';
        } else if (!state.selectedTime) {
            isValid = false;
            error = 'Seleccioná un horario';
        } else if (state.gameType === 'specific' && !state.gameName.trim()) {
            isValid = false;
            error = 'Ingresá el nombre del juego';
        } else if (!state.phoneNumber || !/^\+?[0-9\s-]+$/.test(state.phoneNumber)) {
            isValid = false;
            error = 'Ingresá un número de teléfono válido';
        }

        if (!silent && !isValid && els.errorMsg) {
            els.errorMsg.textContent = error;
            els.errorMsg.classList.remove('hidden');
        } else if (els.errorMsg) {
            els.errorMsg.classList.add('hidden');
        }

        return isValid;
    }

    async function showReservationModal() {
        const total = state.price * state.people;
        const gameName = state.gameType === 'specific' ? state.gameName : 'A decidir en el local';

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const selectedDateObj = parseLocalDate(state.selectedDate);
        const formattedDate = selectedDateObj.toLocaleDateString('es-AR', options);

        if (els.modalDate) els.modalDate.textContent = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
        if (els.modalTime) els.modalTime.textContent = state.selectedTime;
        if (els.modalPeople) els.modalPeople.textContent = state.people;
        if (els.modalGame) els.modalGame.textContent = gameName;

        const formattedTotal = total.toLocaleString('es-AR');
        if (els.modalTotal) els.modalTotal.textContent = `$${formattedTotal}`;

        const transferAmountEl = document.getElementById('modalTransferAmount');
        if (transferAmountEl) {
            transferAmountEl.textContent = `$${formattedTotal}`;
        }

        try {
            const paymentAlias = await FirebaseService.getPaymentAlias();
            if (els.aliasText && paymentAlias) {
                els.aliasText.textContent = paymentAlias;
            }
        } catch (err) {
            console.warn('No se pudo obtener alias de pago', err);
        }

        if (els.reservationModal) {
            els.reservationModal.style.display = 'flex';
            setTimeout(() => {
                els.reservationModal.classList.add('active');
            }, 10);
        }
    }

    function closeReservationModal() {
        if (!els.reservationModal) return;
        els.reservationModal.classList.remove('active');
        setTimeout(() => {
            els.reservationModal.style.display = 'none';
            if (els.confirmReservationBtn) {
                els.confirmReservationBtn.disabled = false;
                els.confirmReservationBtn.textContent = 'Confirmar Reserva';
            }
        }, 300);
    }

    function copyAliasToClipboard() {
        if (!els.aliasText) return;
        const aliasText = els.aliasText.textContent;
        navigator.clipboard.writeText(aliasText).then(() => {
            if (!els.copyAliasBtn) return;
            const icon = els.copyAliasBtn.querySelector('.material-symbols-outlined');
            if (icon) {
                const originalText = icon.textContent;
                icon.textContent = 'check';
                els.copyAliasBtn.setAttribute('title', '¡Copiado!');

                setTimeout(() => {
                    icon.textContent = originalText;
                    els.copyAliasBtn.setAttribute('title', 'Copiar alias');
                }, 2000);
            }
        }).catch(err => {
            console.error('Error al copiar el alias:', err);
            alert('No se pudo copiar el alias. Por favor, cópialo manualmente.');
        });
    }

    async function hasConfirmedReservation() {
        if (state.notificationDismissed) {
            return false;
        }
        try {
            const reservations = await FirebaseService.getReservations();
            return (reservations || []).some(r => r.userId === user.uid && r.status === 'confirmed');
        } catch (err) {
            console.warn('No se pudieron obtener reservas para notificaciones', err);
            return false;
        }
    }

    async function updateNotificationsIcon() {
        if (!els.notificationsIcon) return;
        const hasConfirmed = await hasConfirmedReservation();
        els.notificationsIcon.textContent = hasConfirmed ? 'notifications_unread' : 'notifications';
    }

    // renderNews (recibe noticias del listener)
    function renderNews(news) {
        // const news = await FirebaseService.getNews(); // eliminado
        if (!els.newsContainer) return;

        if (!news || news.length === 0) {
            els.newsContainer.innerHTML = '<p class="text-muted">No hay novedades.</p>';
            return;
        }

        if (!document.getElementById('newsModal')) {
            const modalHtml = `
                <div id="newsModal" class="modal-overlay">
                    <div class="modal-content">
                        <button class="modal-close">&times;</button>
                        <h3 id="modalTitle" class="font-bold text-xl mb-4"></h3>
                        <img id="modalImage" src="" style="width:100%; height:200px; object-fit:cover; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <p id="modalDesc" class="text-muted"></p>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            const modal = document.getElementById('newsModal');
            modal.querySelector('.modal-close').addEventListener('click', () => {
                modal.classList.remove('open');
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('open');
            });
        }

        let currentIndex = 0;
        let intervalId;

        function showNews(index) {
            const item = news[index];

            const dotsHtml = news.map((_, i) =>
                `<div class="carousel-dot ${i === index ? 'active' : ''}" data-index="${i}"></div>`
            ).join('');

            const isLong = item.description.length > 100;
            const descHtml = isLong
                ? `<p class="text-muted text-sm news-desc-clamp">${item.description}</p>
                   <span class="read-more-link" data-index="${index}">Leer más</span>`
                : `<p class="text-muted text-sm">${item.description}</p>`;

            els.newsContainer.innerHTML = `
                <div class="carousel-container">
                    <div class="card news-card fade-in">
                        <img src="${item.image}" alt="${item.title}">
                        <div class="card-content mt-4">
                            <h3 class="font-bold text-lg mb-2">${item.title}</h3>
                            ${descHtml}
                        </div>
                    </div>
                </div>
                <div class="carousel-controls">
                    <button class="carousel-btn" id="prevNews">&lt;</button>
                    <div class="carousel-dots">
                        ${dotsHtml}
                    </div>
                    <button class="carousel-btn" id="nextNews">&gt;</button>
                </div>
            `;

            const prevBtn = document.getElementById('prevNews');
            const nextBtn = document.getElementById('nextNews');

            if (prevBtn) prevBtn.addEventListener('click', () => {
                stopAutoPlay();
                currentIndex = (currentIndex - 1 + news.length) % news.length;
                showNews(currentIndex);
            });

            if (nextBtn) nextBtn.addEventListener('click', () => {
                stopAutoPlay();
                currentIndex = (currentIndex + 1) % news.length;
                showNews(currentIndex);
            });

            document.querySelectorAll('.carousel-dot').forEach(dot => {
                dot.addEventListener('click', (e) => {
                    stopAutoPlay();
                    currentIndex = parseInt(e.target.dataset.index);
                    showNews(currentIndex);
                });
            });

            const readMoreBtn = els.newsContainer.querySelector('.read-more-link');
            if (readMoreBtn) {
                readMoreBtn.addEventListener('click', () => {
                    stopAutoPlay();
                    openModal(news[index]);
                });
            }
        }

        function openModal(item) {
            const modal = document.getElementById('newsModal');
            document.getElementById('modalTitle').textContent = item.title;
            document.getElementById('modalImage').src = item.image;
            document.getElementById('modalDesc').textContent = item.description;
            modal.classList.add('open');
        }

        function startAutoPlay() {
            intervalId = setInterval(() => {
                currentIndex = (currentIndex + 1) % news.length;
                showNews(currentIndex);
            }, 5000);
        }

        function stopAutoPlay() {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }

        showNews(currentIndex);
        startAutoPlay();
    }

    // renderFreePlayTables (recibe tables del listener)
    function renderFreePlayTables(tables) {
        if (!els.freePlayTablesContainer || !els.freePlayEmptyState) return;
        try {
            // const tables = ... // eliminado, viene por argumento

            if (!tables || tables.length === 0) {
                els.freePlayTablesContainer.style.display = 'none';
                els.freePlayEmptyState.style.display = 'block';
                return;
            }

            els.freePlayEmptyState.style.display = 'none';
            els.freePlayTablesContainer.style.display = 'grid';
            els.freePlayTablesContainer.innerHTML = '';

            tables.forEach(table => {
                const card = document.createElement('div');
                card.className = 'card';

                const content = document.createElement('div');
                content.className = 'card-content';

                const title = document.createElement('h3');
                title.className = 'text-lg font-semibold mb-2';
                title.textContent = `Mesa ${table.number || table.id || ''}`.trim();
                content.appendChild(title);

                const status = document.createElement('p');
                status.className = 'text-sm';
                status.innerHTML = `<span class="availability available">Disponible para juego libre</span>`;
                content.appendChild(status);

                if (table.currentGame) {
                    const game = document.createElement('p');
                    game.className = 'text-sm text-muted mt-2';
                    game.textContent = `Juego actual: ${table.currentGame}`;
                    content.appendChild(game);
                }

                card.appendChild(content);
                els.freePlayTablesContainer.appendChild(card);
            });
        } catch (error) {
            console.error('Error renderizando mesas libres:', error);
            els.freePlayEmptyState.style.display = 'block';
            els.freePlayTablesContainer.style.display = 'none';
        }
    }

    // -----------------------
    // FIN FUNCIONES
    // -----------------------

} // FIN initializeApp

// Nota: si querés asegurar que la app cierre correctamente la suscripción si el usuario sale por navegación SPA,
// podés agregar lógica adicional. Por ahora se maneja beforeunload y el unsubscribe que provee FirebaseService.
