const STORAGE_KEY = "streamvault-panel:v1";

const DEFAULT_SERVICES = [
  "Netflix original",
  "Netflix genérico",
  "Disney Premium",
  "Max Platino",
  "Prime Video",
  "Vix",
  "Paramount",
  "Crunchyroll",
  "Spotify",
  "Apple TV",
  "YouTube Premium",
  "Combo Nova",
  "Combo Eclipse",
  "Combo Órbita",
  "Combo Fusión",
  "Combo Beat",
  "Combo Aurora",
  "Otro"
];

const DEFAULT_PAYMENTS = [
  "Transferencia",
  "Oxxo",
  "Mercado Pago",
  "Efectivo"
];

const STATUS_LABELS = {
  active: "Activo",
  due: "Por vencer",
  expired: "Vencido",
  cancelled: "Cancelado"
};

const state = loadState();
let deferredInstallPrompt = null;

const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0
}).format(Number(value || 0));

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      clients: Array.isArray(saved?.clients) ? saved.clients : [],
      paymentMethods: Array.isArray(saved?.paymentMethods) && saved.paymentMethods.length
        ? saved.paymentMethods
        : DEFAULT_PAYMENTS
    };
  } catch {
    return { clients: [], paymentMethods: DEFAULT_PAYMENTS };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seedSelects() {
  const serviceSelect = $("#service");
  serviceSelect.innerHTML = DEFAULT_SERVICES
    .map((service) => `<option value="${escapeHtml(service)}">${escapeHtml(service)}</option>`)
    .join("");

  refreshPaymentSelects();
}

function refreshPaymentSelects() {
  const paymentOptions = state.paymentMethods
    .map((method) => `<option value="${escapeHtml(method)}">${escapeHtml(method)}</option>`)
    .join("");

  $("#payment").innerHTML = paymentOptions;
  $("#paymentMethodsInput").value = state.paymentMethods.join(", ");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseLocalDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysUntil(dateValue) {
  const target = parseLocalDate(dateValue);
  if (!target) return 9999;
  const today = parseLocalDate(todayISO());
  return Math.ceil((target - today) / 86400000);
}

function isCurrentMonth(dateValue) {
  const date = parseLocalDate(dateValue);
  const now = new Date();
  return Boolean(date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth());
}

function computedStatus(client) {
  if (client.status === "cancelled") return "cancelled";
  const days = daysUntil(client.renewalDate);
  if (days < 0) return "expired";
  if (days <= 3) return "due";
  return client.status || "active";
}

function getFormData() {
  const price = Number($("#price").value || 0);
  const cost = Number($("#cost").value || 0);
  return {
    id: $("#clientId").value || crypto.randomUUID(),
    name: $("#name").value.trim(),
    phone: $("#phone").value.trim(),
    service: $("#service").value,
    plan: $("#plan").value.trim(),
    price,
    cost,
    payment: $("#payment").value,
    renewalDate: $("#renewalDate").value,
    status: $("#status").value,
    notes: $("#notes").value.trim(),
    createdAt: new Date().toISOString()
  };
}

function setFormData(client) {
  $("#clientId").value = client.id;
  $("#name").value = client.name || "";
  $("#phone").value = client.phone || "";
  $("#service").value = client.service || DEFAULT_SERVICES[0];
  $("#plan").value = client.plan || "";
  $("#price").value = client.price || "";
  $("#cost").value = client.cost || "";
  $("#payment").value = client.payment || state.paymentMethods[0];
  $("#renewalDate").value = client.renewalDate || todayISO();
  $("#status").value = client.status || "active";
  $("#notes").value = client.notes || "";
}

function clearForm() {
  $("#clientForm").reset();
  $("#clientId").value = "";
  $("#renewalDate").value = todayISO();
  $("#status").value = "active";
  $("#payment").value = state.paymentMethods[0] || "";
  $("#service").value = DEFAULT_SERVICES[0];
}

function upsertClient(client) {
  const index = state.clients.findIndex((item) => item.id === client.id);
  if (index >= 0) {
    state.clients[index] = { ...state.clients[index], ...client, updatedAt: new Date().toISOString() };
  } else {
    state.clients.unshift(client);
  }

  saveState();
  render();
}

function deleteClient(id) {
  const client = state.clients.find((item) => item.id === id);
  if (!client) return;
  const confirmed = confirm(`¿Eliminar a ${client.name}?`);
  if (!confirmed) return;

  state.clients = state.clients.filter((item) => item.id !== id);
  saveState();
  render();
  toast("Cliente eliminado");
}

function renewClient(id) {
  const client = state.clients.find((item) => item.id === id);
  if (!client) return;

  const current = parseLocalDate(client.renewalDate) || new Date();
  current.setMonth(current.getMonth() + 1);
  client.renewalDate = current.toISOString().slice(0, 10);
  client.status = "active";
  client.updatedAt = new Date().toISOString();
  saveState();
  render();
  toast("Renovación marcada +1 mes");
}

function buildWhatsAppMessage(client) {
  const readableDate = client.renewalDate
    ? dateFormatter.format(parseLocalDate(client.renewalDate))
    : "la fecha acordada";

  return [
    `Hola ${client.name || ""} 👋 soy de StreamVault.`,
    `Tu renovación de ${client.service}${client.plan ? ` (${client.plan})` : ""} vence el ${readableDate}.`,
    `Total: ${money(client.price)}.`,
    `Método de pago: ${client.payment}.`,
    "Cuando pagues mándame comprobante para renovar ✅"
  ].join("\n");
}

function cleanPhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function whatsappUrl(client) {
  const phone = cleanPhone(client.phone);
  const message = encodeURIComponent(buildWhatsAppMessage(client));
  if (!phone) return "";
  const withCountry = phone.length === 10 ? `52${phone}` : phone;
  return `https://wa.me/${withCountry}?text=${message}`;
}

function copyMessage(id) {
  const client = state.clients.find((item) => item.id === id);
  if (!client) return;

  navigator.clipboard.writeText(buildWhatsAppMessage(client))
    .then(() => toast("Mensaje copiado"))
    .catch(() => toast("No se pudo copiar"));
}

function renderDashboard() {
  const activeClients = state.clients.filter((client) => computedStatus(client) !== "cancelled");
  const monthlyClients = activeClients.filter((client) => isCurrentMonth(client.renewalDate));
  const sales = monthlyClients.reduce((sum, client) => sum + Number(client.price || 0), 0);
  const profit = monthlyClients.reduce((sum, client) => sum + Number(client.price || 0) - Number(client.cost || 0), 0);
  const dueSoon = activeClients.filter((client) => {
    const days = daysUntil(client.renewalDate);
    return days >= 0 && days <= 7;
  });

  $("#salesMonth").textContent = money(sales);
  $("#profitMonth").textContent = money(profit);
  $("#activeCount").textContent = String(activeClients.length);
  $("#dueSoonCount").textContent = String(dueSoon.length);
}

function renderClients() {
  const query = $("#search").value.trim().toLowerCase();
  const filter = $("#filterStatus").value;

  const clients = state.clients
    .map((client) => ({ ...client, statusComputed: computedStatus(client) }))
    .filter((client) => filter === "all" || client.statusComputed === filter)
    .filter((client) => {
      const haystack = [client.name, client.phone, client.service, client.plan, client.notes]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => daysUntil(a.renewalDate) - daysUntil(b.renewalDate));

  $("#emptyState").hidden = clients.length > 0;
  $("#clientList").innerHTML = clients.map(clientCard).join("");
}

function clientCard(client) {
  const days = daysUntil(client.renewalDate);
  const dueText = days < 0
    ? `Venció hace ${Math.abs(days)} día(s)`
    : days === 0
      ? "Vence hoy"
      : `Faltan ${days} día(s)`;

  const waUrl = whatsappUrl(client);
  const waAction = waUrl
    ? `<a class="whatsapp" href="${waUrl}" target="_blank" rel="noopener">WhatsApp</a>`
    : `<button type="button" onclick="copyMessage('${client.id}')">Copiar msg</button>`;

  return `
    <article class="client-card">
      <div class="client-top">
        <div>
          <h3 class="client-name">${escapeHtml(client.name)}</h3>
          <p class="client-meta">${escapeHtml(client.service)}${client.plan ? ` · ${escapeHtml(client.plan)}` : ""}</p>
        </div>
        <span class="badge ${client.statusComputed}">${STATUS_LABELS[client.statusComputed]}</span>
      </div>

      <div class="client-facts">
        <div class="fact">
          <span>Renovación</span>
          <strong>${client.renewalDate ? dateFormatter.format(parseLocalDate(client.renewalDate)) : "Sin fecha"}</strong>
        </div>
        <div class="fact">
          <span>Tiempo</span>
          <strong>${dueText}</strong>
        </div>
        <div class="fact">
          <span>Precio</span>
          <strong>${money(client.price)}</strong>
        </div>
        <div class="fact">
          <span>Ganancia</span>
          <strong>${money(Number(client.price || 0) - Number(client.cost || 0))}</strong>
        </div>
      </div>

      ${client.notes ? `<p class="client-meta">${escapeHtml(client.notes)}</p>` : ""}

      <div class="card-actions">
        ${waAction}
        <button type="button" onclick="copyMessage('${client.id}')">Copiar</button>
        <button type="button" onclick="editClient('${client.id}')">Editar</button>
        <button type="button" onclick="renewClient('${client.id}')">+1 mes</button>
        <button class="delete" type="button" onclick="deleteClient('${client.id}')">Borrar</button>
      </div>
    </article>
  `;
}

function editClient(id) {
  const client = state.clients.find((item) => item.id === id);
  if (!client) return;
  setFormData(client);
  $("#clientForm").scrollIntoView({ behavior: "smooth", block: "start" });
  toast("Editando cliente");
}

function render() {
  renderDashboard();
  renderClients();
}

function exportBackup() {
  const payload = {
    app: "StreamVault Panel",
    version: 1,
    exportedAt: new Date().toISOString(),
    ...state
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `streamvault-respaldo-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast("Respaldo exportado");
}

function importBackup(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!Array.isArray(payload.clients)) throw new Error("Formato inválido");

      state.clients = payload.clients;
      state.paymentMethods = Array.isArray(payload.paymentMethods) && payload.paymentMethods.length
        ? payload.paymentMethods
        : state.paymentMethods;

      saveState();
      refreshPaymentSelects();
      render();
      toast("Respaldo importado");
    } catch {
      toast("Archivo inválido");
    }
  };
  reader.readAsText(file);
}

function savePaymentMethods() {
  const methods = $("#paymentMethodsInput").value
    .split(",")
    .map((method) => method.trim())
    .filter(Boolean);

  if (!methods.length) {
    toast("Agrega al menos un método");
    return;
  }

  state.paymentMethods = methods;
  saveState();
  refreshPaymentSelects();
  toast("Métodos guardados");
}

function toast(message) {
  const toastElement = $("#toast");
  toastElement.textContent = message;
  toastElement.classList.add("show");
  clearTimeout(toastElement.timer);
  toastElement.timer = setTimeout(() => toastElement.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setupEvents() {
  $("#clientForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const client = getFormData();
    if (!client.name) {
      toast("Falta el nombre");
      return;
    }

    upsertClient(client);
    clearForm();
    toast("Cliente guardado");
  });

  $("#clearFormBtn").addEventListener("click", clearForm);
  $("#search").addEventListener("input", renderClients);
  $("#filterStatus").addEventListener("change", renderClients);
  $("#exportBtn").addEventListener("click", exportBackup);
  $("#importFile").addEventListener("change", (event) => importBackup(event.target.files[0]));
  $("#savePaymentsBtn").addEventListener("click", savePaymentMethods);
  $("#backupShortcut").addEventListener("click", exportBackup);

  document.querySelectorAll("[data-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.scroll);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $("#installBtn").hidden = false;
  });

  $("#installBtn").addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $("#installBtn").hidden = true;
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

seedSelects();
clearForm();
setupEvents();
render();
