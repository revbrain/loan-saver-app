const WEEKS_PER_MONTH = 52 / 12;

const formatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const form = document.getElementById("calc-form");
const hargaAsliInput = document.getElementById("harga-asli");
const tenorInput = document.getElementById("tenor");
const marginInput = document.getElementById("margin");
const totalAkhirInput = document.getElementById("total-akhir");
const startDateInput = document.getElementById("start-date");
const frequencyInput = document.getElementById("frequency");
const marginField = document.getElementById("margin-field");
const totalField = document.getElementById("total-field");
const schedulePreview = document.getElementById("schedule-preview");

const resultTotal = document.getElementById("result-total");
const resultMonthly = document.getElementById("result-monthly");
const resultWeekly = document.getElementById("result-weekly");
const resultMargin = document.getElementById("result-margin");
const resultMarginPercent = document.getElementById("result-margin-percent");

const clientIdInput = document.getElementById("client-id");
const apiKeyInput = document.getElementById("api-key");
const tasklistSelect = document.getElementById("tasklist");
const newTasklistInput = document.getElementById("new-tasklist");
const statusEl = document.getElementById("sync-status");

const btnSaveConfig = document.getElementById("btn-save-config");
const btnAuth = document.getElementById("btn-auth");
const btnCreateList = document.getElementById("btn-create-list");
const btnSync = document.getElementById("btn-sync");

const DEFAULT_CLIENT_ID =
  "666608625739-6jg3oc8rbdrvpjk0ag90eoc8b5srekbk.apps.googleusercontent.com";

let gapiInited = false;
let gapiClientReady = false;
let gisInited = false;
let tokenClient;
let scheduleTasks = [];
const TOKEN_STORAGE_KEY = "gTaskToken";
let autoReconnectAttempted = false;

function setStatus(text) {
  statusEl.textContent = text;
}

function parseNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function evaluateExpression(raw) {
  const text = raw.trim();
  if (!text) {
    return null;
  }
  if (!/^[0-9+\-*/().\s]+$/.test(text)) {
    return null;
  }
  try {
    const result = Function(`"use strict"; return (${text});`)();
    if (!Number.isFinite(result)) {
      return null;
    }
    return result;
  } catch (error) {
    return null;
  }
}

function attachExpressionInput(input) {
  let timerId;
  const handle = () => {
    const raw = input.value;
    if (!raw.trim()) {
      return;
    }
    if (/[+\-*/(.\s]$/.test(raw.trim())) {
      return;
    }
    const result = evaluateExpression(raw);
    if (result !== null && String(result) !== raw.trim()) {
      input.value = result;
      calculate();
    }
  };

  input.addEventListener("input", () => {
    clearTimeout(timerId);
    timerId = setTimeout(handle, 250);
  });
  input.addEventListener("change", handle);
}

function addMonths(date, months) {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() !== day) {
    next.setDate(0);
  }
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateId(date) {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getMode() {
  return form.querySelector("input[name=\"mode\"]:checked").value;
}

function updateMode() {
  const mode = getMode();
  if (mode === "percent") {
    marginField.classList.remove("hidden");
    totalField.classList.add("hidden");
  } else {
    marginField.classList.add("hidden");
    totalField.classList.remove("hidden");
  }
  calculate();
}

function calculate() {
  const hargaAsli = parseNumber(hargaAsliInput.value);
  const tenor = Math.max(1, parseNumber(tenorInput.value));
  const marginPercentInput = parseNumber(marginInput.value);
  const totalAkhirInputValue = parseNumber(totalAkhirInput.value);

  const mode = getMode();
  const missingBaseInputs = !hargaAsliInput.value.trim() || !tenorInput.value.trim();
  const missingModeInput = mode === "percent"
    ? !marginInput.value.trim()
    : !totalAkhirInput.value.trim();

  if (missingBaseInputs || missingModeInput) {
    resultTotal.textContent = "-";
    resultMonthly.textContent = "-";
    resultWeekly.textContent = "-";
    resultMargin.textContent = "-";
    resultMarginPercent.textContent = "-";
    schedulePreview.innerHTML = "";
    scheduleTasks = [];
    return;
  }

  let totalAkhir = 0;
  if (mode === "percent") {
    totalAkhir = hargaAsli * (1 + marginPercentInput / 100);
  } else {
    totalAkhir = totalAkhirInputValue;
  }

  const marginNominal = totalAkhir - hargaAsli;
  const marginPercent = hargaAsli > 0 ? (marginNominal / hargaAsli) * 100 : 0;
  const cicilanBulanan = tenor > 0 ? totalAkhir / tenor : 0;
  const tabunganMingguan = cicilanBulanan / WEEKS_PER_MONTH;

  resultTotal.textContent = formatter.format(totalAkhir);
  resultMonthly.textContent = formatter.format(cicilanBulanan);
  resultWeekly.textContent = formatter.format(tabunganMingguan);
  resultMargin.textContent = formatter.format(marginNominal);
  resultMarginPercent.textContent = `${marginPercent.toFixed(2)}%`;

  buildSchedule(tabunganMingguan, cicilanBulanan);
}

function buildSchedule(tabunganMingguan, cicilanBulanan) {
  const startValue = startDateInput.value || new Date().toISOString().slice(0, 10);
  const startDate = new Date(startValue);
  const tenorMonths = Math.max(1, parseNumber(tenorInput.value));
  const endDate = addMonths(startDate, tenorMonths);
  const frequency = frequencyInput.value;

  scheduleTasks = [];
  schedulePreview.innerHTML = "";

  let cursor = new Date(startDate);
  let counter = 1;

  while (cursor <= endDate) {
    const amount = frequency === "weekly" ? tabunganMingguan : cicilanBulanan;
    const periodLabel = frequency === "weekly"
      ? `minggu ${counter}`
      : `bulan ${counter}`;

    const note = `Nominal: ${formatter.format(amount)}. Periode: ${periodLabel}. Target: ${formatDateId(cursor)}.`;

    scheduleTasks.push({
      periodLabel,
      note,
      due: new Date(cursor),
    });

    if (counter <= 6) {
      const item = document.createElement("div");
      item.className = "schedule-item";
      item.textContent = `${periodLabel} - ${formatter.format(amount)} - ${formatDateId(cursor)}`;
      schedulePreview.appendChild(item);
    }

    counter += 1;
    cursor = frequency === "weekly" ? addDays(cursor, 7) : addMonths(cursor, 1);
  }

  if (counter > 7) {
    const more = document.createElement("div");
    more.className = "schedule-item";
    more.textContent = "...";
    schedulePreview.appendChild(more);
  }
}

function loadSavedConfig() {
  const saved = JSON.parse(localStorage.getItem("gTaskConfig") || "{}");
  clientIdInput.value = saved.clientId || DEFAULT_CLIENT_ID;
  apiKeyInput.value = saved.apiKey || "";
}

function loadSavedToken() {
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function saveToken(token) {
  if (!token) {
    return;
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
}

async function tryAutoReconnect() {
  if (autoReconnectAttempted || !gapiClientReady || !gisInited) {
    return;
  }
  autoReconnectAttempted = true;

  const savedToken = loadSavedToken();
  if (savedToken) {
    gapi.client.setToken(savedToken);
    await refreshTaskLists();
    setStatus("Terhubung otomatis.");
    return;
  }

  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: "" });
  }
}

function saveConfig() {
  const config = {
    clientId: clientIdInput.value.trim() || DEFAULT_CLIENT_ID,
    apiKey: apiKeyInput.value.trim(),
  };
  localStorage.setItem("gTaskConfig", JSON.stringify(config));
  initGapiClient();
  initGisClient();
  setStatus("Konfigurasi tersimpan. Silakan hubungkan Google.");
}

function gapiLoaded() {
  gapi.load("client", () => {
    gapiInited = true;
    initGapiClient();
  });
}

function gisLoaded() {
  gisInited = true;
  initGisClient();
  tryAutoReconnect();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    btnAuth.disabled = false;
  }
}

async function initGapiClient() {
  if (!gapiInited || !window.gapi) {
    return;
  }
  const apiKey = apiKeyInput.value.trim();
  try {
    const initConfig = {
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest"],
    };
    if (apiKey) {
      initConfig.apiKey = apiKey;
    }
    await gapi.client.init(initConfig);
    gapiClientReady = true;
  } catch (error) {
    gapiClientReady = false;
    setStatus("Gagal inisialisasi Google API. Pastikan API Key benar jika diisi.");
  }
  maybeEnableButtons();
  tryAutoReconnect();
}

function initGisClient() {
  const clientId = clientIdInput.value.trim();
  if (!gisInited || !clientId || !window.google) {
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: "https://www.googleapis.com/auth/tasks",
    callback: "",
  });
  maybeEnableButtons();
}

async function handleAuthClick() {
  const clientId = clientIdInput.value.trim();
  if (!clientId) {
    setStatus("Client ID belum diisi.");
    return;
  }

  if (!gapiClientReady) {
    await initGapiClient();
  }

  if (!tokenClient) {
    initGisClient();
  }

  if (!tokenClient) {
    setStatus("Client ID belum diinisialisasi. Coba simpan konfigurasi lagi.");
    return;
  }

  tokenClient.callback = async (resp) => {
    if (resp.error) {
      setStatus("Gagal login: " + resp.error);
      return;
    }
    gapi.client.setToken(resp);
    saveToken(resp);
    setStatus("Login berhasil. Memuat daftar tasks...");
    await refreshTaskLists();
  };

  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: "consent" });
  } else {
    tokenClient.requestAccessToken({ prompt: "" });
  }
}

async function refreshTaskLists() {
  try {
    const response = await gapi.client.tasks.tasklists.list();
    tasklistSelect.innerHTML = "";
    (response.result.items || []).forEach((list) => {
      const option = document.createElement("option");
      option.value = list.id;
      option.textContent = list.title;
      tasklistSelect.appendChild(option);
    });
    setStatus("Daftar tasks siap.");
  } catch (error) {
    setStatus("Gagal memuat daftar tasks. Coba hubungkan Google lagi.");
  }
}

async function createTaskList() {
  const name = newTasklistInput.value.trim();
  if (!name) {
    setStatus("Nama daftar baru masih kosong.");
    return;
  }
  try {
    const response = await gapi.client.tasks.tasklists.insert({
      resource: { title: name },
    });
    await refreshTaskLists();
    tasklistSelect.value = response.result.id;
    setStatus("Daftar baru dibuat.");
  } catch (error) {
    setStatus("Gagal membuat daftar. Pastikan sudah login.");
  }
}

function getTaskListLabel() {
  const newName = newTasklistInput.value.trim();
  if (newName) {
    return newName;
  }
  const selected = tasklistSelect.options[tasklistSelect.selectedIndex];
  return selected ? selected.textContent.trim() : "";
}

async function syncTasks() {
  if (!tasklistSelect.value) {
    setStatus("Pilih daftar tasks terlebih dahulu.");
    return;
  }

  if (!scheduleTasks.length) {
    setStatus("Jadwal belum siap.");
    return;
  }

  setStatus("Mengirim task ke Google Tasks...");

  const listLabel = getTaskListLabel();
  for (const task of scheduleTasks) {
    const due = new Date(task.due);
    due.setHours(9, 0, 0, 0);
    const prefix = listLabel || "Tabungan";
    const title = `${prefix} ${task.periodLabel}`.trim();
    await gapi.client.tasks.tasks.insert({
      tasklist: tasklistSelect.value,
      resource: {
        title,
        notes: task.note,
        due: due.toISOString(),
      },
    });
  }

  setStatus("Sinkronisasi selesai.");
}

form.addEventListener("input", calculate);
form.addEventListener("change", calculate);
frequencyInput.addEventListener("change", calculate);
btnSaveConfig.addEventListener("click", saveConfig);
btnAuth.addEventListener("click", handleAuthClick);
btnCreateList.addEventListener("click", createTaskList);
btnSync.addEventListener("click", syncTasks);

form.querySelectorAll("input[name=\"mode\"]").forEach((radio) => {
  radio.addEventListener("change", updateMode);
});

window.addEventListener("load", () => {
  loadSavedConfig();
  const today = new Date().toISOString().slice(0, 10);
  startDateInput.value = today;
  updateMode();
  calculate();
  tryAutoReconnect();
});

attachExpressionInput(hargaAsliInput);
attachExpressionInput(tenorInput);
attachExpressionInput(marginInput);
attachExpressionInput(totalAkhirInput);

window.gapiLoaded = gapiLoaded;
window.gisLoaded = gisLoaded;
