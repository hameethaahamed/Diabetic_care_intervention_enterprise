const encounterRows = document.querySelector("#encounter-list");
const encounterStatus = document.querySelector("#encounter-status");
const encounterForm = document.querySelector(".patient-form");
const formStatus = document.querySelector("#form-status");
const apiBaseUrl = "http://127.0.0.1:8000";

function renderEncounters(encounters) {
  const rows = encounters.map((encounter) => {
    const row = document.createElement("tr");
    const encounterCell = document.createElement("td");
    const patientCell = document.createElement("td");
    const ageCell = document.createElement("td");
    const scoreCell = document.createElement("td");
    const riskCell = document.createElement("td");

    if (encounter.encounter_id != null && encounter.patient_nbr != null) {
      const updateLink = document.createElement("a");
      const updateUrl = new URL("update.html", window.location.href);
      updateUrl.searchParams.set("encounter_id", encounter.encounter_id);
      updateUrl.searchParams.set("patient_nbr", encounter.patient_nbr);
      updateLink.href = updateUrl.toString();
      updateLink.textContent = encounter.encounter_id;
      updateLink.setAttribute(
        "aria-label",
        `Update intervention for encounter ${encounter.encounter_id}`,
      );
      encounterCell.append(updateLink);
    } else {
      encounterCell.textContent = encounter.encounter_id ?? "—";
    }
    patientCell.textContent = encounter.patient_nbr ?? "Not recorded";
    ageCell.textContent = encounter.age ?? "Not recorded";
    scoreCell.textContent = encounter.risk_score ?? "—";
    const riskLevel = encounter.risk_level ?? "Not assessed";
    const riskBadge = document.createElement("span");
    const knownRiskLevels = ["LOW", "MEDIUM", "HIGH"];
    riskBadge.className = knownRiskLevels.includes(riskLevel)
      ? `risk-badge risk-${riskLevel.toLowerCase()}`
      : "risk-badge";
    riskBadge.textContent = riskLevel;
    riskCell.append(riskBadge);
    row.append(encounterCell, patientCell, ageCell, scoreCell, riskCell);
    return row;
  });

  encounterRows.replaceChildren(...rows);
  encounterStatus.textContent = encounters.length
    ? `Showing ${encounters.length} medium- and high-risk patient record${encounters.length === 1 ? "" : "s"}.`
    : "No medium- or high-risk encounters were found.";
}

async function loadEncounters() {
  try {
    const params = new URLSearchParams({ page: "1" });
    params.append("risk_level", "HIGH");
    params.append("risk_level", "MEDIUM");
    const response = await fetch(
      `${apiBaseUrl}/encounters?${params.toString()}`,
    );
    if (!response.ok) {
      throw new Error(`The API returned HTTP ${response.status}.`);
    }

    const encounters = await response.json();
    if (!Array.isArray(encounters)) {
      throw new Error("The API response was not an encounter list.");
    }

    renderEncounters(encounters);
  } catch (error) {
    encounterStatus.textContent =
      error instanceof Error
        ? `Unable to load encounters: ${error.message}`
        : "Unable to load encounters due to an unexpected error.";
  }
}

encounterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = encounterForm.querySelector('button[type="submit"]');
  const formData = new FormData(encounterForm);
  const encounter = Object.fromEntries(formData.entries());

  for (const field of [
    "encounter_id",
    "patient_nbr",
    "time_in_hospital",
    "number_inpatient",
    "number_emergency",
    "number_outpatient",
    "num_medications",
  ]) {
    encounter[field] = Number(encounter[field]);
  }

  submitButton.disabled = true;
  formStatus.textContent = "Saving encounter…";

  try {
    const response = await fetch(`${apiBaseUrl}/encounters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(encounter),
    });
    const result = await response.json();

    if (!response.ok) {
      const message =
        typeof result.detail === "string"
          ? result.detail
          : `Request failed with status ${response.status}.`;
      throw new Error(message);
    }

    encounterForm.reset();
    formStatus.textContent = "Encounter added successfully.";
    await loadEncounters();
  } catch (error) {
    formStatus.textContent =
      error instanceof Error
        ? `Unable to add encounter: ${error.message}`
        : "Unable to add encounter due to an unexpected error.";
  } finally {
    submitButton.disabled = false;
  }
});

loadEncounters();
