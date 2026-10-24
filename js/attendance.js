/* ==========================================================
   attendance.js - check-in/out, daily status rules, dashboards, payslip
   Rules:
     Late     = check-in after (Start Time + Grace Minutes)
     Half-day = total work hours < 5
     Absent   = no check-in on a working day (and not on approved leave)
   ========================================================== */

// ---------- Core rules ----------
const timeToMinutes = (t) => {
  const parts = t.split(":").map(Number);
  return parts[0] * 60 + parts[1];
};

function isLateCheckIn(iso) {
  const company = getCompany();
  const d = new Date(iso);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return minutes > timeToMinutes(company.startTime) + Number(company.graceMinutes);
}

const calcWorkHours = (inIso, outIso) => Math.max(0, (new Date(outIso) - new Date(inIso)) / 36e5);

const findRecord = (userId, date) => getAttendance().find((r) => r.userId === userId && r.date === date);

// Status of one employee on one date
function getDayStatus(user, dateStr) {
  if (dateStr > todayStr() || dateStr < user.joinDate) return { key: "off", label: "—" };
  if (isWeekend(dateStr)) return { key: "weekend", label: "Weekend" };

  const rec = findRecord(user.id, dateStr);
  if (rec) {
    if (rec.checkOut && rec.isHalfDay) return { key: "half", label: "Half-day" };
    if (rec.isLate) return { key: "late", label: "Late" };
    return { key: "present", label: "Present" };
  }
  if (isOnLeave(user.id, dateStr)) return { key: "leave", label: "On Leave" };
  return { key: "absent", label: "Absent" };
}

// Totals for one employee in one month (month0 = 0 for January)
function calcMonthStats(user, year, month0) {
  const first = toDateStr(new Date(year, month0, 1));
  const last = toDateStr(new Date(year, month0 + 1, 0));
  const days = getDatesBetween(first, last);

  const stats = { workingDays: days.filter((d) => !isWeekend(d)).length, present: 0, late: 0, half: 0, absent: 0, leave: 0 };
  for (let i = 0; i < days.length; i++) {
    const key = getDayStatus(user, days[i]).key;
    if (key === "present") stats.present++;
    else if (key === "late") stats.late++;
    else if (key === "half") stats.half++;
    else if (key === "absent") stats.absent++;
    else if (key === "leave") stats.leave++;
  }
  return stats;
}

// ==========================================================
// Employee: check-in / check-out
// ==========================================================
function handleCheckIn() {
  const user = getCurrentUser();
  const today = todayStr();

  if (isWeekend(today)) { showToast("Today is a weekend. No check-in needed.", "warn"); return; }
  if (isOnLeave(user.id, today)) { showToast("You are on approved leave today.", "warn"); return; }
  if (findRecord(user.id, today)) { showToast("You have already checked in today.", "warn"); return; }

  const nowIso = new Date().toISOString();
  const late = isLateCheckIn(nowIso);

  const records = getAttendance();
  records.push({
    id: generateId("a_"),
    userId: user.id,
    date: today,
    checkIn: nowIso,
    checkOut: null,
    workHours: 0,
    isLate: late,
    isHalfDay: false
  });
  saveAttendance(records);

  showToast(late ? "Checked in. You are marked LATE." : "Checked in on time. Have a great day!", late ? "warn" : "success");
  renderEmployeePage();
}

function handleCheckOut() {
  const user = getCurrentUser();
  const records = getAttendance();
  const rec = records.find((r) => r.userId === user.id && r.date === todayStr());

  if (!rec) { showToast("Check in first.", "error"); return; }
  if (rec.checkOut) { showToast("You have already checked out.", "warn"); return; }

  rec.checkOut = new Date().toISOString();
  rec.workHours = calcWorkHours(rec.checkIn, rec.checkOut);
  rec.isHalfDay = rec.workHours < 5; // half-day rule
  saveAttendance(records);

  showToast(rec.isHalfDay ? `Checked out. Only ${formatHours(rec.workHours)} worked: marked HALF-DAY.` : `Checked out. Total ${formatHours(rec.workHours)}.`, rec.isHalfDay ? "warn" : "success");
  renderEmployeePage();
}

// ---------- Employee dashboard drawing ----------
function renderCheckCard() {
  const user = getCurrentUser();
  const today = todayStr();
  const rec = findRecord(user.id, today);
  const status = getDayStatus(user, today);

  const btnIn = document.getElementById("btnIn");
  const btnOut = document.getElementById("btnOut");
  btnIn.disabled = !!rec || isWeekend(today) || isOnLeave(user.id, today);
  btnOut.disabled = !rec || !!rec.checkOut;

  let message = "Not checked in yet.";
  if (isWeekend(today)) message = "It's the weekend. Enjoy your day off!";
  else if (isOnLeave(user.id, today)) message = "You are on approved leave today.";
  else if (rec && rec.checkOut) message = `Day complete. Worked ${formatHours(rec.workHours)}.`;
  else if (rec) message = "You are checked in. Don't forget to check out.";

  document.getElementById("checkStatus").innerHTML = `${badge(status)} <span class="muted small">${message}</span>`;
  document.getElementById("todayTimes").innerHTML = `
    <div class="mini-stats" style="margin-top:14px">
      <div class="mini"><b>${formatTime(rec ? rec.checkIn : null)}</b><span>Check-in</span></div>
      <div class="mini"><b>${formatTime(rec ? rec.checkOut : null)}</b><span>Check-out</span></div>
      <div class="mini"><b>${rec && rec.checkOut ? formatHours(rec.workHours) : "—"}</b><span>Hours</span></div>
    </div>
    <p class="small muted">Office starts ${getCompany().startTime}, grace ${getCompany().graceMinutes} min.</p>`;
}

function renderMonthStats() {
  const user = getCurrentUser();
  const now = new Date();
  const s = calcMonthStats(user, now.getFullYear(), now.getMonth());
  document.getElementById("monthStats").innerHTML = `
    <div class="mini"><b>${s.present}</b><span>On time</span></div>
    <div class="mini"><b>${s.late}</b><span>Late</span></div>
    <div class="mini"><b>${s.half}</b><span>Half-days</span></div>
    <div class="mini"><b>${s.absent}</b><span>Absent</span></div>
    <div class="mini"><b>${s.leave}</b><span>On leave</span></div>
    <div class="mini"><b>${s.workingDays}</b><span>Working days</span></div>`;
}

// Attendance history for the selected month (newest first)
function renderHistory() {
  const user = getCurrentUser();
  const value = document.getElementById("historyMonth").value; // YYYY-MM
  const parts = value.split("-").map(Number);
  const first = toDateStr(new Date(parts[0], parts[1] - 1, 1));
  const last = toDateStr(new Date(parts[0], parts[1], 0));
  const days = getDatesBetween(first, last).reverse();

  let rows = "";
  for (let i = 0; i < days.length; i++) {
    const status = getDayStatus(user, days[i]);
    if (status.key === "off") continue; // future days / before joining
    const rec = findRecord(user.id, days[i]);
    rows += `
      <tr>
        <td>${formatDate(days[i])}</td>
        <td>${badge(status)}</td>
        <td>${formatTime(rec ? rec.checkIn : null)}</td>
        <td>${formatTime(rec ? rec.checkOut : null)}</td>
        <td>${rec && rec.checkOut ? formatHours(rec.workHours) : "—"}</td>
      </tr>`;
  }
  document.getElementById("historyBody").innerHTML = rows || `<tr><td colspan="5" class="empty">No records for this month.</td></tr>`;
}

// Redraw everything on the employee dashboard
function renderEmployeePage() {
  renderCheckCard();
  renderMonthStats();
  renderHistory();
  renderLeaveBalance();
  renderMyLeaves();
}

// ==========================================================
// Admin dashboard
// ==========================================================
function getTodayStats() {
  const employees = getUsers().filter((u) => u.role === "employee");
  const today = todayStr();
  const stats = { total: employees.length, present: 0, late: 0, onLeave: 0, absent: 0, pending: getLeaves().filter((l) => l.status === "pending").length };

  for (let i = 0; i < employees.length; i++) {
    const key = getDayStatus(employees[i], today).key;
    if (key === "present" || key === "half") stats.present++; // on-time check-ins
    else if (key === "late") stats.late++;
    else if (key === "leave") stats.onLeave++;
    else if (key === "absent") stats.absent++;
  }
  return stats;
}

function statCard(label, value, note, icon, iconClass) {
  return `
    <div class="card stat-card">
      <div><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div>
      <div class="stat-icon ${iconClass}">${icon}</div>
    </div>`;
}

function renderAdminDashboard() {
  const s = getTodayStats();
  document.getElementById("statGrid").innerHTML =
    statCard("Total Employees", s.total, "Active staff members", "👥", "ic-blue") +
    statCard("Present Today", s.present, "On-time check-ins", "✅", "ic-green") +
    statCard("Late Today", s.late, "Past grace cutoff", "🕒", "ic-orange") +
    statCard("On Leave Today", s.onLeave, "Approved leave status", "✈️", "ic-blue") +
    statCard("Absent Today", s.absent, "No record on work day", "❌", "ic-red") +
    statCard("Pending Leaves", s.pending, `<a href="leaves.html">Review requests</a>`, "📋", "ic-orange");

  renderDeptChart();
  renderTrendChart();
  renderTodayTable();
  renderSmartHelper();
}

// Attendance by department (today)
function renderDeptChart() {
  const employees = getUsers().filter((u) => u.role === "employee");
  const today = todayStr();
  const depts = {};
  for (let i = 0; i < employees.length; i++) {
    const name = employees[i].department || "Unassigned";
    if (!depts[name]) depts[name] = { total: 0, here: 0 };
    depts[name].total++;
    if (findRecord(employees[i].id, today)) depts[name].here++;
  }

  const names = Object.keys(depts);
  if (names.length === 0) {
    document.getElementById("deptChart").innerHTML = `<p class="empty">No Departments</p>`;
    return;
  }
  let html = `<div class="bar-list">`;
  for (let i = 0; i < names.length; i++) {
    const d = depts[names[i]];
    const pct = Math.round((d.here / d.total) * 100);
    html += `
      <div class="bar-row">
        <div class="bar-top"><span>${escapeHtml(names[i])}</span><span class="muted">${d.here} / ${d.total} present</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>`;
  }
  document.getElementById("deptChart").innerHTML = html + `</div>`;
}

// 7-day attendance trend (people who checked in per day)
function renderTrendChart() {
  const records = getAttendance();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toDateStr(d));
  }
  const counts = days.map((day) => records.filter((r) => r.date === day).length);
  const max = Math.max(1, ...counts);

  let html = `<div class="trend">`;
  for (let i = 0; i < days.length; i++) {
    const height = Math.round((counts[i] / max) * 150);
    const label = parseDate(days[i]).toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
    html += `
      <div class="trend-col">
        <div class="trend-val">${counts[i]}</div>
        <div class="trend-bar" style="height:${height}px"></div>
        <div class="trend-lbl">${label}</div>
      </div>`;
  }
  document.getElementById("trendChart").innerHTML = html + `</div>`;
}

// Today's attendance table
function renderTodayTable() {
  const employees = getUsers().filter((u) => u.role === "employee");
  const today = todayStr();
  const body = document.getElementById("todayBody");

  if (employees.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="empty">No employees yet.</td></tr>`;
    return;
  }
  let rows = "";
  for (let i = 0; i < employees.length; i++) {
    const e = employees[i];
    const rec = findRecord(e.id, today);
    rows += `
      <tr>
        <td><div class="cell-user"><div class="avatar sm">${initials(e.name)}</div><div><b>${escapeHtml(e.name)}</b><span>${escapeHtml(e.department)}</span></div></div></td>
        <td>${badge(getDayStatus(e, today))}</td>
        <td>${formatTime(rec ? rec.checkIn : null)}</td>
        <td>${formatTime(rec ? rec.checkOut : null)}</td>
      </tr>`;
  }
  body.innerHTML = rows;
}

// ==========================================================
// Employee payslip
// Net Salary = Base - (Daily Rate * Absents + Daily Rate * 0.5 * Half-days)
// Daily Rate = Base / working days in that month
// ==========================================================
function generatePayslip() {
  const user = getCurrentUser();
  const value = document.getElementById("payMonth").value;
  if (!value) { showToast("Choose a month first.", "error"); return; }

  const parts = value.split("-").map(Number);
  const year = parts[0];
  const month0 = parts[1] - 1;
  const stats = calcMonthStats(user, year, month0);
  const company = getCompany();

  const base = Number(user.salary) || 0;
  const dailyRate = stats.workingDays > 0 ? base / stats.workingDays : 0;
  const absentDeduction = dailyRate * stats.absent;
  const halfDeduction = dailyRate * 0.5 * stats.half;
  const totalDeduction = absentDeduction + halfDeduction;
  const net = Math.max(0, base - totalDeduction);

  const monthName = new Date(year, month0, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const isCurrentMonth = value === todayStr().slice(0, 7);

  document.getElementById("payslipBox").innerHTML = `
    <div class="payslip" id="payslipPrint">
      <div class="payslip-head">
        <div><h2>${escapeHtml(company.name)}</h2><div class="small">Payslip for ${monthName}</div></div>
        <div class="small" style="text-align:right">Generated<br><b>${formatDate(todayStr())}</b></div>
      </div>
      <div class="info-grid">
        <div><b>Employee:</b> ${escapeHtml(user.name)}</div>
        <div><b>Email:</b> ${escapeHtml(user.email)}</div>
        <div><b>Department:</b> ${escapeHtml(user.department)}</div>
        <div><b>Designation:</b> ${escapeHtml(user.designation || "—")}</div>
        <div><b>Joined:</b> ${formatDate(user.joinDate)}</div>
        <div><b>Working days:</b> ${stats.workingDays}</div>
      </div>
      <table>
        <thead><tr><th>Attendance summary</th><th class="text-right">Days</th></tr></thead>
        <tbody>
          <tr><td>Present (on time)</td><td class="text-right">${stats.present}</td></tr>
          <tr><td>Late (no deduction)</td><td class="text-right">${stats.late}</td></tr>
          <tr><td>Half-days</td><td class="text-right">${stats.half}</td></tr>
          <tr><td>Approved leave (paid)</td><td class="text-right">${stats.leave}</td></tr>
          <tr><td>Absent</td><td class="text-right">${stats.absent}</td></tr>
        </tbody>
      </table>
      <table style="margin-top:16px">
        <thead><tr><th>Earnings &amp; deductions</th><th class="text-right">Amount</th></tr></thead>
        <tbody>
          <tr><td>Monthly base salary</td><td class="text-right">${formatMoney(base)}</td></tr>
          <tr><td>Daily rate (base ÷ ${stats.workingDays})</td><td class="text-right">${formatMoney(dailyRate)}</td></tr>
          <tr><td>Absent deduction (${stats.absent} × daily rate)</td><td class="text-right">- ${formatMoney(absentDeduction)}</td></tr>
          <tr><td>Half-day deduction (${stats.half} × 0.5 × daily rate)</td><td class="text-right">- ${formatMoney(halfDeduction)}</td></tr>
          <tr><td><b>Total deductions</b></td><td class="text-right"><b>- ${formatMoney(totalDeduction)}</b></td></tr>
        </tbody>
      </table>
      <div class="net-box"><span>Net Salary</span><span>${formatMoney(net)}</span></div>
      <p class="foot">${isCurrentMonth ? "This month is still in progress, so the figures are provisional and count days up to today. " : ""}This is a computer-generated payslip.</p>
    </div>`;
  document.getElementById("printBtn").classList.remove("hidden");
}

// Print or "Save as PDF" from the browser print dialog
const printPayslip = () => window.print();
