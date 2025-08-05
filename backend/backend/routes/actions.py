# actions.py

import uuid
import time
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from enum import Enum
from typing import List

from backend.db import database

# task management and pydantic models
task_store = {}
class TaskStatus(str, Enum):
    PENDING, IN_PROGRESS, SUCCESS, FAILED = "PENDING", "IN_PROGRESS", "SUCCESS", "FAILED"
class CompanyAssociationIn(BaseModel): company_id: int
class BulkTransferIn(BaseModel): source_collection_id: uuid.UUID; destination_collection_id: uuid.UUID
class SelectiveTransferIn(BaseModel): company_ids: List[int]; destination_collection_id: uuid.UUID
class BulkDeleteIn(BaseModel): collection_id: uuid.UUID
class SelectiveDeleteIn(BaseModel): collection_id: uuid.UUID; company_ids: List[int]
class TaskOut(BaseModel): task_id: str; status: TaskStatus
class TaskStatusOut(TaskOut): progress: int = 0; total: int = 0; detail: str = "Task is processing."

# routers
bulk_actions_router = APIRouter(prefix="/actions", tags=["actions"])
individual_actions_router = APIRouter(tags=["collections"])

# background worker functions
def run_bulk_transfer(task_id: str, source_id: uuid.UUID, dest_id: uuid.UUID):
    db = database.SessionLocal()
    try:
        source_company_ids = {c.company_id for c in db.query(database.CompanyCollectionAssociation.company_id).filter(database.CompanyCollectionAssociation.collection_id == source_id).all()}
        dest_company_ids = {c.company_id for c in db.query(database.CompanyCollectionAssociation.company_id).filter(database.CompanyCollectionAssociation.collection_id == dest_id).all()}
        company_ids_to_add = list(source_company_ids - dest_company_ids)
        total_to_add = len(company_ids_to_add)
        task_store[task_id].update({"status": TaskStatus.IN_PROGRESS, "total": total_to_add, "detail": "In progress..."})
        for i, company_id in enumerate(company_ids_to_add):
            db.add(database.CompanyCollectionAssociation(company_id=company_id, collection_id=dest_id)); db.commit()
            task_store[task_id]["progress"] = i + 1
        task_store[task_id].update({"status": TaskStatus.SUCCESS, "detail": "Transfer complete."})
    except Exception as e:
        db.rollback(); task_store[task_id].update({"status": TaskStatus.FAILED, "detail": str(e)})
    finally:
        db.close()

def run_selective_transfer(task_id: str, company_ids: List[int], dest_id: uuid.UUID):
    db = database.SessionLocal()
    try:
        dest_company_ids = {c.company_id for c in db.query(database.CompanyCollectionAssociation.company_id).filter(database.CompanyCollectionAssociation.collection_id == dest_id).all()}
        company_ids_to_add = list(set(company_ids) - dest_company_ids)
        total_to_add = len(company_ids_to_add)
        task_store[task_id].update({"status": TaskStatus.IN_PROGRESS, "total": total_to_add, "detail": "Transferring selected companies..."})
        for i, company_id in enumerate(company_ids_to_add):
            db.add(database.CompanyCollectionAssociation(company_id=company_id, collection_id=dest_id)); db.commit()
            task_store[task_id]["progress"] = i + 1
        task_store[task_id].update({"status": TaskStatus.SUCCESS, "detail": "Selective transfer complete."})
    except Exception as e:
        db.rollback(); task_store[task_id].update({"status": TaskStatus.FAILED, "detail": str(e)})
    finally:
        db.close()

def run_bulk_delete(task_id: str, collection_id: uuid.UUID):
    db = database.SessionLocal()
    try:
        associations_to_delete = db.query(database.CompanyCollectionAssociation).filter_by(collection_id=collection_id).all()
        total_to_delete = len(associations_to_delete)
        task_store[task_id].update({"status": TaskStatus.IN_PROGRESS, "total": total_to_delete, "detail": "Deleting companies from collection..."})
        for i, association in enumerate(associations_to_delete):
            db.delete(association); db.commit(); time.sleep(0.01)
            task_store[task_id]["progress"] = i + 1
        task_store[task_id].update({"status": TaskStatus.SUCCESS, "detail": "Bulk delete complete."})
    except Exception as e:
        db.rollback(); task_store[task_id].update({"status": TaskStatus.FAILED, "detail": str(e)})
    finally:
        db.close()

def run_selective_delete(task_id: str, collection_id: uuid.UUID, company_ids: List[int]):
    db = database.SessionLocal()
    try:
        associations_to_delete = db.query(database.CompanyCollectionAssociation).filter(database.CompanyCollectionAssociation.collection_id == collection_id, database.CompanyCollectionAssociation.company_id.in_(company_ids)).all()
        total_to_delete = len(associations_to_delete)
        task_store[task_id].update({"status": TaskStatus.IN_PROGRESS, "total": total_to_delete, "detail": "Removing selected companies..."})
        for i, association in enumerate(associations_to_delete):
            db.delete(association); db.commit(); time.sleep(0.01)
            task_store[task_id]["progress"] = i + 1
        task_store[task_id].update({"status": TaskStatus.SUCCESS, "detail": "Selective remove complete."})
    except Exception as e:
        db.rollback(); task_store[task_id].update({"status": TaskStatus.FAILED, "detail": str(e)})
    finally:
        db.close()

# individual action endpoints
@individual_actions_router.post("/collections/{collection_id}/companies", status_code=201, summary="Add a single company to a collection")
def add_company_to_collection(collection_id: uuid.UUID, payload: CompanyAssociationIn, db: Session = Depends(database.get_db)):
    company = db.query(database.Company).filter(database.Company.id == payload.company_id).first()
    if not company: raise HTTPException(status_code=404, detail="Company not found")
    collection = db.query(database.CompanyCollection).filter(database.CompanyCollection.id == collection_id).first()
    if not collection: raise HTTPException(status_code=404, detail="Collection not found")
    association = database.CompanyCollectionAssociation(company_id=payload.company_id, collection_id=collection_id)
    db.add(association)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Company {payload.company_id} is already in collection {collection_id}")
    return {"message": "Company added to collection successfully"}

@individual_actions_router.delete("/collections/{collection_id}/companies/{company_id}", status_code=204, summary="Remove a single company from a collection")
def remove_company_from_collection(collection_id: uuid.UUID, company_id: int, db: Session = Depends(database.get_db)):
    association = db.query(database.CompanyCollectionAssociation).filter_by(collection_id=collection_id, company_id=company_id).first()
    if not association: raise HTTPException(status_code=404, detail="Company not found in this collection")
    db.delete(association)
    db.commit()
    return None

# bulk action endpoints
@bulk_actions_router.post("/transfer-collection", response_model=TaskOut, status_code=202)
def transfer_collection(payload: BulkTransferIn, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    task_id = str(uuid.uuid4()); task_store[task_id] = {"status": TaskStatus.PENDING}; background_tasks.add_task(run_bulk_transfer, task_id, payload.source_collection_id, payload.destination_collection_id)
    return {"task_id": task_id, "status": TaskStatus.PENDING}

@bulk_actions_router.post("/transfer-selection", response_model=TaskOut, status_code=202)
def transfer_selection(payload: SelectiveTransferIn, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    task_id = str(uuid.uuid4()); task_store[task_id] = {"status": TaskStatus.PENDING}; background_tasks.add_task(run_selective_transfer, task_id, payload.company_ids, payload.destination_collection_id)
    return {"task_id": task_id, "status": TaskStatus.PENDING}

@bulk_actions_router.delete("/collection-contents", response_model=TaskOut, status_code=202)
def delete_collection_contents(payload: BulkDeleteIn, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    task_id = str(uuid.uuid4()); task_store[task_id] = {"status": TaskStatus.PENDING}; background_tasks.add_task(run_bulk_delete, task_id, payload.collection_id)
    return {"task_id": task_id, "status": TaskStatus.PENDING}

@bulk_actions_router.post("/delete-selection", response_model=TaskOut, status_code=202)
def delete_selection(payload: SelectiveDeleteIn, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    task_id = str(uuid.uuid4()); task_store[task_id] = {"status": TaskStatus.PENDING}
    background_tasks.add_task(run_selective_delete, task_id, payload.collection_id, payload.company_ids)
    return {"task_id": task_id, "status": TaskStatus.PENDING}

@bulk_actions_router.get("/tasks/{task_id}/status", response_model=TaskStatusOut)
def get_task_status(task_id: str):
    task = task_store.get(task_id)
    if not task: raise HTTPException(status_code=404, detail="Task not found")
    return TaskStatusOut(task_id=task_id, status=task.get("status", TaskStatus.FAILED), progress=task.get("progress", 0), total=task.get("total", 0), detail=task.get("detail", "No details available."))
