const searchForm = document.querySelector("#search-form");
const searchStatus = document.querySelector("#search-status");
const resultsStatus = document.querySelector("#results-status");
const resultsBody = document.querySelector("#search-results");
const previousButton = document.querySelector("#previous-page");
const nextButton = document.querySelector("#next-page");
const pageNumber = document.querySelector("#page-number");
const apiBaseUrl = "http://127.0.0.1:8000";
const pageSize = 50;

let activeFilters = null;
let currentPage = 1;

function renderResults(encounters) {
  const rows = encounters.map((encounter) => {
    const row = document.createElement("tr");
    const values = [
      encounter.encounter_id ?? "—",
      encounter.patient_nbr ?? "Not recorded",
      encounter.age ?? "Not recorded",
      encounter.risk_score ?? "—",
    ];

    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }

    const riskCell = document.createElement("td");
    const riskLevel = encounter.risk_level ?? "Not assessed";
    const badge = document.createElement("span");
    const knownLevels = ["LOW", "MEDIUM", "HIGH"];
    badge.className = knownLevels.includes(riskLevel)
      ? `risk-badge risk-${riskLevel.toLowerCase()}`
      : "risk-badge";
    badge.textContent = riskLevel;
    riskCell.append(badge);
    row.append(riskCell);
    return row;
  });

  resultsBody.replaceChildren(...rows);
  resultsStatus.textContent = encounters.length
    ? `Showing ${encounters.length} matching record${encounters.length === 1 ? "" : "s"}.`
    : "No encounters matched those filters.";
  previousButton.disabled = currentPage <= 1;
  nextButton.disabled = encounters.length < pageSize;
  pageNumber.textContent = `Page ${currentPage}`;
}

async function runSearch() {
  if (!activeFilters) {
    return;
  }

  const params = new URLSearchParams(activeFilters);
  params.set("page", String(currentPage));
  searchStatus.textContent = "Searching…";
  resultsStatus.textContent = "Loading search results…";
  previousButton.disabled = true;
  nextButton.disabled = true;

  try {
    const response = await fetch(
      `${apiBaseUrl}/encounters/search?${params.toString()}`,
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
      throw new Error("The API response was not an encounter list.");
    }

    renderResults(result);
    searchStatus.textContent = "Search complete.";
  } catch (error) {
    resultsBody.replaceChildren();
    resultsStatus.textContent =
      error instanceof Error
        ? `Unable to search encounters: ${error.message}`
        : "Unable to search encounters due to an unexpected error.";
    searchStatus.textContent = "Search failed.";
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = true;
    pageNumber.textContent = `Page ${currentPage}`;
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const submittedFilters = new FormData(searchForm);
  activeFilters = Object.fromEntries(
    [...submittedFilters.entries()].filter(([, value]) => value !== ""),
  );

  if (Object.keys(activeFilters).length === 0) {
    searchStatus.textContent = "Enter at least one search filter.";
    resultsStatus.textContent = "No search filters were provided.";
    resultsBody.replaceChildren();
    activeFilters = null;
    return;
  }

  currentPage = 1;
  runSearch();
});

searchForm.addEventListener("reset", () => {
  activeFilters = null;
  currentPage = 1;
  searchStatus.textContent = "";
  resultsStatus.textContent = "Enter one or more filters and select Search.";
  resultsBody.replaceChildren();
  previousButton.disabled = true;
  nextButton.disabled = true;
  pageNumber.textContent = "Page 1";
});

previousButton.addEventListener("click", () => {
  if (activeFilters && currentPage > 1) {
    currentPage -= 1;
    runSearch();
  }
});

nextButton.addEventListener("click", () => {
  if (activeFilters) {
    currentPage += 1;
    runSearch();
  }
});
