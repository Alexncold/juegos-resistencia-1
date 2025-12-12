// js/firebase-service.js
import { auth, db } from './firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const FirebaseService = {
  // ============================================
  // AUTENTICACIÓN
  // ============================================

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Guardar info básica en localStorage para UI rápida
      const userData = {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        photoURL: user.photoURL,
        avatar: user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'
      };
      localStorage.setItem('user', JSON.stringify(userData));

      return userData;
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  },

  async loginWithEmailAndPassword(email, password) {
    try {
      const result = await firebaseSignInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      // Guardar info básica en localStorage
      const userData = {
        uid: user.uid,
        email: user.email,
        name: user.email.split('@')[0], // Usar parte del email como nombre
        photoURL: null,
        avatar: email.charAt(0).toUpperCase()
      };
      localStorage.setItem('user', JSON.stringify(userData));

      return userData;
    } catch (error) {
      console.error('Error en login con email/password:', error);
      throw error;
    }
  },

  async logout() {
    try {
      await signOut(auth);
      localStorage.removeItem('user');
      localStorage.removeItem('isAdmin');
    } catch (error) {
      console.error('Error en logout:', error);
      throw error;
    }
  },

  getCurrentUser() {
    return auth.currentUser;
  },

  getLocalUser() {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  },

  onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
  },

  // ============================================
  // ADMIN
  // ============================================

  async checkIfAdmin(userEmail) {
    try {
      const adminDoc = await getDoc(doc(db, 'admins', userEmail));
      const isAdmin = adminDoc.exists() && adminDoc.data().isActive === true;
      localStorage.setItem('isAdmin', isAdmin.toString());
      return isAdmin;
    } catch (error) {
      console.error('Error verificando admin:', error);
      return false;
    }
  },

  isAdminLocal() {
    return localStorage.getItem('isAdmin') === 'true';
  },

  // ============================================
  // RESERVAS
  // ============================================

  async addReservation(reservation) {
    try {
      // IMPORTANTE: Guardar la fecha como string para evitar conversión de timezone
      // La fecha ya viene en formato "YYYY-MM-DD" desde app.js
      const docRef = await addDoc(collection(db, 'reservations'), {
        ...reservation,
        date: reservation.date, // Ya es string "YYYY-MM-DD"
        pricePerPerson: reservation.pricePerPerson, // NUEVO: precio histórico
        total: reservation.total, // Total ya calculado
        createdAt: Timestamp.now(),
        status: reservation.status || 'pending_payment'
      });

      return {
        id: docRef.id,
        ...reservation
      };
    } catch (error) {
      console.error('Error agregando reserva:', error);
      throw error;
    }
  },

  async getReservations(userId = null) {
    try {
      let q = collection(db, 'reservations');

      if (userId) {
        q = query(q, where('userId', '==', userId));
      }

      const querySnapshot = await getDocs(q);
      const reservations = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        // Normalize date to string format to handle both old (Timestamp) and new (string) formats
        let normalizedDate = data.date;
        if (data.date?.toDate) {
          // Old format: Timestamp - convert to YYYY-MM-DD string
          const dateObj = data.date.toDate();
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          normalizedDate = `${year}-${month}-${day}`;
        }

        reservations.push({
          id: doc.id,
          ...data,
          date: normalizedDate, // Always a string "YYYY-MM-DD"
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
        });
      });

      return reservations;
    } catch (error) {
      console.error('Error obteniendo reservas:', error);
      throw error;
    }
  },

  async updateReservation(id, updates) {
    try {
      const docRef = doc(db, 'reservations', id);

      // Si hay fecha en updates, convertirla a Timestamp
      if (updates.date) {
        updates.date = Timestamp.fromDate(new Date(updates.date));
      }

      await updateDoc(docRef, updates);
      return true;
    } catch (error) {
      console.error('Error actualizando reserva:', error);
      return false;
    }
  },

  async deleteReservation(id) {
    try {
      await deleteDoc(doc(db, 'reservations', id));
      return true;
    } catch (error) {
      console.error('Error eliminando reserva:', error);
      return false;
    }
  },

  // ============================================
  // 🔥 LISTENER EN TIEMPO REAL
  // ============================================
  onReservationsChange(callback) {
    try {
      const q = query(
        collection(db, 'reservations'),
        orderBy('createdAt', 'desc')
      );

      return onSnapshot(q, (snapshot) => {
        const reservations = [];

        snapshot.forEach((doc) => {
          const data = doc.data();

          // Normalize date to string format to handle both old (Timestamp) and new (string) formats
          let normalizedDate = data.date;
          if (data.date?.toDate) {
            // Old format: Timestamp - convert to YYYY-MM-DD string
            const dateObj = data.date.toDate();
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            normalizedDate = `${year}-${month}-${day}`;
          }

          reservations.push({
            id: doc.id,
            ...data,
            date: normalizedDate, // Always a string "YYYY-MM-DD"
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
          });
        });

        callback(reservations);
      }, (error) => {
        console.error('Error en listener de reservas:', error);
      });
    } catch (error) {
      console.error('Error configurando listener:', error);
      return () => { }; // Retornar función vacía en caso de error
    }
  },

  // ============================================
  // DISPONIBILIDAD DE HORARIOS
  // ============================================
  async getSlotOccupancy(dateString, timeSlot) {
    try {
      // dateString ya viene como "YYYY-MM-DD"
      const normalizedDate = dateString.split('T')[0];

      // Ahora date es string, así que comparamos directamente
      const q = query(
        collection(db, 'reservations'),
        where('date', '==', normalizedDate),
        where('time', '==', timeSlot)
      );

      const snapshot = await getDocs(q);

      // Filtrar reservas rechazadas en memoria
      let occupiedCount = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status !== 'rejected') {
          occupiedCount++;
        }
      });

      return occupiedCount;
    } catch (error) {
      console.error('Error obteniendo ocupación:', error);
      return 0;
    }
  },

  async checkSlotAvailability(dateString, timeSlot) {
    try {
      const occupied = await this.getSlotOccupancy(dateString, timeSlot);
      const MAX_TABLES = 4;
      return {
        available: occupied < MAX_TABLES,
        spotsLeft: Math.max(0, MAX_TABLES - occupied),
        total: MAX_TABLES
      };
    } catch (error) {
      console.error('Error verificando disponibilidad:', error);
      return {
        available: false,
        spotsLeft: 0,
        total: 4
      };
    }
  },

  // ============================================
  // NOTICIAS
  // ============================================

  async getNews() {
    try {
      const q = query(
        collection(db, 'news'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const news = [];

      querySnapshot.forEach((doc) => {
        news.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return news;
    } catch (error) {
      console.error('Error obteniendo noticias:', error);
      return [];
    }
  },

  async addNews(newsItem) {
    try {
      const docRef = await addDoc(collection(db, 'news'), {
        ...newsItem,
        isActive: true,
        createdAt: Timestamp.now()
      });

      return { id: docRef.id, ...newsItem };
    } catch (error) {
      console.error('Error agregando noticia:', error);
      throw error;
    }
  },

  async deleteNews(id) {
    try {
      await deleteDoc(doc(db, 'news', id));
      return true;
    } catch (error) {
      console.error('Error eliminando noticia:', error);
      return false;
    }
  },

  onNewsChange(callback) {
    try {
      const q = query(
        collection(db, 'news'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );

      return onSnapshot(q, (snapshot) => {
        const news = [];
        snapshot.forEach((doc) => {
          news.push({
            id: doc.id,
            ...doc.data()
          });
        });
        callback(news);
      }, (error) => {
        console.error('Error en listener de noticias:', error);
      });
    } catch (error) {
      console.error('Error configurando listener de noticias:', error);
      return () => { };
    }
  },

  // ============================================
  // CONFIGURACIONES
  // ============================================

  async getPrice() {
    try {
      const docRef = doc(db, 'settings', 'price');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data().value;
      }
      return 5000; // Default
    } catch (error) {
      console.error('Error obteniendo precio:', error);
      return 5000;
    }
  },

  async setPrice(value) {
    try {
      const docRef = doc(db, 'settings', 'price');
      await setDoc(docRef, {
        value: parseInt(value),
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      console.error('Error guardando precio:', error);
      return false;
    }
  },

  async getPaymentAlias() {
    try {
      const docRef = doc(db, 'settings', 'paymentAlias');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data().value;
      }
      return 'ALIAS.DE.EJEMPLO';
    } catch (error) {
      console.error('Error obteniendo alias:', error);
      return 'ALIAS.DE.EJEMPLO';
    }
  },

  async setPaymentAlias(alias) {
    try {
      const docRef = doc(db, 'settings', 'paymentAlias');
      await setDoc(docRef, {
        value: alias.trim(),
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      console.error('Error guardando alias:', error);
      return false;
    }
  },

  onPriceChange(callback) {
    try {
      const docRef = doc(db, 'settings', 'price');
      return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data().value);
        } else {
          callback(5000); // Default fallback
        }
      }, (error) => {
        console.error('Error en listener de precio:', error);
      });
    } catch (error) {
      console.error('Error configurando listener de precio:', error);
      return () => { };
    }
  },

  // ============================================
  // TIME SLOTS
  // ============================================

  async getTimeSlots() {
    try {
      const querySnapshot = await getDocs(collection(db, 'timeSlots'));
      const slots = [];

      querySnapshot.forEach((doc) => {
        slots.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Ordenar por 'order'
      return slots.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      console.error('Error obteniendo horarios:', error);
      return [];
    }
  },

  async addTimeSlot(slot) {
    try {
      // Obtener el máximo order actual
      const slots = await this.getTimeSlots();
      const maxOrder = Math.max(...slots.map(s => s.order || 0), 0);

      const docRef = await addDoc(collection(db, 'timeSlots'), {
        label: slot.label,
        active: slot.active !== false,
        order: maxOrder + 1
      });

      return { id: docRef.id, ...slot };
    } catch (error) {
      console.error('Error agregando horario:', error);
      throw error;
    }
  },

  async toggleTimeSlotActive(id) {
    try {
      const docRef = doc(db, 'timeSlots', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const currentActive = docSnap.data().active;
        await updateDoc(docRef, { active: !currentActive });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error actualizando horario:', error);
      return false;
    }
  },

  async deleteTimeSlot(id) {
    try {
      await deleteDoc(doc(db, 'timeSlots', id));
      return true;
    } catch (error) {
      console.error('Error eliminando horario:', error);
      return false;
    }
  },

  onTimeSlotsChange(callback) {
    try {
      const q = collection(db, 'timeSlots');
      return onSnapshot(q, (snapshot) => {
        const slots = [];
        snapshot.forEach((doc) => {
          slots.push({
            id: doc.id,
            ...doc.data()
          });
        });
        // Ordenar
        const sortedSlots = slots.sort((a, b) => (a.order || 0) - (b.order || 0));
        callback(sortedSlots);
      }, (error) => {
        console.error('Error en listener de horarios:', error);
      });
    } catch (error) {
      console.error('Error configurando listener de horarios:', error);
      return () => { };
    }
  },

  // ============================================
  // FREE PLAY TABLES
  // ============================================

  async getFreePlayTables() {
    try {
      const querySnapshot = await getDocs(collection(db, 'freePlayTables'));
      const tables = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        tables.push({
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate().toISOString() : data.date
        });
      });

      return tables;
    } catch (error) {
      console.error('Error obteniendo mesas:', error);
      return [];
    }
  },

  async addFreePlayTable(table) {
    try {
      const docData = {
        number: table.number,
        game: table.game,
        capacity: table.capacity,
        date: table.date ? Timestamp.fromDate(new Date(table.date)) : null,
        timeRange: table.timeRange || null,
        players: []
      };

      const docRef = await addDoc(collection(db, 'freePlayTables'), docData);
      return { id: docRef.id, ...table, players: [] };
    } catch (error) {
      console.error('Error agregando mesa:', error);
      throw error;
    }
  },

  async updateFreePlayTable(id, updates) {
    try {
      const docRef = doc(db, 'freePlayTables', id);

      if (updates.date) {
        updates.date = Timestamp.fromDate(new Date(updates.date));
      }

      await updateDoc(docRef, updates);
      return true;
    } catch (error) {
      console.error('Error actualizando mesa:', error);
      return false;
    }
  },

  async deleteFreePlayTable(id) {
    try {
      await deleteDoc(doc(db, 'freePlayTables', id));
      return true;
    } catch (error) {
      console.error('Error eliminando mesa:', error);
      return false;
    }
  },

  onFreePlayTablesChange(callback) {
    try {
      const q = collection(db, 'freePlayTables');
      return onSnapshot(q, (snapshot) => {
        const tables = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          tables.push({
            id: doc.id,
            ...data,
            date: data.date?.toDate ? data.date.toDate().toISOString() : data.date
          });
        });
        callback(tables);
      }, (error) => {
        console.error('Error en listener de mesas libres:', error);
      });
    } catch (error) {
      console.error('Error configurando listener de mesas libres:', error);
      return () => { };
    }
  },

  async addPlayerToFreePlayTable(tableId, user, phoneNumber) {
    try {
      const docRef = doc(db, 'freePlayTables', tableId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return { success: false, error: 'Mesa no encontrada' };
      }

      const table = docSnap.data();
      const players = table.players || [];

      // Verificar si ya está anotado
      if (players.some(p => p.userId === user.uid)) {
        return { success: false, error: 'Ya estás anotado en esta mesa' };
      }

      // Verificar capacidad
      if (players.length >= table.capacity) {
        return { success: false, error: 'La mesa ya está completa' };
      }

      // Agregar jugador
      players.push({
        userId: user.uid,
        userName: user.name,
        phone: phoneNumber
      });

      await updateDoc(docRef, { players });
      return { success: true };
    } catch (error) {
      console.error('Error agregando jugador:', error);
      return { success: false, error: 'Error al anotarse' };
    }
  },

  async removePlayerFromFreePlayTable(tableId, userId) {
    try {
      const docRef = doc(db, 'freePlayTables', tableId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return false;
      }

      const table = docSnap.data();
      const players = (table.players || []).filter(p => p.userId !== userId);

      await updateDoc(docRef, { players });
      return true;
    } catch (error) {
      console.error('Error removiendo jugador:', error);
      return false;
    }
  },

  // ============================================
  // FECHAS BLOQUEADAS Y ESPECIALES (FIREBASE)
  // ============================================

  async getBlockedDates() {
    try {
      const docRef = doc(db, 'settings', 'blockedDates');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data().dates || [];
      }
      return [];
    } catch (error) {
      console.error('Error obteniendo fechas bloqueadas:', error);
      return [];
    }
  },

  async toggleBlockDate(dateString) {
    try {
      const docRef = doc(db, 'settings', 'blockedDates');
      const docSnap = await getDoc(docRef);
      
      let blocked = [];
      if (docSnap.exists()) {
        blocked = docSnap.data().dates || [];
      }
      
      if (blocked.includes(dateString)) {
        blocked = blocked.filter(d => d !== dateString);
      } else {
        blocked.push(dateString);
      }
      
      await setDoc(docRef, {
        dates: blocked,
        updatedAt: Timestamp.now()
      });
      
      return blocked;
    } catch (error) {
      console.error('Error actualizando fechas bloqueadas:', error);
      throw error;
    }
  },

  async getSpecialDates() {
    try {
      const docRef = doc(db, 'settings', 'specialDates');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data().dates || {};
      }
      return {};
    } catch (error) {
      console.error('Error obteniendo fechas especiales:', error);
      return {};
    }
  },

  async saveSpecialDate(dateString, name) {
    try {
      const docRef = doc(db, 'settings', 'specialDates');
      const docSnap = await getDoc(docRef);
      
      let specialDates = {};
      if (docSnap.exists()) {
        specialDates = docSnap.data().dates || {};
      }
      
      specialDates[dateString] = name;
      
      await setDoc(docRef, {
        dates: specialDates,
        updatedAt: Timestamp.now()
      });
      
      return true;
    } catch (error) {
      console.error('Error guardando fecha especial:', error);
      throw error;
    }
  },

  async deleteSpecialDate(dateString) {
    try {
      const docRef = doc(db, 'settings', 'specialDates');
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return true;
      
      const specialDates = docSnap.data().dates || {};
      delete specialDates[dateString];
      
      await setDoc(docRef, {
        dates: specialDates,
        updatedAt: Timestamp.now()
      });
      
      return true;
    } catch (error) {
      console.error('Error eliminando fecha especial:', error);
      throw error;
    }
  },

  // Listeners en tiempo real para fechas
  onBlockedDatesChange(callback) {
    try {
      const docRef = doc(db, 'settings', 'blockedDates');
      return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data().dates || []);
        } else {
          callback([]);
        }
      }, (error) => {
        console.error('Error en listener de fechas bloqueadas:', error);
      });
    } catch (error) {
      console.error('Error configurando listener de fechas bloqueadas:', error);
      return () => {};
    }
  },

  onSpecialDatesChange(callback) {
    try {
      const docRef = doc(db, 'settings', 'specialDates');
      return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data().dates || {});
        } else {
          callback({});
        }
      }, (error) => {
        console.error('Error en listener de fechas especiales:', error);
      });
    } catch (error) {
      console.error('Error configurando listener de fechas especiales:', error);
      return () => {};
    }
  }
};

export default FirebaseService;