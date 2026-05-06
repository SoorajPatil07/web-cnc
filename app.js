// =================== Arshita Enterprises - CNC Machine Tools ===================
// Plain JS app. Data is stored in localStorage (per-browser).

const ADMIN_PASSWORD = "admin123";

const KEYS = {
  tools: "cnc_tools",
  customers: "cnc_customers",
  orders: "cnc_orders",
  session: "cnc_admin_session",
  currentCustomer: "cnc_current_customer",
};

// ---------- storage helpers ----------
function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch { return []; }
}
function write(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    (Date.now().toString(36) + Math.random().toString(36).slice(2));
}

const tools = {
  list: () => read(KEYS.tools),
  add: (t) => { const arr = read(KEYS.tools); const item = { ...t, id: uid() }; arr.push(item); write(KEYS.tools, arr); return item; },
  update: (id, patch) => write(KEYS.tools, read(KEYS.tools).map(x => x.id === id ? { ...x, ...patch } : x)),
  remove: (id) => write(KEYS.tools, read(KEYS.tools).filter(x => x.id !== id)),
  get: (id) => read(KEYS.tools).find(x => x.id === id),
};
const customers = {
  list: () => read(KEYS.customers),
  add: (c) => { const arr = read(KEYS.customers); const item = { ...c, id: uid() }; arr.push(item); write(KEYS.customers, arr); return item; },
};
const orders = {
  list: () => read(KEYS.orders),
  add: (o) => { const arr = read(KEYS.orders); const item = { ...o, id: uid(), delivered: false, createdAt: new Date().toISOString() }; arr.push(item); write(KEYS.orders, arr); return item; },
  markDelivered: (id) => write(KEYS.orders, read(KEYS.orders).map(o => o.id === id ? { ...o, delivered: true } : o)),
  remove: (id) => write(KEYS.orders, read(KEYS.orders).filter(o => o.id !== id)),
};

// ---------- navigation ----------
function show(pageName) {
  document.querySelectorAll(".page").forEach(p => {
    p.classList.toggle("hidden", p.dataset.page !== pageName);
  });
  if (pageName === "order") renderCustomerTools();
  if (pageName === "admin") renderAdmin();
  window.scrollTo(0, 0);
}

document.addEventListener("click", (e) => {
  const navEl = e.target.closest("[data-nav]");
  if (navEl) { e.preventDefault(); show(navEl.dataset.nav); }
});

// ---------- customer flow ----------
function getCurrentCustomer() {
  try { return JSON.parse(localStorage.getItem(KEYS.currentCustomer) || "null"); }
  catch { return null; }
}
function setCurrentCustomer(c) { localStorage.setItem(KEYS.currentCustomer, JSON.stringify(c)); }

function initCustomerForm() {
  const form = document.getElementById("customer-form");
  const saved = document.getElementById("customer-saved");
  const existing = getCurrentCustomer();
  if (existing) {
    form.name.value = existing.name;
    form.contact.value = existing.contact;
    saved.textContent = `Saved as ${existing.name}`;
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const contact = form.contact.value.trim();
    if (!name || !contact) return;
    const customer = customers.add({ name, contact });
    setCurrentCustomer(customer);
    saved.textContent = `Saved as ${customer.name}`;
  });
}

function renderCustomerTools() {
  const wrap = document.getElementById("customer-tools-list");
  const list = tools.list();
  if (list.length === 0) { wrap.innerHTML = '<p class="empty">No tools available right now.</p>'; return; }
  wrap.innerHTML = list.map(t => `
    <div class="tool-card">
      <h3>${escapeHtml(t.name)}</h3>
      <p class="desc">${escapeHtml(t.description || "")}</p>
      <div class="tool-meta">
        <strong>₹${Number(t.price).toFixed(2)}</strong> · In stock: ${t.quantity}
      </div>
      <form class="order-form-row" data-order-tool="${t.id}">
        <input type="number" name="qty" min="1" max="${t.quantity}" placeholder="Qty" required ${t.quantity === 0 ? "disabled" : ""} />
        <input type="date" name="date" required ${t.quantity === 0 ? "disabled" : ""} />
        <button class="btn btn-primary btn-sm" type="submit" ${t.quantity === 0 ? "disabled" : ""}>${t.quantity === 0 ? "Out of stock" : "Order"}</button>
      </form>
    </div>
  `).join("");

  wrap.querySelectorAll("form[data-order-tool]").forEach(f => {
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const customer = getCurrentCustomer();
      if (!customer) { alert("Please save your name & contact first (above)."); return; }
      const toolId = f.dataset.orderTool;
      const tool = tools.get(toolId);
      if (!tool) return;
      const qty = parseInt(f.qty.value, 10);
      const date = f.date.value;
      if (!qty || qty <= 0 || qty > tool.quantity) { alert("Invalid quantity."); return; }
      orders.add({
        customerId: customer.id,
        customerName: customer.name,
        customerContact: customer.contact,
        toolId: tool.id,
        toolName: tool.name,
        quantity: qty,
        unitPrice: tool.price,
        total: qty * tool.price,
        deliveryDate: date,
      });
      tools.update(tool.id, { quantity: tool.quantity - qty });
      alert(`Order placed for ${qty} × ${tool.name}.`);
      renderCustomerTools();
    });
  });
}

// ---------- admin ----------
function isAdminLoggedIn() { return sessionStorage.getItem(KEYS.session) === "1"; }
function setAdminLoggedIn(v) {
  if (v) sessionStorage.setItem(KEYS.session, "1");
  else sessionStorage.removeItem(KEYS.session);
}

function renderAdmin() {
  const loginEl = document.getElementById("admin-login");
  const panelEl = document.getElementById("admin-panel");
  if (isAdminLoggedIn()) {
    loginEl.classList.add("hidden");
    panelEl.classList.remove("hidden");
    renderAdminTools();
    renderAdminOrders();
  } else {
    loginEl.classList.remove("hidden");
    panelEl.classList.add("hidden");
  }
}

function initAdmin() {
  // Login
  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const pwd = e.target.password.value;
    const err = document.getElementById("login-error");
    if (pwd === ADMIN_PASSWORD) { setAdminLoggedIn(true); err.textContent = ""; renderAdmin(); }
    else { err.textContent = "Incorrect password."; }
  });
  document.getElementById("logout-btn").addEventListener("click", () => { setAdminLoggedIn(false); renderAdmin(); });

  // Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll("[data-tab-panel]").forEach(p => {
        p.classList.toggle("hidden", p.dataset.tabPanel !== btn.dataset.tab);
      });
    });
  });

  // Tool form
  const toolForm = document.getElementById("tool-form");
  toolForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = toolForm.id.value;
    const data = {
      name: toolForm.name.value.trim(),
      description: toolForm.description.value.trim(),
      quantity: parseInt(toolForm.quantity.value, 10) || 0,
      price: parseFloat(toolForm.price.value) || 0,
    };
    if (!data.name) return;
    if (id) { tools.update(id, data); }
    else { tools.add(data); }
    resetToolForm();
    renderAdminTools();
  });
  document.getElementById("tool-cancel-btn").addEventListener("click", resetToolForm);
}

function resetToolForm() {
  const f = document.getElementById("tool-form");
  f.reset();
  f.id.value = "";
  document.getElementById("tool-form-title").textContent = "Add Tool";
  document.getElementById("tool-submit-btn").textContent = "Add Tool";
  document.getElementById("tool-cancel-btn").classList.add("hidden");
}

function renderAdminTools() {
  const wrap = document.getElementById("admin-tools-list");
  const list = tools.list();
  if (list.length === 0) { wrap.innerHTML = '<p class="empty">No tools yet. Add one above.</p>'; return; }
  wrap.innerHTML = `
    <div class="table-wrap"><table class="list-table">
      <thead><tr><th>Name</th><th>Description</th><th>Qty</th><th>Price</th><th>Actions</th></tr></thead>
      <tbody>
        ${list.map(t => `
          <tr>
            <td><strong>${escapeHtml(t.name)}</strong></td>
            <td>${escapeHtml(t.description || "")}</td>
            <td>${t.quantity}</td>
            <td>₹${Number(t.price).toFixed(2)}</td>
            <td class="row-actions">
              <button class="btn btn-ghost btn-sm" data-edit-tool="${t.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-del-tool="${t.id}">Delete</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table></div>`;
    btn.addEventListener("click", () => {
      const t = tools.get(btn.dataset.editTool); if (!t) return;
      const f = document.getElementById("tool-form");
      f.id.value = t.id;
      f.name.value = t.name;
      f.description.value = t.description || "";
      f.quantity.value = t.quantity;
      f.price.value = t.price;
      document.getElementById("tool-form-title").textContent = "Edit Tool";
      document.getElementById("tool-submit-btn").textContent = "Save Changes";
      document.getElementById("tool-cancel-btn").classList.remove("hidden");
      f.scrollIntoView({ behavior: "smooth" });
    });
  });
  wrap.querySelectorAll("[data-del-tool]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!confirm("Delete this tool?")) return;
      tools.remove(btn.dataset.delTool);
      renderAdminTools();
    });
  });
}

function renderAdminOrders() {
  const wrap = document.getElementById("admin-orders-list");
  const list = orders.list().slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (list.length === 0) { wrap.innerHTML = '<p class="empty">No orders yet.</p>'; return; }
  wrap.innerHTML = `
    <div class="table-wrap"><table class="list-table">
      <thead><tr>
        <th>Customer</th><th>Contact</th><th>Tool</th><th>Qty</th><th>Total</th><th>Delivery date</th><th>Status</th><th>Actions</th>
      </tr></thead>
      <tbody>
        ${list.map(o => `
          <tr>
            <td>${escapeHtml(o.customerName)}</td>
            <td>${escapeHtml(o.customerContact)}</td>
            <td>${escapeHtml(o.toolName)}</td>
            <td>${o.quantity}</td>
            <td>₹${Number(o.total).toFixed(2)}</td>
            <td>${escapeHtml(o.deliveryDate || "-")}</td>
            <td>${o.delivered ? '<span class="delivered-badge">Delivered</span>' : '<span class="pending-badge">Pending</span>'}</td>
            <td class="row-actions">
              ${!o.delivered ? `<button class="btn btn-success btn-sm" data-deliver="${o.id}">Mark Delivered</button>` : ""}
              ${o.delivered ? `<button class="btn btn-danger btn-sm" data-del-order="${o.id}">Delete</button>` : ""}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table></div>`;
  wrap.querySelectorAll("[data-deliver]").forEach(btn => {
    btn.addEventListener("click", () => { orders.markDelivered(btn.dataset.deliver); renderAdminOrders(); });
  });
  wrap.querySelectorAll("[data-del-order]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!confirm("Delete this order?")) return;
      orders.remove(btn.dataset.delOrder);
      renderAdminOrders();
    });
  });
}

// ---------- utils ----------
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- boot ----------
document.getElementById("year").textContent = new Date().getFullYear();
initCustomerForm();
initAdmin();
show("home");
