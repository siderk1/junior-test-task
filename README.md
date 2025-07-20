# Project Setup Instructions

This project is a test task done by siderk1 for UniverseGroup. To successfully run it, you need to configure environment variables for each microservice and for the root project.

## Environment Variables Setup

Before starting the project, you need to create `.env` files in the following locations:

1. **Project Root**: Create a `.env` file in the root directory.
2. **Each Microservice**: Create a `.env` file inside each microservice's `apps/` subfolder (e.g., `apps/gateway`, `apps/fb-collector`, `apps/ttk-collector`, `apps/reporter`).

For each location:

- Copy the contents of the corresponding `.env.example` file to the new `.env` file.
- Adjust any sensitive values (passwords, secrets, database URLs, etc.) as needed for your environment.

**Example workflow:**

cp .env.example .env  
cp apps/gateway/.env.example apps/gateway/.env  
cp apps/fb-collector/.env.example apps/fb-collector/.env  
cp apps/ttk-collector/.env.example apps/ttk-collector/.env  
cp apps/reporter/.env.example apps/reporter/.env

## Running the Project

Once all required `.env` files are created and filled in, you can build and run the project using Docker Compose:

docker compose up -d --build

## Running Tests

Each microservice contains its own tests (usually in the `test/` folder under the service directory). To run tests for a specific service:

pnpm --filter @repo/<service-name> test

## Notes

- All critical config values (DB connection strings, secrets) are managed via `.env` files.
- **Never commit `.env` files to git!** Only `.env.example` should be versioned.