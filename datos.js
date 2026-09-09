// Base de datos inicial con credenciales administrativas predeterminadas
const initialData = {
    adminKey: "bRR#6911RR",
    usuarios: [
        // Ejemplo de estructura de usuario:
        // { id: "usr1", nombre: "JuanPerez", pass: "1234" }
    ],
    prestamos: [
        // { id: "p1", userId: "usr1", monto: 50000, fechaInicio: "2026-09-01", fechaVence: "2026-09-05", pagado: false }
    ],
    peticiones: [
        // { id: "req1", tipo: "registro" | "prestamo", datos: {...} }
    ],
    acciones: [
        // { id: "a1", nombre: "Fondo A", invertido: 100000, retornoEsperado: 150000, fecha: "2026-10-01" }
    ],
    pagos: [
        // { id: "pg1", userId: "usr1", monto: 10000, fecha: "2026-09-02" }
    ]
};

// Cargar desde localStorage o inicializar
function cargarBD() {
    const bdGuardada = localStorage.getItem("banco_db");
    if (!bdGuardada) {
        localStorage.setItem("banco_db", JSON.stringify(initialData));
        return initialData;
    }
    return JSON.parse(bdGuardada);
}

function guardarBD(db) {
    localStorage.setItem("banco_db", JSON.stringify(db));
}

// Global DB instance
let DB = cargarBD();