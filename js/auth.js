/* ==========================================================
   auth.js - first-run setup, login, logout, role-based access
   ========================================================== */

let selectedRole = "admin"; // which tab is active on the login page

// First run = no admin account exists yet
const isFirstRun = () => !getUsers().some((u) => u.role === "admin");

// Where each role lands after login
const homeFor = (role) => (role === "admin" ? "admin.html" : "employee.html");

// ---------- Login page ----------
function initLoginPage() {
    // Already logged in? Go straight to the dashboard.
    const session = getSession();
    if (session && getUsers().some((u) => u.id === session.userId)) {
        window.location.href = homeFor(session.role);
        return;
    }

    if (isFirstRun()) {
        document.getElementById("setupBox").classList.remove("hidden");
    } else {
        document.getElementById("loginBox").classList.remove("hidden");
    }
}

function selectRole(role) {
    selectedRole = role;
    document
        .getElementById("tabAdmin")
        .classList.toggle("active", role === "admin");
    document
        .getElementById("tabEmployee")
        .classList.toggle("active", role === "employee");
    document.getElementById("loginHint").textContent =
        role === "admin"
            ? "Sign in with your Admin account."
            : "Sign in with the email and password your Admin gave you.";
}

// ---------- First-run setup: creates company + Admin ----------
function handleSetup() {
    const companyName = document.getElementById("setupCompany").value.trim();
    const name = document.getElementById("setupName").value.trim();
    const email = document
        .getElementById("setupEmail")
        .value.trim()
        .toLowerCase();
    const password = document.getElementById("setupPassword").value;
    const confirm = document.getElementById("setupConfirm").value;

    if (!companyName || !name || !email || !password) {
        showToast("Please fill in all fields.", "error");
        return;
    }
    if (password.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        return;
    }
    if (password !== confirm) {
        showToast("Passwords do not match.", "error");
        return;
    }

    const company = getCompany();
    company.name = companyName;
    saveCompany(company);

    const admin = {
        id: generateId("u_"),
        name: name,
        email: email,
        password: hashPassword(password),
        role: "admin",
        department: "Management",
        designation: "Administrator",
        salary: 0,
        joinDate: todayStr(),
    };
    saveUsers([admin]);

    setSession(admin);
    window.location.href = "admin.html";
}

// ---------- Login ----------
function handleLogin() {
    const email = document
        .getElementById("loginEmail")
        .value.trim()
        .toLowerCase();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
        showToast("Enter your email and password.", "error");
        return;
    }

    const user = getUsers().find(
        (u) => u.email.toLowerCase() === email && u.role === selectedRole,
    );
    if (!user || user.password !== hashPassword(password)) {
        showToast("Invalid credentials for this role.", "error");
        return;
    }

    setSession(user);
    window.location.href = homeFor(user.role);
}

// ---------- Logout ----------
function logout() {
    clearSession();
    window.location.href = "index.html";
}

// ---------- Role-based access control ----------
// Call at the top of every protected page. Returns the session, or null (and redirects).
function requireLogin(requiredRole) {
    const session = getSession();
    const user = session
        ? getUsers().find((u) => u.id === session.userId)
        : null;

    // Not logged in, or the account was deleted
    if (!session || !user) {
        clearSession();
        window.location.href = "index.html";
        return null;
    }

    // Wrong role: send them to the page they are allowed to see
    if (requiredRole && user.role !== requiredRole) {
        window.location.href = homeFor(user.role);
        return null;
    }

    return session;
}

const getCurrentUser = () => {
    const session = getSession();
    return session ? getUsers().find((u) => u.id === session.userId) : null;
};
