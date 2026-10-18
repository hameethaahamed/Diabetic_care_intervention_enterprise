const updateForm = document.querySelector("#update-form");
const updateStatus = document.querySelector("#update-status");
const apiBaseUrl = "http://127.0.0.1:8000";
const interventionList = document.querySelector("#intervention-list");
const interventionsStatus = document.querySelector("#interventions-status");
const previousInterventionsButton = document.querySelector("#previous-interventions");
const nextInterventionsButton = document.querySelector("#next-interventions");
const interventionsPageLabel = document.querySelector("#interventions-page");
const interventionsPageSize = 50;
let interventionsPageNumber = 1;
const queryParams = new URLSearchParams(window.location.search);
const encounterIdInput = updateForm.elements.namedItem("encounter_id");
const patientNumberInput = updateForm.elements.namedItem("patient_nbr");
const encounterId = queryParams.get("encounter_id");
const patientNumber = queryParams.get("patient_nbr");

if (encounterId && /^\d+$/.test(encounterId)) {
  encounterIdInput.value = encounterId;
}
if (patientNumber && /^\d+$/.test(patientNumber)) {
  patientNumberInput.value = patientNumber;
}

function renderInterventions(interventions) {
  const rows = interventions.map((intervention) => {
    const row = document.createElement("tr");
    const encounterCell = document.createElement("td");
    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "table-link-button";
    selectButton.dataset.encounterId = intervention.encounter_id;
    selectButton.dataset.patientNumber = intervention.patient_nbr;
    selectButton.dataset.status = intervention.status;
    selectButton.dataset.assignedTo = intervention.assigned_to ?? "";
    selectButton.dataset.notes = intervention.notes ?? "";
    selectButton.textContent = intervention.encounter_id;
    encounterCell.append(selectButton);

    for (const value of [
      intervention.patient_nbr ?? "Not recorded",
      intervention.status,
      intervention.assigned_to ?? "Unassigned",
      intervention.notes ?? "—",
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    row.prepend(encounterCell);
    return row;
  });

  interventionList.replaceChildren(...rows);
  interventionsStatus.textContent = interventions.length
    ? `Showing ${interventions.length} care-intervention record${interventions.length === 1 ? "" : "s"}.`
    : "No care-intervention records were found.";
  previousInterventionsButton.disabled = interventionsPageNumber <= 1;
  nextInterventionsButton.disabled = interventions.length < interventionsPageSize;
  interventionsPageLabel.textContent = `Page ${interventionsPageNumber}`;
}

async function loadInterventions() {
  interventionsStatus.textContent = "Loading care interventions…";
  previousInterventionsButton.disabled = true;
  nextInterventionsButton.disabled = true;

  try {
    const response = await fetch(
      `${apiBaseUrl}/interventions?page=${interventionsPageNumber}`,
    );
    const result = await response.json();
    if (!response.ok) {
      const message =
        typeof result.detail === "string"
          ? result.detail
          : `The API returned HTTP ${response.status}.`;
      throw new Error(message);
    }
    if (!Array.isArray(result)) {
      throw new Error("The API response was not an intervention list.");
    }
    renderInterventions(result);
  } catch (error) {
    interventionList.replaceChildren();
    interventionsStatus.textContent =
      error instanceof Error
        ? `Unable to load care interventions: ${error.message}`
        : "Unable to load care interventions due to an unexpected error.";
    previousInterventionsButton.disabled = interventionsPageNumber <= 1;
    interventionsPageLabel.textContent = `Page ${interventionsPageNumber}`;
  }
}

interventionList.addEventListener("click", (event) => {
  const button = event.target.closest(".table-link-button");
  if (!button) {
    return;
  }

  updateForm.elements.namedItem("encounter_id").value = button.dataset.encounterId;
  updateForm.elements.namedItem("patient_nbr").value = button.dataset.patientNumber;
  updateForm.elements.namedItem("status").value = button.dataset.status;

  const assignedToSelect = updateForm.elements.namedItem("assigned_to");
  const assignedTo = button.dataset.assignedTo || "Unassigned";
  if (![...assignedToSelect.options].some((option) => option.value === assignedTo)) {
    assignedToSelect.add(new Option(assignedTo, assignedTo));
  }
  assignedToSelect.value = assignedTo;
  updateForm.elements.namedItem("notes").value = button.dataset.notes;
  updateStatus.textContent =
    `Loaded care intervention for encounter ${button.dataset.encounterId}.`;
  updateForm.scrollIntoView({ behavior: "smooth", block: "start" });
});

previousInterventionsButton.addEventListener("click", () => {
  if (interventionsPageNumber > 1) {
    interventionsPageNumber -= 1;
    loadInterventions();
  }
});

nextInterventionsButton.addEventListener("click", () => {
  interventionsPageNumber += 1;
  loadInterventions();
});

updateForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = updateForm.querySelector('button[type="submit"]');
  const formData = new FormData(updateForm);
  const encounterId = Number(formData.get("encounter_id"));
  const patientNumber = Number(formData.get("patient_nbr"));
  const assignedTo = formData.get("assigned_to");
  const notes = formData.get("notes");
  const update = {
    status: formData.get("status"),
    assigned_to: assignedTo === "Unassigned" ? null : assignedTo,
    notes: notes || null,
  };

  submitButton.disabled = true;
  updateStatus.textContent = "Updating intervention…";

  try {
    const response = await fetch(
      `${apiBaseUrl}/interventions/${encounterId}?patient_nbr=${patientNumber}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      },
    );
    const result = await response.json();

    if (!response.ok) {
      const message =
        typeof result.detail === "string"
          ? result.detail
          : `Request failed with status ${response.status}.`;
      throw new Error(message);
    }

    updateStatus.textContent =
      `Intervention for encounter ${result.encounter_id} updated successfully.`;
    await loadInterventions();
  } catch (error) {
    updateStatus.textContent =
      error instanceof Error
        ? `Unable to update intervention: ${error.message}`
        : "Unable to update intervention due to an unexpected error.";
  } finally {
    submitButton.disabled = false;
  }
});

loadInterventions();
