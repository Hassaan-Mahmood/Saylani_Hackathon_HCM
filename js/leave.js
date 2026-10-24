/* ==========================================================
   leave.js - leave rules, employee leave requests, admin decisions
   ========================================================== */

const LEAVE_TYPES = ["Annual", "Sick", "Casual", "Emergency"];

// Working days of a leave that fall inside one calendar year (weekends excluded)
const countLeaveDaysInYear = (leave, year) =>
    getDatesBetween(leave.from, leave.to).filter(
        (d) => !isWeekend(d) && parseDate(d).getFullYear() === year,
    ).length;

// Days used in a year. includePending=true reserves days for waiting requests too.
function getUsedLeaveDays(userId, year, includePending) {
    let total = 0;
    const leaves = getLeaves();
    for (let i = 0; i < leaves.length; i++) {
        const l = leaves[i];
        if (l.userId !== userId) continue;
        const counts =
            l.status === "approved" ||
            (includePending && l.status === "pending");
        if (counts) total += countLeaveDaysInYear(l, year);
    }
    return total;
}

// Is this employee on APPROVED leave on this date?
const isOnLeave = (userId, date) =>
    getLeaves().some(
        (l) =>
            l.userId === userId &&
            l.status === "approved" &&
            date >= l.from &&
            date <= l.to,
    );

// ---------- Employee side ----------
function renderLeaveBalance() {
    const user = getCurrentUser();
    const quota = Number(getCompany().yearlyLeaveQuota);
    const year = new Date().getFullYear();
    const used = getUsedLeaveDays(user.id, year, false);
    const pending = getUsedLeaveDays(user.id, year, true) - used;
    const left = Math.max(0, quota - used - pending);

    document.getElementById("leaveBalance").innerHTML = `
    <div class="mini-stats">
      <div class="mini"><b>${quota}</b><span>Yearly quota</span></div>
      <div class="mini"><b>${used}</b><span>Used</span></div>
      <div class="mini"><b>${left}</b><span>Available</span></div>
    </div>
    ${pending > 0 ? `<p class="small muted">${pending} day(s) are reserved by pending requests.</p>` : ""}`;
}

function handleApplyLeave() {
    const user = getCurrentUser();
    const type = document.getElementById("leaveType").value;
    const from = document.getElementById("leaveFrom").value;
    const to = document.getElementById("leaveTo").value;
    const reason = document.getElementById("leaveReason").value.trim();

    if (!from || !to || !reason) {
        showToast("Fill in dates and a reason.", "error");
        return;
    }
    if (to < from) {
        showToast("End date cannot be before start date.", "error");
        return;
    }
    if (from < todayStr()) {
        showToast("You cannot apply for leave in the past.", "error");
        return;
    }

    const days = countWorkingDays(from, to);
    if (days === 0) {
        showToast("Those dates are only weekends. No leave needed.", "warn");
        return;
    }

    // Overlap check against pending/approved leaves
    const clash = getLeaves().find(
        (l) =>
            l.userId === user.id &&
            l.status !== "rejected" &&
            from <= l.to &&
            to >= l.from,
    );
    if (clash) {
        showToast("You already have a leave request for these dates.", "error");
        return;
    }

    // Quota check, per year touched by the request
    const quota = Number(getCompany().yearlyLeaveQuota);
    const draft = { from, to };
    const years = [
        ...new Set([
            parseDate(from).getFullYear(),
            parseDate(to).getFullYear(),
        ]),
    ];
    for (let i = 0; i < years.length; i++) {
        const needed = countLeaveDaysInYear(draft, years[i]);
        const used = getUsedLeaveDays(user.id, years[i], true);
        if (used + needed > quota) {
            showToast(
                `Not enough balance for ${years[i]}: ${Math.max(0, quota - used)} day(s) left, you asked for ${needed}.`,
                "error",
            );
            return;
        }
    }

    const leaves = getLeaves();
    leaves.push({
        id: generateId("l_"),
        userId: user.id,
        userName: user.name,
        type,
        from,
        to,
        days,
        reason,
        status: "pending",
        adminComment: "",
        appliedOn: todayStr(),
        decidedOn: "",
    });
    saveLeaves(leaves);

    document.getElementById("leaveReason").value = "";
    showToast("Leave request submitted.");
    renderLeaveBalance();
    renderMyLeaves();
}

function renderMyLeaves() {
    const user = getCurrentUser();
    const list = getLeaves()
        .filter((l) => l.userId === user.id)
        .reverse();
    const body = document.getElementById("myLeavesBody");

    if (list.length === 0) {
        body.innerHTML = `<tr><td colspan="5" class="empty">No leave requests yet.</td></tr>`;
        return;
    }

    let rows = "";
    for (let i = 0; i < list.length; i++) {
        const l = list[i];
        rows += `
      <tr>
        <td>${l.type}<br><span class="small muted">${escapeHtml(l.reason)}</span></td>
        <td>${formatDate(l.from)}<br><span class="small muted">to ${formatDate(l.to)}</span></td>
        <td>${l.days}</td>
        <td><span class="badge b-${l.status}">${l.status}</span>
            ${l.adminComment ? `<br><span class="small muted">“${escapeHtml(l.adminComment)}”</span>` : ""}</td>
        <td>${l.status === "pending" ? `<button class="btn btn-ghost btn-sm" onclick="cancelLeave('${l.id}')">Cancel</button>` : ""}</td>
      </tr>`;
    }
    body.innerHTML = rows;
}

function cancelLeave(id) {
    if (!confirm("Cancel this leave request?")) return;
    saveLeaves(getLeaves().filter((l) => l.id !== id));
    showToast("Leave request cancelled.");
    renderLeaveBalance();
    renderMyLeaves();
}

// ---------- Admin side ----------
function renderAdminLeaves() {
    const filter = document.getElementById("leaveFilter").value;
    const all = getLeaves();

    document.getElementById("cntPending").textContent = all.filter(
        (l) => l.status === "pending",
    ).length;
    document.getElementById("cntApproved").textContent = all.filter(
        (l) => l.status === "approved",
    ).length;
    document.getElementById("cntRejected").textContent = all.filter(
        (l) => l.status === "rejected",
    ).length;

    const list = all
        .filter((l) => filter === "all" || l.status === filter)
        .reverse();
    const body = document.getElementById("leavesBody");

    if (list.length === 0) {
        body.innerHTML = `<tr><td colspan="6" class="empty">No leave requests found.</td></tr>`;
        return;
    }

    let rows = "";
    for (let i = 0; i < list.length; i++) {
        const l = list[i];
        const actions =
            l.status === "pending"
                ? `<button class="btn btn-success btn-sm" onclick="openDecision('${l.id}','approved')">Approve</button>
           <button class="btn btn-danger btn-sm" onclick="openDecision('${l.id}','rejected')">Reject</button>`
                : `<span class="small muted">${l.decidedOn ? "Decided " + l.decidedOn : ""}</span>`;
        rows += `
      <tr>
        <td><div class="cell-user"><div class="avatar sm">${initials(l.userName)}</div><div><b>${escapeHtml(l.userName)}</b><span>Applied ${l.appliedOn}</span></div></div></td>
        <td>${l.type}<br><span class="small muted">${escapeHtml(l.reason)}</span></td>
        <td>${formatDate(l.from)}<br><span class="small muted">to ${formatDate(l.to)}</span></td>
        <td>${l.days}</td>
        <td><span class="badge b-${l.status}">${l.status}</span>
            ${l.adminComment ? `<br><span class="small muted">“${escapeHtml(l.adminComment)}”</span>` : ""}</td>
        <td class="text-right">${actions}</td>
      </tr>`;
    }
    body.innerHTML = rows;
}

// Open the comment dialog for approve / reject
function openDecision(id, decision) {
    const leave = getLeaves().find((l) => l.id === id);
    document.getElementById("decisionId").value = id;
    document.getElementById("decisionType").value = decision;
    document.getElementById("decisionTitle").textContent =
        `${decision === "approved" ? "Approve" : "Reject"} leave: ${leave.userName}`;
    document.getElementById("decisionInfo").textContent =
        `${leave.type} leave, ${leave.from} to ${leave.to} (${leave.days} working day(s))`;
    document.getElementById("decisionComment").value = "";
    const btn = document.getElementById("decisionBtn");
    btn.textContent = decision === "approved" ? "Approve" : "Reject";
    btn.className =
        "btn " + (decision === "approved" ? "btn-success" : "btn-danger");
    openModal("decisionModal");
}

function submitDecision() {
    const id = document.getElementById("decisionId").value;
    const decision = document.getElementById("decisionType").value;
    const comment = document.getElementById("decisionComment").value.trim();

    if (decision === "rejected" && !comment) {
        showToast("Please add a comment explaining the rejection.", "error");
        return;
    }

    const leaves = getLeaves();
    const leave = leaves.find((l) => l.id === id);

    // Re-check the quota before approving (balance may have changed)
    if (decision === "approved") {
        const quota = Number(getCompany().yearlyLeaveQuota);
        const years = [
            ...new Set([
                parseDate(leave.from).getFullYear(),
                parseDate(leave.to).getFullYear(),
            ]),
        ];
        for (let i = 0; i < years.length; i++) {
            const used = getUsedLeaveDays(leave.userId, years[i], false);
            if (used + countLeaveDaysInYear(leave, years[i]) > quota) {
                showToast(
                    `Cannot approve: it would exceed the yearly quota (${quota} days).`,
                    "error",
                );
                return;
            }
        }
    }

    leave.status = decision;
    leave.adminComment = comment;
    leave.decidedOn = todayStr();
    saveLeaves(leaves);

    closeModal("decisionModal");
    showToast(`Leave ${decision}.`);
    renderAdminLeaves();
}
