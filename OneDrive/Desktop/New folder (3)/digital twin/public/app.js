const form = document.getElementById("reportForm");
const formStatus = document.getElementById("formStatus");
const feed = document.getElementById("feed");
const gpsBtn = document.getElementById("useMyLocation");
const filterType = document.getElementById("filterType");
const filterSeverity = document.getElementById("filterSeverity");
const filterStatus = document.getElementById("filterStatus");
const filterSearch = document.getElementById("filterSearch");
const toggleHeatmapBtn = document.getElementById("toggleHeatmap");
const authStatus = document.getElementById("authStatus");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authRole = document.getElementById("authRole");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const socket = io();

const map = L.map("map").setView([20.5937, 78.9629], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);
setTimeout(() => map.invalidateSize(), 120);

const markers = new Map();
let allReports = [];
let heatLayer = null;
let heatEnabled = false;
let currentUser = null;
let authToken = localStorage.getItem("blueclean_token") || "";

const severityColor = {
  high: "red",
  medium: "orange",
  low: "green"
};

function markerIcon(color) {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,0.35);"></div>
    `
  });
}

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

function setAuthUi() {
  if (!currentUser) {
    authStatus.textContent = "Not signed in";
    return;
  }
  authStatus.textContent = `Signed in as ${currentUser.name} (${currentUser.role})`;
}

async function hydrateCurrentUser() {
  if (!authToken) return;
  try {
    const response = await fetch("/api/auth/me", {
      headers: { authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) throw new Error("Invalid token");
    const data = await response.json();
    currentUser = data.user;
    setAuthUi();
  } catch (error) {
    authToken = "";
    currentUser = null;
    localStorage.removeItem("blueclean_token");
    setAuthUi();
  }
}

async function doAuth(mode) {
  const payload = {
    email: authEmail.value.trim(),
    password: authPassword.value,
    name: authName.value.trim(),
    role: authRole.value
  };
  if (!payload.email || !payload.password || (mode === "register" && !payload.name)) {
    formStatus.textContent = "Auth fields are incomplete.";
    return;
  }

  const response = await fetch(`/api/auth/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    formStatus.textContent = data.message || "Authentication failed.";
    return;
  }

  authToken = data.token;
  currentUser = data.user;
  localStorage.setItem("blueclean_token", authToken);
  setAuthUi();
  formStatus.textContent = `${mode === "register" ? "Registered" : "Logged in"} successfully.`;
}

function buildFeedItem(report) {
  const item = document.createElement("article");
  item.className = `feed-item severity-${report.severityBand}`;
  item.id = `feed-${report._id}`;

  item.innerHTML = `
    <div class="item-row">
      <strong>${report.pollutionType}</strong>
      <span class="severity-chip">Severity ${report.severityScore}/10</span>
    </div>
    <p>${report.description}</p>
    <p class="meta">
      Reporter: ${report.reporterName || "Anonymous"} | ${formatDate(report.createdAt)}
    </p>
    <p class="meta">Status: <span class="status-value">${report.status}</span></p>
    ${
      report.imageUrl
        ? `<img src="${report.imageUrl}" alt="report photo" style="width:100%;border-radius:8px;max-height:180px;object-fit:cover;" />`
        : ""
    }
    <select class="status-select" data-report-id="${report._id}">
      ${["reported", "verified", "cleaning", "resolved"]
        .map((status) => `<option ${report.status === status ? "selected" : ""}>${status}</option>`)
        .join("")}
    </select>
  `;

  item.querySelector("select").addEventListener("change", async (event) => {
    const nextStatus = event.target.value;
    const id = event.target.dataset.reportId;
    if (!authToken) {
      alert("Please login as authority/ngo/admin to update status.");
      event.target.value = report.status;
      return;
    }
    const response = await fetch(`/api/reports/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ status: nextStatus })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.message || "Status update failed.");
      event.target.value = report.status;
    }
  });

  return item;
}

function clearMapMarkers() {
  markers.forEach((marker) => map.removeLayer(marker));
  markers.clear();
}

function addOrUpdateMapMarker(report) {
  const [lng, lat] = report.location.coordinates;
  const color = severityColor[report.severityBand] || "green";
  const popup = `
    <strong>${report.pollutionType}</strong><br/>
    Severity: ${report.severityScore}/10<br/>
    Status: ${report.status}<br/>
    ${report.description}
  `;

  if (markers.has(report._id)) {
    const marker = markers.get(report._id);
    marker.setLatLng([lat, lng]).bindPopup(popup);
    return;
  }

  const marker = L.marker([lat, lng], { icon: markerIcon(color) }).addTo(map).bindPopup(popup);
  markers.set(report._id, marker);
}

function updateHeatmap(reports) {
  const points = reports.map((report) => {
    const [lng, lat] = report.location.coordinates;
    return [lat, lng, Math.max(0.25, report.severityScore / 10)];
  });

  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }

  if (heatEnabled && points.length) {
    heatLayer = L.heatLayer(points, {
      radius: 24,
      blur: 15,
      maxZoom: 10
    }).addTo(map);
  }
}

function getFilteredReports() {
  const typeValue = filterType.value;
  const severityValue = filterSeverity.value;
  const statusValue = filterStatus.value;
  const searchValue = filterSearch.value.trim().toLowerCase();

  return allReports.filter((report) => {
    const matchType = typeValue === "all" || report.pollutionType === typeValue;
    const matchSeverity = severityValue === "all" || report.severityBand === severityValue;
    const matchStatus = statusValue === "all" || report.status === statusValue;
    const haystack = `${report.description} ${report.reporterName} ${report.pollutionType}`.toLowerCase();
    const matchSearch = !searchValue || haystack.includes(searchValue);
    return matchType && matchSeverity && matchStatus && matchSearch;
  });
}

function renderReports() {
  const reports = getFilteredReports();
  feed.innerHTML = "";
  clearMapMarkers();
  reports
    .slice()
    .reverse()
    .forEach((report) => {
      addOrUpdateMapMarker(report);
      feed.prepend(buildFeedItem(report));
    });
  updateHeatmap(reports);
}

async function loadStats() {
  try {
    const response = await fetch("/api/reports/stats/overview");
    if (!response.ok) return;
    const stats = await response.json();
    document.getElementById("statTotal").textContent = stats.total;
    document.getElementById("statOpen").textContent = stats.open;
    document.getElementById("statHigh").textContent = stats.high;
    document.getElementById("statLow").textContent = stats.low;
  } catch (error) {
    // silently ignore stats failures
  }
}

async function loadReports() {
  const response = await fetch("/api/reports");
  const reports = await response.json();
  allReports = reports;
  renderReports();
  loadStats();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formStatus.textContent = "Submitting...";

  const formData = new FormData(form);
  try {
    const headers = authToken ? { authorization: `Bearer ${authToken}` } : {};
    const response = await fetch("/api/reports", { method: "POST", body: formData, headers });
    if (!response.ok) throw new Error("Submission failed");
    form.reset();
    formStatus.textContent = "Report submitted successfully.";
    loadStats();
  } catch (error) {
    formStatus.textContent = "Could not submit report.";
  }
});

gpsBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    formStatus.textContent = "Geolocation is not supported in this browser.";
    return;
  }

  formStatus.textContent = "Getting location...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      form.elements.lat.value = position.coords.latitude.toFixed(6);
      form.elements.lng.value = position.coords.longitude.toFixed(6);
      formStatus.textContent = "Location captured.";
    },
    () => {
      formStatus.textContent = "Could not capture location.";
    }
  );
});

socket.on("report:created", (report) => {
  allReports.unshift(report);
  renderReports();
  loadStats();
});

socket.on("report:updated", (report) => {
  allReports = allReports.map((item) => (item._id === report._id ? report : item));
  renderReports();
  loadStats();
});

toggleHeatmapBtn.addEventListener("click", () => {
  heatEnabled = !heatEnabled;
  toggleHeatmapBtn.textContent = heatEnabled ? "Heatmap On" : "Heatmap Off";
  updateHeatmap(getFilteredReports());
});

[filterType, filterSeverity, filterStatus, filterSearch].forEach((input) => {
  input.addEventListener("input", renderReports);
});

registerBtn.addEventListener("click", () => doAuth("register"));
loginBtn.addEventListener("click", () => doAuth("login"));
logoutBtn.addEventListener("click", () => {
  authToken = "";
  currentUser = null;
  localStorage.removeItem("blueclean_token");
  setAuthUi();
  formStatus.textContent = "Logged out.";
});

setAuthUi();
hydrateCurrentUser();
loadReports();

window.addEventListener("resize", () => {
  map.invalidateSize();
});
