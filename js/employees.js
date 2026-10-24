/* ==========================================================
   employees.js - Admin: add, edit, delete, search, filter employees
   ========================================================== */

const getEmployees = () => getUsers().filter((u) => u.role === "employee");

// Rebuild the department filter, keeping the current selection
function populateDeptFilter() {
    const select = document.getElementById("deptFilter");
    const current = select.value || "all";
    const departments = [
        ...new Set(
            getEmployees()
                .map((e) => e.department)
                .filter((d) => d),
        ),
    ].sort();

    let html = `<option value="all">All departments</option>`;
    for (let i = 0; i < departments.length; i++) {
        html += `<option value="${escapeHtml(departments[i])}">${escapeHtml(departments[i])}</option>`;
    }
    select.innerHTML = html;
    select.value = departments.includes(current) ? current : "all";

    // Suggestions inside the add/edit form
    document.getElementById("deptList").innerHTML = departments
        .map((d) => `<option value="${escapeHtml(d)}">`)
        .join("");
}

// Draw the employee table using the current search + filter
function renderEmployees() {
    populateDeptFilter();
    const query = document
        .getElementById("searchInput")
        .value.trim()
        .toLowerCase();
    const dept = document.getElementById("deptFilter").value;

    const list = getEmployees().filter((e) => {
        const matchesDept = dept === "all" || e.department === dept;
        const haystack =
            `${e.name} ${e.email} ${e.department} ${e.designation}`.toLowerCase();
        return matchesDept && haystack.includes(query);
    });

    document.getElementById("empCount").textContent =
        `${list.length} employee(s)`;
    const body = document.getElementById("empBody");

    if (list.length === 0) {
        body.innerHTML = `<tr><td colspan="6" class="empty">No employees found.</td></tr>`;
        return;
    }

    let rows = "";
    for (let i = 0; i < list.length; i++) {
        const e = list[i];
        rows += `
      <tr>
        <td><div class="cell-user"><div class="avatar sm">${initials(e.name)}</div>
          <div><b>${escapeHtml(e.name)}</b><span>${escapeHtml(e.email)}</span></div></div></td>
        <td>${escapeHtml(e.department || "—")}</td>
        <td>${escapeHtml(e.designation || "—")}</td>
        <td>${formatMoney(e.salary)}</td>
        <td>${formatDate(e.joinDate)}</td>
        <td class="text-right">
          <button class="btn btn-ghost btn-sm" onclick="openEmployeeModal('${e.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${e.id}')">Delete</button>
        </td>
      </tr>`;
    }
    body.innerHTML = rows;
}

// Open the modal empty (add) or filled (edit)
function openEmployeeModal(id) {
    const emp = id ? getUsers().find((u) => u.id === id) : null;
    document.getElementById("empModalTitle").textContent = emp
        ? "Edit Employee"
        : "Add Employee";
    document.getElementById("empId").value = emp ? emp.id : "";
    document.getElementById("empName").value = emp ? emp.name : "";
    document.getElementById("empEmail").value = emp ? emp.email : "";
    document.getElementById("empPassword").value = "";
    document.getElementById("empPassword").placeholder = emp
        ? "Leave blank to keep current"
        : "Min 6 characters";
    document.getElementById("empDept").value = emp ? emp.department : "";
    document.getElementById("empDesignation").value = emp
        ? emp.designation
        : "";
    document.getElementById("empSalary").value = emp ? emp.salary : "";
    document.getElementById("empJoin").value = emp ? emp.joinDate : todayStr();
    openModal("empModal");
}

// Create or update, depending on the hidden id field
function saveEmployee() {
    const id = document.getElementById("empId").value;
    const name = document.getElementById("empName").value.trim();
    const email = document
        .getElementById("empEmail")
        .value.trim()
        .toLowerCase();
    const password = document.getElementById("empPassword").value;
    const department = document.getElementById("empDept").value.trim();
    const designation = document.getElementById("empDesignation").value.trim();
    const salary = Number(document.getElementById("empSalary").value);
    const joinDate = document.getElementById("empJoin").value;

    if (
        !name ||
        !email ||
        !department ||
        !joinDate ||
        !(salary >= 0) ||
        document.getElementById("empSalary").value === ""
    ) {
        showToast(
            "Name, email, department, salary and join date are required.",
            "error",
        );
        return;
    }

    const users = getUsers();
    const duplicate = users.find(
        (u) => u.email.toLowerCase() === email && u.id !== id,
    );
    if (duplicate) {
        showToast("That email is already in use.", "error");
        return;
    }

    if (id) {
        // ----- Edit -----
        const user = users.find((u) => u.id === id);
        user.name = name;
        user.email = email;
        user.department = department;
        user.designation = designation;
        user.salary = salary;
        user.joinDate = joinDate;
        if (password) {
            if (password.length < 6) {
                showToast("Password must be at least 6 characters.", "error");
                return;
            }
            user.password = hashPassword(password);
        }
        showToast("Employee updated.");
    } else {
        // ----- Add -----
        if (password.length < 6) {
            showToast("Password must be at least 6 characters.", "error");
            return;
        }
        users.push({
            id: generateId("u_"),
            name,
            email,
            department,
            designation,
            salary,
            joinDate,
            password: hashPassword(password),
            role: "employee",
        });
        showToast("Employee added.");
    }

    saveUsers(users);
    closeModal("empModal");
    renderEmployees();
}

// Delete an employee together with their attendance and leave records
function deleteEmployee(id) {
    const emp = getUsers().find((u) => u.id === id);
    if (
        !emp ||
        !confirm(
            `Delete ${emp.name}? Their attendance and leave records will also be removed.`,
        )
    )
        return;

    saveUsers(getUsers().filter((u) => u.id !== id));
    saveAttendance(getAttendance().filter((r) => r.userId !== id));
    saveLeaves(getLeaves().filter((l) => l.userId !== id));
    showToast("Employee deleted.");
    renderEmployees();
}
