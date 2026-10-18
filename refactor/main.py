# pyright: reportMissingImports=false
import math
import os
import time
from collections import deque
from threading import Lock
from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware

from models import (
    CareIntervention,
    CareInterventionUpdate,
    CareQueueItem,
    Encounter,
    EncounterCreate,
    ManagementDashboard,
    OperationsSummary,
    ReadmissionAnalysis,
    RiskLevel,
)
from service import (
    get_all_encounters,
    get_all_care_interventions,
    get_care_intervention,
    get_care_queue,
    get_management_dashboard,
    get_operations_summary,
    get_readmission_analysis,
    create_encounter,
    search_encounters,
    update_care_intervention,
)


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

RATE_LIMIT = 60
RATE_WINDOW_SECONDS = 60
ENCOUNTERS_PAGE_SIZE = 50
CARE_QUEUE_PAGE_SIZE = 50
request_times: dict[str, deque[float]] = {}
request_times_lock = Lock()


def enforce_encounters_rate_limit(request: Request) -> None:
    client = request.client
    client_key = client.host if client is not None else "unknown"
    now = time.monotonic()
    cutoff = now - RATE_WINDOW_SECONDS

    with request_times_lock:
        timestamps = request_times.setdefault(client_key, deque())
        while timestamps and timestamps[0] <= cutoff:
            timestamps.popleft()

        if len(timestamps) >= RATE_LIMIT:
            retry_after = max(
                1, math.ceil(timestamps[0] + RATE_WINDOW_SECONDS - now)
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Try again later.",
                headers={"Retry-After": str(retry_after)},
            )

        timestamps.append(now)


@app.get("/encounters", response_model=list[Encounter])
def read_encounters(
    risk_level: list[RiskLevel] | None = Query(default=None),
    _: None = Depends(enforce_encounters_rate_limit),
    page: int = Query(
        default=1,
        ge=1,
        description="Page number (50 encounters per page)",
    ),
) -> list[Encounter]:
    return [
        Encounter.model_validate(row)
        for row in get_all_encounters(
            page,
            ENCOUNTERS_PAGE_SIZE,
            risk_levels=(
                [level.value for level in risk_level]
                if risk_level
                else None
            ),
        )
    ]


@app.get("/encounters/search", response_model=list[Encounter])
def find_encounters(
    patient_nbr: int | None = Query(default=None, gt=0),
    risk_score: int | None = Query(default=None, ge=0),
    risk_level: RiskLevel | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    _: None = Depends(enforce_encounters_rate_limit),
) -> list[Encounter]:
    if patient_nbr is None and risk_score is None and risk_level is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one search filter",
        )
    return [
        Encounter.model_validate(row)
        for row in search_encounters(
            patient_nbr=patient_nbr,
            risk_score=risk_score,
            risk_level=risk_level.value if risk_level is not None else None,
            page=page,
            page_size=ENCOUNTERS_PAGE_SIZE,
        )
    ]


@app.post(
    "/encounters",
    response_model=Encounter,
    status_code=status.HTTP_201_CREATED,
)
def add_encounter(
    encounter: EncounterCreate,
    _: None = Depends(enforce_encounters_rate_limit),
) -> Encounter:
    created_encounter = create_encounter(encounter.model_dump(mode="json"))
    if created_encounter is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Encounter {encounter.encounter_id} already exists",
        )
    return Encounter.model_validate(created_encounter)


@app.get("/encounters/{encounter_id}", response_model=CareIntervention)
def read_encounter(
    encounter_id: int = Path(gt=0),
    _: None = Depends(enforce_encounters_rate_limit),
) -> CareIntervention:
    intervention = get_care_intervention(encounter_id)
    if intervention is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No care intervention found for encounter {encounter_id}",
        )
    return CareIntervention.model_validate(intervention)


@app.get("/interventions", response_model=list[CareQueueItem])
def read_care_interventions(
    page: int = Query(default=1, ge=1),
    _: None = Depends(enforce_encounters_rate_limit),
) -> list[CareQueueItem]:
    return [
        CareQueueItem.model_validate(row)
        for row in get_all_care_interventions(page, CARE_QUEUE_PAGE_SIZE)
    ]


@app.get("/care-queue", response_model=list[CareQueueItem])
def read_care_queue(
    _: None = Depends(enforce_encounters_rate_limit),
    page: int = Query(
        default=1,
        ge=1,
        description="Page number (50 queue records per page)",
    ),
) -> list[CareQueueItem]:
    return [
        CareQueueItem.model_validate(row)
        for row in get_care_queue(
            ["MEDIUM", "HIGH"],
            page,
            CARE_QUEUE_PAGE_SIZE,
            "PENDING_REVIEW",
        )
    ]


@app.get("/care-queue/high", response_model=list[CareQueueItem])
def read_high_risk_care_queue(
    _: None = Depends(enforce_encounters_rate_limit),
    page: int = Query(
        default=1,
        ge=1,
        description="Page number (50 queue records per page)",
    ),
) -> list[CareQueueItem]:
    return [
        CareQueueItem.model_validate(row)
        for row in get_care_queue(["HIGH"], page, CARE_QUEUE_PAGE_SIZE)
    ]


@app.get("/operations/summary", response_model=OperationsSummary)
def read_operations_summary(
    _: None = Depends(enforce_encounters_rate_limit),
) -> OperationsSummary:
    return OperationsSummary.model_validate(get_operations_summary())


@app.get("/operations/readmission-analysis", response_model=ReadmissionAnalysis)
def read_readmission_analysis(
    _: None = Depends(enforce_encounters_rate_limit),
) -> ReadmissionAnalysis:
    return ReadmissionAnalysis.model_validate(get_readmission_analysis())


@app.get("/management/dashboard", response_model=ManagementDashboard)
def read_management_dashboard(
    _: None = Depends(enforce_encounters_rate_limit),
) -> ManagementDashboard:
    return ManagementDashboard.model_validate(get_management_dashboard())


@app.patch(
    "/interventions/{encounter_id}",
    response_model=CareIntervention,
)
def patch_care_intervention(
    encounter_id: int = Path(gt=0),
    intervention_update: CareInterventionUpdate = ...,
    patient_nbr: int | None = Query(default=None, gt=0),
) -> CareIntervention:
    updated_intervention = update_care_intervention(
        encounter_id=encounter_id,
        patient_nbr=patient_nbr,
        status=intervention_update.status,
        assigned_to=intervention_update.assigned_to,
        notes=intervention_update.notes,
    )
    if updated_intervention is None:
        detail = (
            f"No care intervention found for encounter {encounter_id} "
            f"and patient {patient_nbr}"
            if patient_nbr is not None
            else f"No care intervention found for encounter {encounter_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )
    return CareIntervention.model_validate(updated_intervention)
