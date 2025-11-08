# Research & Decisions

This document summarizes the research findings and key technical decisions for the "三人行必有我師論壇" feature.

## 1. Constraints

### Decision
The platform will enforce strict security, privacy, and technical constraints to ensure a robust and trustworthy environment. Key constraints include:
- **Security & Privacy**: End-to-end encryption (E2EE) for all real-time chat, encryption of all sensitive data at rest and in transit, and strict compliance with data privacy regulations (e.g., GDPR, CCPA). User control and data minimization are core principles.
- **Technical Standards**: Full compliance with W3C Verifiable Credentials (VC) Data Model v2.0 and Decentralized Identifiers (DIDs) specifications to ensure interoperability.
- **Performance**: The backend infrastructure will be designed for high availability, low-latency chat, and efficient VC verification.

### Rationale
The platform's core functionality revolves around sensitive user data and verifiable credentials, making security and privacy non-negotiable. Adherence to open standards is critical for interoperability with digital wallets and other identity systems, fostering trust and long-term viability. Performance goals are tied directly to user experience and retention.

### Alternatives Considered
- **Weaker Security**: Implementing less stringent security measures (e.g., no E2EE, plaintext data storage) was rejected as it would expose users to significant privacy risks and violate the project's foundational security principles.
- **Proprietary Identity Solution**: Using a proprietary identity system instead of W3C VCs was rejected because it would lead to vendor lock-in and lack the interoperability required for a decentralized identity ecosystem.

## 2. Scale & Scope

### Decision
The project will be developed in phases, starting with a Minimum Viable Product (MVP) that focuses on core functionalities.
- **MVP Scope**:
  1.  User registration and authentication via OIDC.
  2.  "Rank Card" VC verification using the `twdiw` API.
  3.  Access to gated group forums based on verified VC rank.
  4.  "Daily Matching" feature for random 1-on-1 chats.
- **Post-MVP**: The platform will be designed for horizontal scalability to support future features such as private sub-groups, advanced content types (polls, video), and gamification.

### Rationale
A phased, MVP-first approach allows for a faster time-to-market, enabling the team to gather user feedback early and iterate effectively. This strategy mitigates the risk associated with building a large, complex platform in a single "big bang" release and ensures the technical foundation is solid before adding more advanced features.

### Alternatives Considered
- **Full-Feature Initial Launch**: A "big bang" launch that included all potential features (MVP + post-MVP) was rejected. This approach would have significantly increased initial development complexity, delayed the launch, and introduced a higher risk of building features that do not align with user needs.

## 3. Hono Best Practices (Backend Framework)

### Decision
The backend will be built using the **Hono** framework on **Cloudflare Workers**. We will adhere to the following best practices:
- **TypeScript**: Leverage Hono's first-class TypeScript support for a fully type-safe application.
- **Bindings for Resources**: Access Cloudflare resources (D1, KV, environment variables) via the typed `c.env` object.
- **Data Validation**: Use **Zod** for rigorous validation of all incoming request payloads and parameters.
- **CI/CD**: Automate deployments using the Wrangler CLI within a GitHub Actions workflow.

### Rationale
Hono is an ultra-fast, lightweight web framework specifically optimized for edge environments like Cloudflare Workers. Its performance and small footprint are ideal for building a low-latency API. Combining it with TypeScript and Zod provides a robust, maintainable, and secure codebase.

### Alternatives Considered
- **Express.js**: While a popular and mature framework, Express.js is not natively designed for the Cloudflare Workers runtime. Using it would require compatibility layers (e.g., `serverless-express`) that can introduce performance overhead and complexity, making Hono a more suitable choice.

## 4. oidc-client-ts Best Practices (Authentication)

### Decision
The authentication architecture will follow the **Backend for Frontend (BFF)** pattern.
- The **Cloudflare Worker** will act as an OIDC proxy, handling the sensitive parts of the OIDC flow.
- The **Authorization Code Flow with PKCE** will be used for all authentication requests.
- The Worker will manage tokens, storing them securely and using encrypted, HTTP-only cookies for session management with the frontend.

### Rationale
This BFF approach significantly enhances security by preventing sensitive tokens (access and refresh tokens) from being exposed to the browser. The Authorization Code Flow with PKCE is the industry-standard best practice for protecting public clients like Single Page Applications (SPAs) from authorization code interception attacks.

### Alternatives Considered
- **Client-Side OIDC Handling**: Managing the entire OIDC flow on the client-side was rejected. This pattern is less secure as it exposes tokens to the browser, making them vulnerable to XSS and other client-side attacks.

## 5. Cloudflare D1 Best Practices (Database)

### Decision
**Cloudflare D1** will be used as the primary database for storing structured user data, forum information, and session details.
- **Security**: We will leverage D1's built-in encryption at rest and in transit. All queries will use **prepared statements** to prevent SQL injection vulnerabilities.
- **Data Modeling**: We will follow SQLite best practices for schema design, using appropriate indexes to ensure query performance.
- **Data Isolation**: While a "database-per-user" model is an option for extreme isolation, the initial implementation will use a single database with strong application-level access controls, which is sufficient for the MVP's security requirements.
- **Disaster Recovery**: We will rely on D1's **Time Travel** feature for point-in-time recovery.

### Rationale
D1 is a serverless SQL database that integrates seamlessly with Cloudflare Workers, offering a managed, scalable, and secure persistence layer. Its use of SQLite is well-understood, and its features align perfectly with the needs of a serverless application. Prepared statements are a critical and non-negotiable security measure for any SQL-based storage.

### Alternatives Considered
- **Cloudflare KV**: KV is a key-value store and is not suitable for the relational data required by this application (e.g., user profiles with relationships to forums and posts). It was rejected for primary data storage but may be used for caching or session data.
- **External Database**: Using an external, non-Cloudflare database would introduce significant network latency and complexity, negating the benefits of the edge computing model provided by Cloudflare Workers.
