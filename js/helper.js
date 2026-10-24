/* ==========================================================
   helper.js - layout (sidebar/topbar), toast, modal, formatting,
   theme, clock, and the Admin "Smart Helper"
   ========================================================== */

// ---------- Navigation per role ----------
const NAV = {
  admin: [
    { section: "Main Menu" },
    { key: "dashboard", label: "Dashboard", href: "admin.html", icon: "📊" },
    { key: "employees", label: "Employees", href: "employees.html", icon: "👥" },
    { key: "leaves", label: "Leave Requests", href: "leaves.html", icon: "📝" },
    { section: "Configuration" },
    { key: "settings", label: "Company Settings", href: "settings.html", icon: "⚙️" }
  ],
  employee: [
    { section: "My Space" },
    { key: "dashboard", label: "My Dashboard", href: "employee.html", icon: "🏠" },
    { key: "payslip", label: "My Payslip", href: "payslip.html", icon: "🧾" }
  ]
};

// ---------- Small formatting helpers ----------
const escapeHtml = (text) =>
  String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const initials = (name) =>
  String(name || "?")
    .split(" ")
    .filter((p) => p)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

const formatTime = (iso) => (iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—");

const formatDate = (str) =>
  str ? parseDate(str).toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "—";

const formatHours = (hours) => `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;

const formatMoney = (amount) => `${getCompany().currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const badge = (status) => `<span class="badge b-${status.key}">${status.label}</span>`;

// ---------- Toast ----------
function showToast(message, type) {
  let box = document.getElementById("toastBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "toastBox";
    box.className = "toast-container";
    document.body.appendChild(box);
  }
  const toast = document.createElement("div");
  toast.className = "toast " + (type === "error" ? "error" : type === "warn" ? "warn" : "");
  toast.textContent = message;
  box.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ---------- Modal ----------
const openModal = (id) => document.getElementById(id).classList.add("open");
const closeModal = (id) => document.getElementById(id).classList.remove("open");

// ---------- Theme (light / dark) ----------
function applyTheme() {
  const theme = localStorage.getItem("hcm_theme") || "light";
  document.documentElement.setAttribute("data-theme", theme);
}
function toggleTheme() {
  const current = localStorage.getItem("hcm_theme") || "light";
  localStorage.setItem("hcm_theme", current === "light" ? "dark" : "light");
  applyTheme();
}

// ---------- Mobile sidebar ----------
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarBackdrop").classList.toggle("open");
}

// ---------- Live clock ----------
function startClock() {
  const tick = () => {
    const now = new Date();
    const pill = document.getElementById("clockText");
    const big = document.getElementById("bigClock");
    const date = document.getElementById("todayDate");
    if (pill) pill.textContent = now.toLocaleTimeString("en-US");
    if (big) big.textContent = now.toLocaleTimeString("en-US");
    if (date) date.textContent = now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };
  tick();
  setInterval(tick, 1000);
}

// ---------- Page bootstrap: guard + sidebar + topbar ----------
// Returns true when the page may continue loading.
function initPage(role, activeKey, title, subtitle) {
  applyTheme();
  const session = requireLogin(role);
  if (!session) return false;

  const items = NAV[role];
  let links = "";
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.section) {
      links += `<div class="nav-section">${item.section}</div>`;
    } else {
      const active = item.key === activeKey ? "active" : "";
      links += `<a class="nav-link ${active}" href="${item.href}"><span class="nav-icon">${item.icon}</span>${item.label}</a>`;
    }
  }

  document.getElementById("sidebar").innerHTML = `
    <div class="brand">
      <div class="brand-logo">👥</div>
      <div><div class="brand-name">HCM Lite</div><div class="brand-sub">HR Management</div></div>
    </div>
    ${links}
    <div class="sidebar-user">
      <div class="avatar sm">${initials(session.name)}</div>
      <div class="who"><b>${escapeHtml(session.name)}</b><span>${session.role}</span></div>
      <button class="icon-btn" title="Logout" onclick="logout()">⎋</button>
    </div>`;

  const company = getCompany();
  document.getElementById("topbar").innerHTML = `
    <button class="icon-btn menu-btn" onclick="toggleSidebar()">☰</button>
    <div class="titles">
      <h2>${title}</h2>
      <p>${escapeHtml(company.name)} — ${subtitle || "Live operations and staff diagnostics."}</p>
    </div>
    <div class="top-actions">
      <span class="clock-pill">🕒 <span id="clockText"></span></span>
      <button class="icon-btn" title="Toggle dark mode" onclick="toggleTheme()">🌙</button>
      <div class="avatar">${initials(session.name)}</div>
    </div>`;

  const backdrop = document.createElement("div");
  backdrop.id = "sidebarBackdrop";
  backdrop.className = "sidebar-backdrop";
  backdrop.setAttribute("onclick", "toggleSidebar()");
  document.body.appendChild(backdrop);

  startClock();
  return true;
}

// ==========================================================
// Smart Helper (Admin dashboard): turns today's data into advice
// ==========================================================
function getSmartInsights() {
  const insights = [];
  const company = getCompany();
  const employees = getUsers().filter((u) => u.role === "employee");
  const today = todayStr();
  const now = new Date();

  if (employees.length === 0) {
    insights.push({ icon: "👋", level: "", text: "No employees yet. Open the <b>Employees</b> page and add your first team member." });
    return insights;
  }

  if (isWeekend(today)) {
    insights.push({ icon: "🌴", level: "good", text: "Today is a weekend, so attendance is not required." });
  } else {
    // Who has not checked in after the grace cutoff?
    const cutoff = timeToMinutes(company.startTime) + Number(company.graceMinutes);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const missing = [];
    for (let i = 0; i < employees.length; i++) {
      if (getDayStatus(employees[i], today).key === "absent") missing.push(employees[i].name);
    }
    if (missing.length > 0 && nowMinutes > cutoff) {
      insights.push({ icon: "⏰", level: "danger", text: `<b>${missing.length}</b> employee(s) have not checked in yet: ${escapeHtml(missing.slice(0, 4).join(", "))}${missing.length > 4 ? "…" : ""}.` });
    } else if (missing.length > 0) {
      insights.push({ icon: "🕘", level: "", text: `Office opens at <b>${company.startTime}</b> (grace ${company.graceMinutes} min). ${missing.length} employee(s) still to check in.` });
    }

    const stats = getTodayStats();
    if (stats.late > 0) insights.push({ icon: "🐢", level: "warn", text: `<b>${stats.late}</b> employee(s) arrived late today.` });
    if (stats.onLeave > 0) insights.push({ icon: "✈️", level: "", text: `<b>${stats.onLeave}</b> employee(s) are on approved leave today.` });
  }

  const pending = getLeaves().filter((l) => l.status === "pending").length;
  if (pending > 0) {
    insights.push({ icon: "📝", level: "warn", text: `<b>${pending}</b> leave request(s) waiting for a decision. <a href="leaves.html">Review now</a>.` });
  }

  // Employees who are nearly out of leave quota
  const year = new Date().getFullYear();
  const lowBalance = employees.filter((e) => company.yearlyLeaveQuota - getUsedLeaveDays(e.id, year, false) <= 2).map((e) => e.name);
  if (lowBalance.length > 0) {
    insights.push({ icon: "📉", level: "warn", text: `Low leave balance (2 days or fewer): ${escapeHtml(lowBalance.slice(0, 4).join(", "))}.` });
  }

  if (insights.length === 0) insights.push({ icon: "✅", level: "good", text: "Everything looks good. No issues need your attention." });
  return insights;
}

function renderSmartHelper() {
  const box = document.getElementById("smartHelper");
  const insights = getSmartInsights();
  let html = "";
  for (let i = 0; i < insights.length; i++) {
    html += `<div class="helper-item ${insights[i].level}"><span>${insights[i].icon}</span><div>${insights[i].text}</div></div>`;
  }
  box.innerHTML = html;
}
