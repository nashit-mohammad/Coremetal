const dashboardEndpoint = window.COREMETAL_CONFIG?.dashboardFunctionUrl ?? "";
const tokenStorageKey = "coremetal-staff-session";
const app = document.querySelector("#staff-app");
const validStatuses = new Set(["open", "contacted", "closed"]);
let currentUser = null;
let enquiries = [];
let staffUsers = [];
let statusFilter = "all";
let searchTerm = "";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
}

function showMessage(message, kind = "error") {
  const notice = document.querySelector("#staff-notice");
  if (!notice) return;
  notice.textContent = message;
  notice.className = `staff-notice is-visible ${kind}`;
}

function clearMessage() {
  const notice = document.querySelector("#staff-notice");
  if (notice) notice.className = "staff-notice";
}

function saveToken(token) {
  try {
    sessionStorage.setItem(tokenStorageKey, token);
  } catch (error) {
    console.error("The staff sign-in could not be stored for this tab:", error);
    throw new Error("This browser cannot store a secure staff session. Enable session storage and try again.");
  }
}

function readToken() {
  try {
    return sessionStorage.getItem(tokenStorageKey) ?? "";
  } catch (error) {
    console.error("Could not access the staff session in this tab:", error);
    throw new Error("This browser cannot access a staff session. Enable session storage and try again.");
  }
}

function clearToken() {
  try {
    sessionStorage.removeItem(tokenStorageKey);
  } catch (error) {
    console.error("Could not clear the staff session from this tab:", error);
  }
}

async function request(action, values = {}, {authenticated = true} = {}) {
  if (!dashboardEndpoint) {
    throw new Error("The staff dashboard endpoint is not configured. Contact the website administrator.");
  }
  const headers = {"Content-Type": "application/json"};
  const token = authenticated ? readToken() : "";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(dashboardEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({action, ...values}),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Could not reach the staff dashboard service:", error);
    throw new Error("The secure dashboard service could not be reached. Check your connection and try again.");
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    console.error("The staff dashboard returned an invalid response:", error);
    throw new Error("The dashboard returned an unexpected response. Please try again.");
  }
  if (!response.ok) {
    if (response.status === 401 && authenticated) clearToken();
    throw new Error(typeof result.error === "string" ? result.error : "The request could not be completed.");
  }
  return result;
}

function commonFrame(content) {
  return `
    <header class="staff-header">
      <a class="staff-brand" href="index.html" aria-label="Core Metal website">
        <span class="brand-icon" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="brand-name">core<span>metal</span><small>STAFF WORKSPACE</small></span>
      </a>
      ${currentUser ? `
        <div class="staff-account">
          <span class="staff-account-email">${escapeHtml(currentUser.email)}</span>
          <span class="staff-role">${currentUser.role === "admin" ? "Administrator" : "Staff"}</span>
          <button class="staff-text-button staff-account-password" type="button" data-action="change-account-password">Change password</button>
          <button class="button button-outline-staff" type="button" data-action="logout">Sign out</button>
        </div>
      ` : `<a class="staff-public-link" href="index.html">View public website</a>`}
    </header>
    <div id="staff-notice" class="staff-notice" role="status" aria-live="polite"></div>
    ${content}
    <footer class="staff-footer">Core Metal L.L.C. · Private staff workspace</footer>
  `;
}

function loginView(initialized = true) {
  document.title = initialized
    ? "Staff sign in | Core Metal"
    : "Set up staff access | Core Metal";
  app.innerHTML = commonFrame(`
    <section class="staff-auth-grid" aria-labelledby="staff-title">
      <div class="staff-intro">
        <span class="eyebrow"><span class="eyebrow-line"></span>CORE METAL STAFF</span>
        <h1 id="staff-title">${initialized ? "Enquiries, in good hands." : "Set up administrator access."}</h1>
        <p>${initialized
          ? "Sign in to review new customer enquiries, coordinate follow-up and keep each request moving."
          : "The dashboard is ready for its first administrators. Setup is restricted to the addresses configured by your system administrator."}</p>
        <div class="staff-security-note"><span aria-hidden="true">✓</span> Private workspace · Password-protected · Enquiry data stays out of the public site</div>
      </div>
      <div class="staff-auth-card">
        ${initialized ? `
          <h2>Staff sign in</h2>
          <p>Use the account and initial password provided by a Core Metal administrator.</p>
          <form id="staff-login-form" class="staff-form" novalidate>
            <label>Email address<input name="email" type="email" autocomplete="username" maxlength="254" required></label>
            <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
            <button class="button button-dark staff-submit" type="submit">Sign in to enquiries <span aria-hidden="true">→</span></button>
          </form>
          <button class="staff-text-button" type="button" data-action="show-bootstrap">First-time administrator setup</button>
        ` : `
          <h2>Initial administrator setup</h2>
          <p>Enter the one-time setup secret and an initial password for each of the three configured administrators. Each person will change their initial password when signing in.</p>
          <form id="staff-bootstrap-form" class="staff-form" novalidate>
            <label>One-time setup secret<input name="bootstrapSecret" type="password" autocomplete="off" required></label>
            ${[1, 2, 3].map(number => `
              <fieldset class="staff-bootstrap-user">
                <legend>Administrator ${number}</legend>
                <label>Email address<input name="email${number}" type="email" autocomplete="off" maxlength="254" required></label>
                <label>Initial password <span>14–72 characters</span><input name="password${number}" type="password" autocomplete="new-password" minlength="14" maxlength="72" required></label>
              </fieldset>
            `).join("")}
            <button class="button button-dark staff-submit" type="submit">Create administrator accounts</button>
          </form>
          <button class="staff-text-button" type="button" data-action="show-login">Return to staff sign in</button>
        `}
      </div>
    </section>
  `);
  clearMessage();
  attachGlobalActions();
  document.querySelector("#staff-login-form")?.addEventListener("submit", signIn);
  document.querySelector("#staff-bootstrap-form")?.addEventListener("submit", bootstrapAdministrators);
}

async function signIn(event) {
  event.preventDefault();
  clearMessage();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const data = new FormData(form);
    const result = await request("login", {
      email: data.get("email"),
      password: data.get("password"),
    }, {authenticated: false});
    saveToken(result.token);
    currentUser = result.user;
    await loadWorkspace();
  } catch (error) {
    showMessage(error.message);
  } finally {
    if (submit.isConnected) submit.disabled = false;
  }
}

async function bootstrapAdministrators(event) {
  event.preventDefault();
  clearMessage();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  const data = new FormData(form);
  const admins = [1, 2, 3].map(number => ({
    email: data.get(`email${number}`),
    password: data.get(`password${number}`),
  }));
  if (admins.some(admin => typeof admin.password !== "string" || admin.password.length < 14 || admin.password.length > 72)) {
    showMessage("Use an initial password between 14 and 72 characters for each administrator.");
    return;
  }

  submit.disabled = true;
  try {
    await request("bootstrap", {
      bootstrapSecret: data.get("bootstrapSecret"),
      admins,
    }, {authenticated: false});
    form.reset();
    loginView(true);
    showMessage("Administrator accounts are ready. Share each initial password securely; it must be changed at first sign-in.", "success");
  } catch (error) {
    showMessage(error.message);
  } finally {
    if (submit.isConnected) submit.disabled = false;
  }
}

function passwordChangeView(initial = false, resetEmail = "") {
  document.title = initial ? "Change initial password | Core Metal" : "Change password | Core Metal";
  app.innerHTML = commonFrame(`
    <section class="staff-password-card">
      <span class="eyebrow"><span class="eyebrow-line"></span>ACCOUNT SECURITY</span>
      <h1>${initial ? "Choose your private password." : "Change your password."}</h1>
      <p>${initial
        ? "For your security, change the initial password provided by your administrator before you continue."
        : "Use a new passphrase between 14 and 72 characters. Other signed-in sessions will be signed out."}</p>
      <form id="staff-password-form" class="staff-form" novalidate>
        ${initial ? "" : `<label>Current password<input name="currentPassword" type="password" autocomplete="current-password" required></label>`}
        ${resetEmail ? `<p class="staff-reset-target">Account: <strong>${escapeHtml(resetEmail)}</strong></p>` : ""}
        <label>New password or passphrase<input name="newPassword" type="password" autocomplete="new-password" minlength="14" maxlength="72" required><span>14–72 characters.</span></label>
        <label>Confirm new password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="14" maxlength="72" required></label>
        <button class="button button-dark staff-submit" type="submit">Save new password</button>
      </form>
      ${initial ? "" : `<button class="staff-text-button" type="button" data-action="return-dashboard">Return to dashboard</button>`}
    </section>
  `);
  clearMessage();
  attachGlobalActions();
  document.querySelector("#staff-password-form")?.addEventListener("submit", changePassword);
}

async function changePassword(event) {
  event.preventDefault();
  clearMessage();
  const form = event.currentTarget;
  const data = new FormData(form);
  const newPassword = data.get("newPassword");
  if (newPassword !== data.get("confirmPassword")) {
    showMessage("The new password and confirmation do not match.");
    return;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await request("change-password", {
      currentPassword: data.get("currentPassword") || undefined,
      newPassword,
    });
    currentUser.must_change_password = false;
    await loadWorkspace();
    showMessage("Your password has been updated.", "success");
  } catch (error) {
    showMessage(error.message);
  } finally {
    if (submit.isConnected) submit.disabled = false;
  }
}

function statusBadge(status) {
  const labels = {open: "Open", contacted: "Contacted", closed: "Closed"};
  const safeStatus = validStatuses.has(status) ? status : "open";
  return `<span class="staff-status-badge status-${safeStatus}">${labels[safeStatus]}</span>`;
}

function enquiryCard(enquiry) {
  const items = Array.isArray(enquiry.items) ? enquiry.items : [];
  const itemList = items.length
    ? `<ul class="staff-product-list">${items.map(item => `
      <li><span>${escapeHtml(item.name)} <small>${escapeHtml(item.category)}</small></span><strong>Qty ${escapeHtml(item.quantity)}</strong></li>
    `).join("")}</ul>`
    : "";
  const details = enquiry.project_details
    ? `<div class="staff-detail-block"><span>Project details</span><p>${escapeHtml(enquiry.project_details)}</p></div>`
    : "";
  const phone = enquiry.phone
    ? `<a href="tel:${encodeURIComponent(enquiry.phone)}">${escapeHtml(enquiry.phone)}</a>`
    : `<span class="staff-no-value">No phone provided</span>`;

  return `
    <article class="staff-enquiry-card" data-enquiry-id="${escapeHtml(enquiry.id)}">
      <div class="staff-enquiry-top">
        <div>
          <span class="staff-request-type">${enquiry.request_type === "quote" ? "QUOTATION REQUEST" : "GENERAL ENQUIRY"}</span>
          <h2>${escapeHtml(enquiry.subject)}</h2>
          <span class="staff-date">${formatDate(enquiry.created_at)}</span>
        </div>
        <label class="staff-status-control"><span>Status</span>
          <select data-action="update-status" aria-label="Update status for ${escapeHtml(enquiry.subject)}">
            ${[["open", "Open"], ["contacted", "Contacted"], ["closed", "Closed"]].map(([value, label]) =>
              `<option value="${value}"${enquiry.status === value ? " selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="staff-enquiry-body">
        <div class="staff-contact-data">
          <strong>${escapeHtml(enquiry.name)}</strong>
          <a href="mailto:${encodeURIComponent(enquiry.email)}">${escapeHtml(enquiry.email)}</a>
          ${phone}
        </div>
        ${enquiry.message ? `<div class="staff-detail-block"><span>Message</span><p>${escapeHtml(enquiry.message)}</p></div>` : ""}
        ${details}
        ${itemList ? `<div class="staff-detail-block"><span>Products requested</span>${itemList}</div>` : ""}
      </div>
      <div class="staff-enquiry-bottom">${statusBadge(enquiry.status)}<span>Last updated ${formatDate(enquiry.updated_at || enquiry.created_at)}</span></div>
    </article>
  `;
}

function filteredEnquiries() {
  const query = searchTerm.trim().toLowerCase();
  return enquiries.filter(enquiry => {
    const matchesStatus = statusFilter === "all" || enquiry.status === statusFilter;
    const searchable = [
      enquiry.name,
      enquiry.email,
      enquiry.phone,
      enquiry.subject,
      enquiry.message,
      enquiry.project_details,
      ...(Array.isArray(enquiry.items) ? enquiry.items.map(item => item.name) : []),
    ].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && (!query || searchable.includes(query));
  });
}

function generateInitialPassword(length = 20) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  let password = "";
  while (password.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length - password.length + 8));
    for (const byte of bytes) {
      if (byte < limit) password += alphabet[byte % alphabet.length];
      if (password.length === length) break;
    }
  }
  return password;
}

function enhanceInitialPasswordField() {
  const form = document.querySelector("#staff-create-user-form");
  const input = form?.querySelector('input[name="password"]');
  if (!input) return;

  const controls = document.createElement("span");
  controls.className = "staff-password-entry";
  if (!input.id) input.id = "staff-create-user-password";
  input.replaceWith(controls);
  controls.append(input);

  const generate = document.createElement("button");
  generate.className = "staff-small-button";
  generate.type = "button";
  generate.textContent = "Generate";
  generate.setAttribute("aria-label", "Generate a secure initial password");
  generate.addEventListener("click", () => {
    input.value = generateInitialPassword();
    input.type = "text";
    toggle.textContent = "Hide";
    toggle.setAttribute("aria-pressed", "true");
    input.focus();
    input.select();
  });

  const toggle = document.createElement("button");
  toggle.className = "staff-small-button";
  toggle.type = "button";
  toggle.textContent = "Show";
  toggle.setAttribute("aria-controls", input.id || "");
  toggle.setAttribute("aria-pressed", "false");
  toggle.addEventListener("click", () => {
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    toggle.textContent = reveal ? "Hide" : "Show";
    toggle.setAttribute("aria-pressed", String(reveal));
  });
  controls.append(generate, toggle);
}

function enquiryView() {
  const openCount = enquiries.filter(item => item.status === "open").length;
  const contactedCount = enquiries.filter(item => item.status === "contacted").length;
  const closedCount = enquiries.filter(item => item.status === "closed").length;
  const visible = filteredEnquiries();
  app.innerHTML = commonFrame(`
    <section class="staff-dashboard">
      <div class="staff-page-heading">
        <div>
          <span class="eyebrow"><span class="eyebrow-line"></span>INQUIRY MANAGEMENT</span>
          <h1>Customer enquiries</h1>
          <p>One clear view of every request, from first contact through to resolution.</p>
        </div>
        <button class="button button-outline-staff" type="button" data-action="refresh">Refresh enquiries</button>
      </div>
      <div class="staff-stats" aria-label="Enquiry counts">
        <button class="staff-stat${statusFilter === "open" ? " is-selected" : ""}" data-filter="open" type="button"><span>Open</span><strong>${openCount}</strong><small>Need follow-up</small></button>
        <button class="staff-stat${statusFilter === "contacted" ? " is-selected" : ""}" data-filter="contacted" type="button"><span>Contacted</span><strong>${contactedCount}</strong><small>In progress</small></button>
        <button class="staff-stat${statusFilter === "closed" ? " is-selected" : ""}" data-filter="closed" type="button"><span>Closed</span><strong>${closedCount}</strong><small>Resolved</small></button>
        <button class="staff-stat${statusFilter === "all" ? " is-selected" : ""}" data-filter="all" type="button"><span>All enquiries</span><strong>${enquiries.length}</strong><small>Customer requests</small></button>
      </div>
      <div class="staff-list-heading">
        <h2>${statusFilter === "all" ? "All enquiries" : `${statusFilter[0].toUpperCase()}${statusFilter.slice(1)} enquiries`} <span>${visible.length}</span></h2>
        <label class="staff-search">Search enquiries<input id="staff-search" type="search" value="${escapeHtml(searchTerm)}" placeholder="Name, email or subject" autocomplete="off"></label>
      </div>
      <div id="staff-enquiry-list" class="staff-enquiry-list">
        ${visible.length
          ? visible.map(enquiryCard).join("")
          : `<div class="staff-empty"><span aria-hidden="true">✓</span><h3>${enquiries.length ? "Nothing matches this view." : "No enquiries yet."}</h3><p>${enquiries.length ? "Try another status filter or search term." : "New website enquiries will appear here automatically."}</p></div>`}
      </div>
      ${currentUser.role === "admin" ? usersPanel() : ""}
    </section>
  `);
  clearMessage();
  attachGlobalActions();
  document.querySelector("#staff-search")?.addEventListener("input", event => {
    searchTerm = event.currentTarget.value;
    const selectionStart = event.currentTarget.selectionStart;
    const selectionEnd = event.currentTarget.selectionEnd;
    enquiryView();
    const input = document.querySelector("#staff-search");
    input.focus();
    input.setSelectionRange(selectionStart, selectionEnd);
  });
  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      statusFilter = button.dataset.filter;
      enquiryView();
    });
  });
  document.querySelectorAll('[data-action="update-status"]').forEach(select => {
    select.addEventListener("change", updateStatus);
  });
  document.querySelector("#staff-create-user-form")?.addEventListener("submit", createUser);
  enhanceInitialPasswordField();
  document.querySelectorAll('[data-action="reset-user"]').forEach(form => {
    form.addEventListener("submit", resetUserPassword);
  });
  document.querySelectorAll('[data-action="toggle-user"]').forEach(button => {
    button.addEventListener("click", toggleUserAccess);
  });
}

function usersPanel() {
  return `
    <section class="staff-users" aria-labelledby="staff-users-title">
      <div class="staff-list-heading">
        <div><span class="eyebrow"><span class="eyebrow-line"></span>ADMINISTRATOR TOOLS</span><h2 id="staff-users-title">Manage staff access</h2></div>
        <span class="staff-user-count">${staffUsers.length} ${staffUsers.length === 1 ? "account" : "accounts"}</span>
      </div>
      <form id="staff-create-user-form" class="staff-create-user staff-form" novalidate>
        <label>Email address<input name="email" type="email" autocomplete="off" maxlength="254" required></label>
        <label>Initial password<input name="password" type="password" autocomplete="new-password" minlength="14" maxlength="72" required><span>14–72 characters</span></label>
        <label>Access level<select name="role"><option value="staff">Staff</option><option value="admin">Administrator</option></select></label>
        <button class="button button-dark" type="submit">Create account</button>
      </form>
      <p class="staff-management-note">Share initial passwords securely. New accounts must change their password at first sign-in.</p>
      <div class="staff-user-list">
        ${staffUsers.map(user => `
          <article class="staff-user-row">
            <div class="staff-user-info"><strong>${escapeHtml(user.email)}</strong><span>${user.role === "admin" ? "Administrator" : "Staff"} · ${user.is_active ? "Active" : "Access disabled"}${user.must_change_password ? " · Initial password pending" : ""}</span></div>
            ${user.email === currentUser.email
              ? `<span class="staff-user-self">Your account · manage your own password above</span>`
              : `<form class="staff-reset-form" data-action="reset-user" data-user-id="${escapeHtml(user.id)}">
                <label class="visually-hidden" for="reset-${escapeHtml(user.id)}">New initial password for ${escapeHtml(user.email)}</label>
                <input id="reset-${escapeHtml(user.id)}" name="password" type="password" autocomplete="new-password" minlength="14" maxlength="72" placeholder="New initial password" required>
                <button class="staff-small-button" type="submit">Reset password</button>
              </form>`}
            ${user.email === currentUser.email ? "" : `<button class="staff-small-button${user.is_active ? " is-danger" : ""}" data-action="toggle-user" data-user-id="${escapeHtml(user.id)}" data-active="${user.is_active ? "true" : "false"}" type="button">${user.is_active ? "Disable access" : "Enable access"}</button>`}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

async function loadWorkspace() {
  if (currentUser?.must_change_password) {
    passwordChangeView(true);
    return;
  }
  const [enquiryResult, userResult] = await Promise.all([
    request("list-enquiries"),
    currentUser?.role === "admin" ? request("list-users") : Promise.resolve({users: []}),
  ]);
  enquiries = Array.isArray(enquiryResult.enquiries)
    ? enquiryResult.enquiries.filter(item =>
      item && typeof item.id === "string" && validStatuses.has(item.status))
    : [];
  staffUsers = Array.isArray(userResult.users) ? userResult.users : [];
  enquiryView();
}

async function updateStatus(event) {
  clearMessage();
  const select = event.currentTarget;
  const card = select.closest("[data-enquiry-id]");
  if (!card || !validStatuses.has(select.value)) return;
  const previous = enquiries.find(item => item.id === card.dataset.enquiryId)?.status;
  select.disabled = true;
  try {
    const result = await request("update-status", {
      enquiryId: card.dataset.enquiryId,
      status: select.value,
    });
    enquiries = enquiries.map(item => item.id === result.enquiry.id ? result.enquiry : item);
    enquiryView();
    showMessage("Enquiry status updated.", "success");
  } catch (error) {
    showMessage(error.message);
    select.value = previous ?? "open";
    select.disabled = false;
  }
}

async function createUser(event) {
  event.preventDefault();
  clearMessage();
  const form = event.currentTarget;
  const data = new FormData(form);
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await request("create-user", {
      email: data.get("email"),
      password: data.get("password"),
      role: data.get("role"),
    });
    await loadWorkspace();
    showMessage("Staff account created. Share the initial password securely; it must be changed at first sign-in.", "success");
  } catch (error) {
    showMessage(error.message);
  } finally {
    if (submit.isConnected) submit.disabled = false;
  }
}

async function resetUserPassword(event) {
  event.preventDefault();
  clearMessage();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  const password = new FormData(form).get("password");
  submit.disabled = true;
  try {
    await request("reset-user-password", {
      userId: form.dataset.userId,
      password,
    });
    await loadWorkspace();
    showMessage("Initial password reset. Share it securely; the user will change it at their next sign-in.", "success");
  } catch (error) {
    showMessage(error.message);
  } finally {
    if (submit.isConnected) submit.disabled = false;
  }
}

async function toggleUserAccess(event) {
  const button = event.currentTarget;
  const active = button.dataset.active !== "true";
  const verb = active ? "enable" : "disable";
  if (!window.confirm(`Are you sure you want to ${verb} this staff account?${active ? "" : " Existing sessions will be signed out."}`)) {
    return;
  }
  clearMessage();
  button.disabled = true;
  try {
    await request("set-user-active", {
      userId: button.dataset.userId,
      active,
    });
    await loadWorkspace();
    showMessage(`Staff account ${active ? "enabled" : "disabled"}.`, "success");
  } catch (error) {
    showMessage(error.message);
    button.disabled = false;
  }
}

async function signOut() {
  try {
    await request("logout");
  } catch (error) {
    console.error("The server could not revoke the staff session during sign-out:", error);
  } finally {
    clearToken();
    currentUser = null;
    enquiries = [];
    staffUsers = [];
    loginView(true);
    showMessage("You have been signed out.", "success");
  }
}

function attachGlobalActions() {
  document.querySelectorAll('[data-action="logout"]').forEach(button => {
    button.addEventListener("click", signOut);
  });
  document.querySelector('[data-action="refresh"]')?.addEventListener("click", async () => {
    const button = document.querySelector('[data-action="refresh"]');
    button.disabled = true;
    try {
      await loadWorkspace();
      showMessage("Enquiries refreshed.", "success");
    } catch (error) {
      showMessage(error.message);
    } finally {
      const refreshed = document.querySelector('[data-action="refresh"]');
      if (refreshed) refreshed.disabled = false;
    }
  });
  document.querySelector('[data-action="show-bootstrap"]')?.addEventListener("click", () => loginView(false));
  document.querySelector('[data-action="show-login"]')?.addEventListener("click", () => loginView(true));
  document.querySelector('[data-action="return-dashboard"]')?.addEventListener("click", loadWorkspace);
  document.querySelector('[data-action="change-account-password"]')?.addEventListener("click", () => {
    passwordChangeView(false);
  });
}

async function initialise() {
  document.title = "Staff sign in | Core Metal";
  if (!dashboardEndpoint) {
    loginView(true);
    showMessage("The staff dashboard is not configured. Contact the website administrator.");
    return;
  }
  const token = readToken();
  if (!token) {
    try {
      const result = await request("bootstrap-status", {}, {authenticated: false});
      loginView(result.initialized !== false);
    } catch (error) {
      loginView(true);
      showMessage(error.message);
    }
    return;
  }

  try {
    const result = await request("session");
    currentUser = result.user;
    await loadWorkspace();
  } catch (error) {
    clearToken();
    currentUser = null;
    loginView(true);
    showMessage(error.message);
  }
}

initialise().catch(error => {
  console.error("Could not initialize the Core Metal staff dashboard:", error);
  app.innerHTML = `<section class="staff-auth-card"><h1>Dashboard unavailable</h1><p>${escapeHtml(error.message)}</p><a class="button button-dark" href="staff.html">Try again</a></section>`;
});
