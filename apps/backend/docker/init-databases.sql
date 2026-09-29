-- Creates the 4 independent databases used by the domain services.
-- Runs automatically the first time the postgres container initializes its data volume.
CREATE DATABASE val_user;
CREATE DATABASE val_market;
CREATE DATABASE val_portfolio;
CREATE DATABASE val_automation;
