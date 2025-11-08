# Quickstart Guide

This guide provides instructions to set up and run the "三人行必有我師論壇" project for local development.

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v20.x or later)
- [pnpm](https://pnpm.io/installation)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (Cloudflare's command-line tool)

## 1. Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd twdiw-chat
    ```

2.  **Install dependencies**:
    This project uses `pnpm` as the package manager.
    ```bash
    pnpm install
    ```

## 2. Configuration

1.  **Set up environment variables**:
    The backend service (Cloudflare Worker) requires environment variables for connecting to external services. Create a `.dev.vars` file in the `backend/` directory.

    ```bash
    # backend/.dev.vars

    # OIDC Provider Configuration
    OIDC_ISSUER_URL="<your-oidc-provider-issuer-url>"
    OIDC_CLIENT_ID="<your-oidc-client-id>"
    OIDC_CLIENT_SECRET="<your-oidc-client-secret>"

    # twdiw API Configuration
    TWDIW_API_KEY="<your-twdiw-api-key>"
    TWDIW_API_ENDPOINT="<your-twdiw-api-endpoint>"

    # tlk.io Configuration
    TLKIO_API_KEY="<your-tlkio-api-key>"
    ```

2.  **Set up Cloudflare D1 Database**:
    Create the D1 database for local development.
    ```bash
    # From the project root
    wrangler d1 create twdiw-chat-db
    ```
    This command will output the database configuration. Add it to your `backend/wrangler.toml` file.

    Then, run the database migrations to create the necessary tables.
    ```bash
    # From the project root
    pnpm run db:migrate
    ```

## 3. Running the Application

The project is split into a `frontend` and `backend`. You will need to run both concurrently in separate terminal sessions.

1.  **Run the Backend Service**:
    ```bash
    # In the first terminal, from the project root
    pnpm run dev:backend
    ```
    This will start the Cloudflare Worker in local development mode.

2.  **Run the Frontend Application**:
    ```bash
    # In a second terminal, from the project root
    pnpm run dev:frontend
    ```
    This will start the frontend development server. You can now access the application in your browser at the address provided (usually `http://localhost:3000`).

## 4. Running Tests

To run the test suite for the project, use the following command:
```bash
pnpm test
```
This will execute the `vitest` test runner and report the results.
