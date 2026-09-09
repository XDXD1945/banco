let currentUser = null;

// --- NAVEGACIÓN Y VISTAS ---
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function showPeticionTab(tab) {
    document.getElementById('pet-registro-tab').style.display = tab === 'registro' ? 'block' : 'none';
    document.getElementById('pet-prestamo-tab').style.display = tab === 'prestamo' ? 'block' : 'none';
}

function showAdminTab(tabId) {
    document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
}

function formatCLP(amount) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

// --- CÁLCULO DE INTERÉS COMPEUSTO POR MORA ---
// Si se pasa de la fecha de pago: cada 2 días incrementa un 20% (multiplicador 1.2)
function calcularMontoConInteres(montoInicial, fechaVencimientoStr) {
    const fechaVence = new Date(fechaVencimientoStr);
    const fechaHoy = new Date();
    
    // resetear horas para cálculo preciso de días
    fechaVence.setHours(0,0,0,0);
    fechaHoy.setHours(0,0,0,0);

    if (fechaHoy <= fechaVence) {
        return { montoActual: montoInicial, diasRetraso: 0, periodos: 0 };
    }

    const diferenciaMs = fechaHoy - fechaVence;
    const diasRetraso = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));
    
    // Cada 2 días transcurridos
    const periodos = Math.floor(diasRetraso / 2);
    let montoActual = montoInicial * Math.pow(1.20, periodos);

    return {
        montoActual: Math.round(montoActual),
        diasRetraso,
        periodos
    };
}

// --- LOGIC: USUARIOS ---
function loginUser() {
    const userInput = document.getElementById('user-id-input').value.trim();
    const passInput = document.getElementById('user-pass-input').value.trim();

    const user = DB.usuarios.find(u => (u.id === userInput || u.nombre === userInput) && u.pass === passInput);

    if (!user) {
        alert("Credenciales incorrectas.");
        return;
    }

    currentUser = user;
    document.getElementById('user-display-name').innerText = user.nombre;
    renderUserDashboard();
    switchView('view-dashboard-user');
}

function logout() {
    currentUser = null;
    switchView('view-login-user');
}

function renderUserDashboard() {
    const debtsBody = document.getElementById('user-debts-list');
    const paymentsList = document.getElementById('user-payments-list');
    const loansList = document.getElementById('user-loans-list');

    debtsBody.innerHTML = '';
    paymentsList.innerHTML = '';
    loansList.innerHTML = '';

    // Deudas activas
    const userLoans = DB.prestamos.filter(p => p.userId === currentUser.id);
    userLoans.forEach(p => {
        // Historial prestamos
        const liL = document.createElement('li');
        liL.textContent = `Préstamo el ${p.fechaInicio}: ${formatCLP(p.monto)} - Vence: ${p.fechaVence} (${p.pagado ? 'Pagado' : 'Pendiente'})`;
        loansList.appendChild(liL);

        if (!p.pagado) {
            const calc = calcularMontoConInteres(p.monto, p.fechaVence);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>Préstamo Credito CLP</td>
                <td>${formatCLP(p.monto)}</td>
                <td style="color: ${calc.periodos > 0 ? 'red' : 'inherit'}">${formatCLP(calc.montoActual)} ${calc.periodos > 0 ? `(+${calc.periodos * 20}% int)` : ''}</td>
                <td>${p.fechaVence}</td>
            `;
            debtsBody.appendChild(tr);
        }
    });

    // Pagos
    const userPayments = DB.pagos.filter(pg => pg.userId === currentUser.id);
    userPayments.forEach(pg => {
        const liP = document.createElement('li');
        liP.textContent = `Pago realizado el ${pg.fecha}: ${formatCLP(pg.monto)}`;
        paymentsList.appendChild(liP);
    });
}

// --- LOGIC: PETICIONES EN LINEA ---
function submitRegistroReq() {
    const nombre = document.getElementById('req-reg-name').value.trim();
    const pass = document.getElementById('req-reg-pass').value.trim();

    if (!nombre || !pass) return alert("Complete los campos.");

    const nuevaPet = {
        id: "pet_" + Date.now(),
        tipo: "registro",
        datos: { nombre, pass }
    };

    DB.peticiones.push(nuevaPet);
    guardarBD(DB);
    alert("Solicitud de registro enviada con éxito.");
    document.getElementById('req-reg-name').value = '';
    document.getElementById('req-reg-pass').value = '';
}

function submitPrestamoReq() {
    const userId = document.getElementById('req-loan-id').value.trim();
    const pass = document.getElementById('req-loan-pass').value.trim();
    const monto = parseFloat(document.getElementById('req-loan-amount').value);
    const motivo = document.getElementById('req-loan-reason').value.trim();
    const fechaPago = document.getElementById('req-loan-date').value;

    const user = DB.usuarios.find(u => (u.id === userId || u.nombre === userId) && u.pass === pass);
    if (!user) return alert("Usuario o clave inválidos.");
    if (!monto || !fechaPago) return alert("Complete el monto y la fecha estimada de pago.");

    const nuevaPet = {
        id: "pet_" + Date.now(),
        tipo: "prestamo",
        datos: { userId: user.id, nombreUser: user.nombre, monto, motivo, fechaPago }
    };

    DB.peticiones.push(nuevaPet);
    guardarBD(DB);
    alert("Solicitud de préstamo enviada al administrador.");
}

// --- LOGIC: ADMINISTRADOR ---
function loginAdmin() {
    const pass = document.getElementById('admin-pass-input').value.trim();
    if (pass === DB.adminKey) {
        renderAdminTables();
        switchView('view-dashboard-admin');
    } else {
        alert("Clave de administrador incorrecta.");
    }
}

function renderAdminTables() {
    renderUsers();
    renderDeudores();
    renderPeticiones();
    renderAcciones();
}

function renderUsers() {
    const div = document.getElementById('admin-users-list');
    div.innerHTML = '';
    if (DB.usuarios.length === 0) {
        div.innerHTML = '<p>No hay usuarios registrados.</p>';
        return;
    }
    DB.usuarios.forEach(u => {
        div.innerHTML += `<div class="card"><strong>ID:</strong> ${u.id} | <strong>Usuario:</strong> ${u.nombre}</div>`;
    });
}

function renderDeudores() {
    const tbody = document.getElementById('admin-deudores-list');
    tbody.innerHTML = '';

    DB.prestamos.filter(p => !p.pagado).forEach(p => {
        const user = DB.usuarios.find(u => u.id === p.userId);
        const userName = user ? user.nombre : p.userId;
        const calc = calcularMontoConInteres(p.monto, p.fechaVence);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${userName} (${p.userId})</td>
            <td>${formatCLP(p.monto)}</td>
            <td><strong>${formatCLP(calc.montoActual)}</strong></td>
            <td>${p.fechaVence}</td>
            <td>${calc.diasRetraso > 0 ? `<span style="color:red">Vencido (+${calc.diasRetraso} días / ${calc.periodos} periodos int.)</span>` : 'Al día'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function adminCrearPrestamoDirecto() {
    const userId = document.getElementById('adm-loan-userid').value.trim();
    const monto = parseFloat(document.getElementById('adm-loan-amount').value);
    const fechaInicio = document.getElementById('adm-loan-date').value;
    const fechaVence = document.getElementById('adm-loan-duedate').value;

    const user = DB.usuarios.find(u => u.id === userId || u.nombre === userId);
    if (!user) return alert("El usuario indicado no existe.");

    const nuevoPrestamo = {
        id: "p_" + Date.now(),
        userId: user.id,
        monto,
        fechaInicio,
        fechaVence,
        pagado: false
    };

    DB.prestamos.push(nuevoPrestamo);
    guardarBD(DB);
    alert("Préstamo asignado correctamente.");
    renderDeudores();
}

function renderPeticiones() {
    const div = document.getElementById('admin-peticiones-list');
    div.innerHTML = '';

    if (DB.peticiones.length === 0) {
        div.innerHTML = '<p>No hay peticiones pendientes.</p>';
        return;
    }

    DB.peticiones.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';

        if (p.tipo === 'registro') {
            card.innerHTML = `
                <h4>Solicitud de Registro</h4>
                <p><strong>Usuario:</strong> ${p.datos.nombre}</p>
                <button class="success" onclick="aprobarRegistro('${p.id}')">Aprobar</button>
                <button class="danger" onclick="rechazarPeticion('${p.id}')">Rechazar</button>
            `;
        } else if (p.tipo === 'prestamo') {
            card.innerHTML = `
                <h4>Solicitud de Préstamo</h4>
                <p><strong>Usuario ID:</strong> ${p.datos.userId} (${p.datos.nombreUser})</p>
                <p><strong>Monto:</strong> ${formatCLP(p.datos.monto)}</p>
                <p><strong>Motivo:</strong> ${p.datos.motivo}</p>
                <p><strong>Pretende pagar el:</strong> ${p.datos.fechaPago}</p>
                <button class="success" onclick="aprobarPrestamo('${p.id}')">Aprobar</button>
                <button class="danger" onclick="rechazarPeticion('${p.id}')">Rechazar</button>
            `;
        }
        div.appendChild(card);
    });
}

function aprobarRegistro(idPet) {
    const pet = DB.peticiones.find(p => p.id === idPet);
    if (!pet) return;

    const nuevoUsuario = {
        id: "usr_" + Math.floor(Math.random() * 10000),
        nombre: pet.datos.nombre,
        pass: pet.datos.pass
    };

    DB.usuarios.push(nuevoUsuario);
    DB.peticiones = DB.peticiones.filter(p => p.id !== idPet);
    guardarBD(DB);
    alert(`Usuario ${nuevoUsuario.nombre} aprobado con ID: ${nuevoUsuario.id}`);
    renderAdminTables();
}

function aprobarPrestamo(idPet) {
    const pet = DB.peticiones.find(p => p.id === idPet);
    if (!pet) return;

    const hoy = new Date().toISOString().split('T')[0];
    const nuevoPrestamo = {
        id: "p_" + Date.now(),
        userId: pet.datos.userId,
        monto: pet.datos.monto,
        fechaInicio: hoy,
        fechaVence: pet.datos.fechaPago,
        pagado: false
    };

    DB.prestamos.push(nuevoPrestamo);
    DB.peticiones = DB.peticiones.filter(p => p.id !== idPet);
    guardarBD(DB);
    alert("Préstamo aprobado.");
    renderAdminTables();
}

function rechazarPeticion(idPet) {
    DB.peticiones = DB.peticiones.filter(p => p.id !== idPet);
    guardarBD(DB);
    renderPeticiones();
}

function renderAcciones() {
    const tbody = document.getElementById('admin-acciones-list');
    tbody.innerHTML = '';

    DB.acciones.forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${a.nombre}</td>
            <td>${formatCLP(a.invertido)}</td>
            <td>${formatCLP(a.retornoEsperado)}</td>
            <td>${a.fecha}</td>
        `;
        tbody.appendChild(tr);
    });
}

function adminCrearAccion() {
    const nombre = document.getElementById('act-name').value.trim();
    const invertido = parseFloat(document.getElementById('act-invested').value);
    const retornoEsperado = parseFloat(document.getElementById('act-expected').value);
    const fecha = document.getElementById('act-date').value;

    if (!nombre || !invertido || !retornoEsperado || !fecha) {
        return alert("Complete todos los campos de la inversión.");
    }

    const nuevaAccion = {
        id: "act_" + Date.now(),
        nombre,
        invertido,
        retornoEsperado,
        fecha
    };

    DB.acciones.push(nuevaAccion);
    guardarBD(DB);
    alert("Inversión registrada.");
    renderAcciones();

    document.getElementById('act-name').value = '';
    document.getElementById('act-invested').value = '';
    document.getElementById('act-expected').value = '';
    document.getElementById('act-date').value = '';
}