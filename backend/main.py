# main.py

import randomname
from fastapi import FastAPI
from fastapi.concurrency import asynccontextmanager
from sqlalchemy.orm import Session
from sqlalchemy import text
from starlette.middleware.cors import CORSMiddleware

# import routers
from backend.db import database
from backend.routes import collections, companies
from backend.routes.actions import bulk_actions_router, individual_actions_router


# lifespan management
@asynccontextmanager
async def lifespan(app: FastAPI):
    database.Base.metadata.create_all(bind=database.engine)
    db = database.SessionLocal()
    if not db.query(database.Settings).get("seeded"):
        seed_database(db)
        db.add(database.Settings(setting_name="seeded"))
        db.commit()
    db.close()
    yield

# app initialization
app = FastAPI(lifespan=lifespan)

# add CORS middleware first
# middleware must be added before routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include routers second
app.include_router(companies.router)
app.include_router(collections.router)
app.include_router(bulk_actions_router)
app.include_router(individual_actions_router)


# database seeding function
def seed_database(db: Session):
    # (The rest of this file is unchanged)
    db.execute(text("TRUNCATE TABLE company_collection_associations CASCADE;"))
    db.execute(text("TRUNCATE TABLE companies CASCADE;"))
    db.execute(text("TRUNCATE TABLE company_collections CASCADE;"))
    db.execute(
        text("DROP TRIGGER IF EXISTS throttle_updates_trigger ON company_collection_associations;")
    )
    db.commit()
    companies_list = [
        database.Company(company_name=randomname.get_name().replace("-", " ").title())
        for _ in range(10000)
    ]
    db.bulk_save_objects(companies_list)
    db.commit()
    my_list = database.CompanyCollection(collection_name="My List")
    liked_companies = database.CompanyCollection(collection_name="Liked Companies List")
    companies_to_ignore = database.CompanyCollection(collection_name="Companies to Ignore List")
    db.add(my_list)
    db.add(liked_companies)
    db.add(companies_to_ignore)
    db.commit()
    associations_my_list = [
        database.CompanyCollectionAssociation(
            company_id=company.id, collection_id=my_list.id
        )
        for company in db.query(database.Company).limit(10000).all()
    ]
    db.bulk_save_objects(associations_my_list)
    associations_liked = [
        database.CompanyCollectionAssociation(
            company_id=company.id, collection_id=liked_companies.id
        )
        for company in db.query(database.Company).limit(10).all()
    ]
    db.bulk_save_objects(associations_liked)
    associations_ignore = [
        database.CompanyCollectionAssociation(
            company_id=company.id, collection_id=companies_to_ignore.id
        )
        for company in db.query(database.Company).limit(50).all()
    ]
    db.bulk_save_objects(associations_ignore)
    db.commit()
    db.execute(text("""
        CREATE OR REPLACE FUNCTION throttle_updates()
        RETURNS TRIGGER AS $$
        BEGIN
            PERFORM pg_sleep(0.1);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """))
    db.execute(text("""
        CREATE TRIGGER throttle_updates_trigger
        BEFORE INSERT ON company_collection_associations
        FOR EACH ROW
        EXECUTE FUNCTION throttle_updates();
    """))
    db.commit()

