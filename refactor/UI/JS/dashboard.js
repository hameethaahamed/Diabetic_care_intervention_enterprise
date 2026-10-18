const dashboardStatus = document.querySelector("#dashboard-status");
const metricsGrid = document.querySelector(".metrics-grid");
const refreshButton = document.querySelector("#refresh-dashboard");
const apiBaseUrl = "http://127.0.0.1:8000";
const numberFormat = new Intl.NumberFormat();

function setMetric(id, value) {
  document.querySelector(id).textContent = numberFormat.format(value);
}

async function loadDashboard() {
  dashboardStatus.textContent = "Loading dashboard metrics…";
  metricsGrid.setAttribute("aria-busy", "true");
  refreshButton.disabled = true;

  try {
    const response = await fetch(`${apiBaseUrl}/management/dashboard`);
    const dashboard = await response.json();
    if (!response.ok) {
      const message =
        typeof dashboard.detail === "string"
          ? dashboard.detail
          : `The API returned HTTP ${response.status}.`;
      throw new Error(message);
    }

    setMetric("#metric-total", dashboard.total_diabetes_encounters);
    setMetric("#metric-high-risk", dashboard.high_risk_population);
    setMetric("#metric-pending", dashboard.care_queue_pending);
    setMetric("#metric-readmitted", dashboard.readmitted_under_30_days);
    setMetric("#metric-high-risk-readmitted", dashboard.high_risk_30_day_readmissions);
    document.querySelector("#metric-high-risk-percent").textContent =
      `${dashboard.high_risk_percent}% of total encounters`;
    document.querySelector("#metric-readmission-rate").textContent =
      `${dashboard.readmission_rate}% overall readmission rate`;
    dashboardStatus.textContent = "Dashboard metrics updated.";
  } catch (error) {
    dashboardStatus.textContent =
      error instanceof Error
        ? `Unable to load dashboard metrics: ${error.message}`
        : "Unable to load dashboard metrics due to an unexpected error.";
  } finally {
    metricsGrid.setAttribute("aria-busy", "false");
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", loadDashboard);
loadDashboard();
