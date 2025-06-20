import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js";

// تهيئة Firebase مع مشروعك الجديد
const firebaseConfig = {
    apiKey: "AIzaSyD3JXjJ-9J9XJ9XJ9XJ9XJ9XJ9XJ9XJ9XJ",
    authDomain: "barber-app-1a1c3.firebaseapp.com",
    databaseURL: "https://barber-app-1a1c3-default-rtdb.firebaseio.com",
    projectId: "barber-app-1a1c3",
    storageBucket: "barber-app-1a1c3.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef1234567890"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// متغيرات التطبيق
let currentUser = null;
let currentUserType = null;

// عناصر DOM
const screens = {
    roleSelection: document.getElementById('roleSelection'),
    clientLogin: document.getElementById('clientLogin'),
    barberLogin: document.getElementById('barberLogin'),
    clientDashboard: document.getElementById('clientDashboard'),
    barberDashboard: document.getElementById('barberDashboard')
};

// ========== دوال تسجيل الدخول ========== //

async function clientLogin() {
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const errorElement = document.getElementById('clientError');
    
    if (!name) {
        errorElement.textContent = 'الرجاء إدخال الاسم';
        errorElement.classList.remove('hidden');
        return;
    }
    
    if (!phone || !/^[0-9]{10,15}$/.test(phone)) {
        errorElement.textContent = 'الرجاء إدخال رقم هاتف صحيح';
        errorElement.classList.remove('hidden');
        return;
    }
    
    // إنشاء عميل جديد
    currentUser = {
        id: 'client-' + Date.now(),
        name: name,
        phone: phone,
        type: 'client'
    };
    currentUserType = 'client';
    
    document.getElementById('clientAvatar').textContent = name.charAt(0);
    showClientDashboard();
    await loadBarbers();
}

async function barberLogin() {
    const phone = document.getElementById('barberPhone').value.trim();
    const password = document.getElementById('barberPassword').value;
    const errorElement = document.getElementById('barberError');
    
    if (!phone || !password) {
        errorElement.textContent = 'رقم الهاتف وكلمة المرور مطلوبان';
        errorElement.classList.remove('hidden');
        return;
    }
    
    try {
        // تسجيل الدخول باستخدام Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, `${phone}@barber.com`, password);
        const user = userCredential.user;
        
        // جلب بيانات الحلاق
        const barberRef = ref(database, `barbers/${user.uid}`);
        const snapshot = await get(barberRef);
        
        if (snapshot.exists()) {
            const barberData = snapshot.val();
            
            currentUser = {
                id: user.uid,
                name: barberData.name,
                phone: barberData.phone,
                type: 'barber'
            };
            currentUserType = 'barber';
            
            document.getElementById('barberAvatar').textContent = barberData.name.charAt(0);
            showBarberDashboard();
            loadBarberQueue();
        } else {
            errorElement.textContent = 'بيانات الحلاق غير موجودة';
            errorElement.classList.remove('hidden');
            await signOut(auth);
        }
    } catch (error) {
        handleAuthError(error, errorElement);
    }
}

async function barberSignup() {
    const name = document.getElementById('barberName').value.trim();
    const phone = document.getElementById('newBarberPhone').value.trim();
    const password = document.getElementById('newBarberPassword').value;
    const confirmPassword = document.getElementById('confirmBarberPassword').value;
    const errorElement = document.getElementById('barberError');
    
    // التحقق من البيانات
    if (!name || !phone || !password || !confirmPassword) {
        errorElement.textContent = 'جميع الحقول مطلوبة';
        errorElement.classList.remove('hidden');
        return;
    }
    
    if (password !== confirmPassword) {
        errorElement.textContent = 'كلمتا المرور غير متطابقتين';
        errorElement.classList.remove('hidden');
        return;
    }
    
    try {
        // إنشاء حساب Auth
        const userCredential = await createUserWithEmailAndPassword(auth, `${phone}@barber.com`, password);
        const user = userCredential.user;
        
        // حفظ بيانات الحلاق في Realtime Database
        await set(ref(database, `barbers/${user.uid}`), {
            name: name,
            phone: phone,
            status: 'open',
            queue: {},
            type: 'barber',
            createdAt: new Date().toISOString()
        });
        
        // تسجيل الدخول التلقائي
        currentUser = {
            id: user.uid,
            name: name,
            phone: phone,
            type: 'barber'
        };
        currentUserType = 'barber';
        
        document.getElementById('barberAvatar').textContent = name.charAt(0);
        showBarberDashboard();
        loadBarberQueue();
    } catch (error) {
        handleAuthError(error, errorElement);
    }
}

// ========== دوال إدارة الحجوزات ========== //

async function bookAppointment(barberId, barberName) {
    if (!currentUser) return;
    
    try {
        const newBookingRef = push(ref(database, `barbers/${barberId}/queue`));
        await set(newBookingRef, {
            clientId: currentUser.id,
            clientName: currentUser.name,
            clientPhone: currentUser.phone,
            timestamp: Date.now(),
            status: 'waiting'
        });
        
        currentUser.booking = {
            barberId: barberId,
            barberName: barberName,
            bookingId: newBookingRef.key,
            timestamp: new Date().toLocaleString()
        };
        
        showCurrentBooking();
        alert(`تم الحجز بنجاح مع ${barberName}`);
    } catch (error) {
        alert('حدث خطأ أثناء الحجز: ' + error.message);
    }
}

async function cancelBooking(barberId, bookingId) {
    if (!confirm('هل أنت متأكد من إلغاء الحجز؟')) return;
    
    try {
        await remove(ref(database, `barbers/${barberId}/queue/${bookingId}`));
        delete currentUser.booking;
        document.getElementById('currentBookingContainer').classList.add('hidden');
        alert('تم إلغاء الحجز بنجاح');
    } catch (error) {
        alert('حدث خطأ أثناء الإلغاء: ' + error.message);
    }
}

async function completeClient(barberId, bookingId) {
    try {
        await remove(ref(database, `barbers/${barberId}/queue/${bookingId}`));
        alert('تم إنهاء خدمة العميل');
    } catch (error) {
        alert('حدث خطأ: ' + error.message);
    }
}

// ========== دوال مساعدة ========== //

function handleAuthError(error, errorElement) {
    const errors = {
        'auth/email-already-in-use': 'الحساب مسجل بالفعل',
        'auth/user-not-found': 'الحساب غير موجود',
        'auth/wrong-password': 'كلمة مرور خاطئة',
        'auth/invalid-email': 'بريد إلكتروني غير صالح'
    };
    
    errorElement.textContent = errors[error.code] || 'حدث خطأ غير متوقع';
    errorElement.classList.remove('hidden');
}

function showScreen(screenId) {
    Object.values(screens).forEach(screen => {
        screen.classList.add('hidden');
    });
    screens[screenId].classList.remove('hidden');
}

function showBarberSignup() {
    document.getElementById('barberFormTitle').textContent = 'إنشاء حساب حلاق جديد';
    document.getElementById('barberLoginForm').classList.add('hidden');
    document.getElementById('barberSignupForm').classList.remove('hidden');
}

function showBarberLogin() {
    document.getElementById('barberFormTitle').textContent = 'تسجيل الدخول للحلاقين';
    document.getElementById('barberSignupForm').classList.add('hidden');
    document.getElementById('barberLoginForm').classList.remove('hidden');
}

async function loadBarbers() {
    const barbersList = document.getElementById('barbersList');
    barbersList.innerHTML = 'جارٍ التحميل...';
    
    onValue(ref(database, 'barbers'), (snapshot) => {
        const barbers = snapshot.val() || {};
        barbersList.innerHTML = '';
        
        Object.entries(barbers).forEach(([id, barber]) => {
            if (barber.type !== 'barber') return;
            
            const status = barber.status || 'open';
            const queueSize = barber.queue ? Object.keys(barber.queue).length : 0;
            
            const barberCard = document.createElement('div');
            barberCard.className = 'barber-card';
            barberCard.innerHTML = `
                <div class="barber-info">
                    <div class="barber-header">
                        <div class="barber-avatar">${barber.name.charAt(0)}</div>
                        <div class="barber-name">${barber.name}</div>
                    </div>
                    <div class="barber-status ${status === 'open' ? 'status-open' : 'status-closed'}">
                        ${status === 'open' ? 'مفتوح' : 'مغلق'}
                    </div>
                    <div class="barber-details">
                        <div>رقم الهاتف: ${barber.phone}</div>
                        <div>الزبائن في الانتظار: ${queueSize}</div>
                    </div>
                </div>
                <button class="book-btn" ${status === 'closed' ? 'disabled' : ''}" 
                    onclick="bookAppointment('${id}', '${barber.name.replace(/'/g, "\\'")}')">
                    ${status === 'open' ? 'احجز الآن' : 'مغلق'}
                </button>
            `;
            barbersList.appendChild(barberCard);
        });
    });
}

async function loadBarberQueue() {
    if (!currentUser || currentUser.type !== 'barber') return;
    
    const queueList = document.getElementById('barberQueue');
    queueList.innerHTML = 'جارٍ التحميل...';
    
    onValue(ref(database, `barbers/${currentUser.id}/queue`), (snapshot) => {
        const queue = snapshot.val() || {};
        queueList.innerHTML = '';
        
        if (Object.keys(queue).length === 0) {
            queueList.innerHTML = '<li>لا يوجد زبائن في الانتظار</li>';
            return;
        }
        
        Object.entries(queue).forEach(([id, booking], index) => {
            const item = document.createElement('li');
            item.className = 'queue-item';
            item.innerHTML = `
                <div class="queue-info">
                    <div class="queue-position">#${index + 1}</div>
                    <div class="queue-name">${booking.clientName}</div>
                    <div class="queue-phone">${booking.clientPhone}</div>
                </div>
                ${index === 0 ? `<button class="complete-btn" onclick="completeClient('${currentUser.id}', '${id}')">
                    <i class="fas fa-check"></i> إنهاء
                </button>` : ''}
            `;
            queueList.appendChild(item);
        });
    });
}

function showCurrentBooking() {
    if (!currentUser?.booking) return;
    
    const container = document.getElementById('currentBookingContainer');
    const { barberId, bookingId } = currentUser.booking;
    
    document.getElementById('bookingBarber').textContent = currentUser.booking.barberName;
    document.getElementById('bookingTime').textContent = currentUser.booking.timestamp;
    
    onValue(ref(database, `barbers/${barberId}/queue`), (snapshot) => {
        const queue = snapshot.val() || {};
        let position = 0;
        
        Object.keys(queue).forEach((key, idx) => {
            if (key === bookingId) position = idx + 1;
        });
        
        document.getElementById('bookingPosition').textContent = position || '--';
    });
    
    container.classList.remove('hidden');
}

async function logout() {
    try {
        await signOut(auth);
        currentUser = null;
        currentUserType = null;
        showScreen('roleSelection');
    } catch (error) {
        alert('حدث خطأ أثناء تسجيل الخروج');
    }
}

// ========== تهيئة التطبيق ========== //

onAuthStateChanged(auth, (user) => {
    if (user) {
        get(ref(database, `barbers/${user.uid}`)).then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (data.type === 'barber') {
                    currentUser = {
                        id: user.uid,
                        name: data.name,
                        phone: data.phone,
                        type: 'barber'
                    };
                    showBarberDashboard();
                    loadBarberQueue();
                }
            }
        });
    } else {
        currentUser = null;
        currentUserType = null;
    }
});

// تعيين الدوال للنطاق العام
window.showScreen = showScreen;
window.clientLogin = clientLogin;
window.barberLogin = barberLogin;
window.barberSignup = barberSignup;
window.showBarberSignup = showBarberSignup;
window.showBarberLogin = showBarberLogin;
window.bookAppointment = bookAppointment;
window.completeClient = completeClient;
window.logout = logout;

// بدء التطبيق
showScreen('roleSelection');
