# Constitution for `twdiw-chat`
# Last Reviewed: 2025-11-22
                                                                                
This document outlines the core principles, architectural decisions, and quality
 standards for the `twdiw-chat` project. All development must adhere to these gu
idelines to ensure consistency, security, and maintainability.                  
                                                                                
## 1. Core Mission                                                              
- **Purpose**: To create a secure, token-gated chat application where access to 
forums is determined by Verifiable Credentials (VCs).                           
- **Primary Goal**: Enable users to prove their "rank" (e.g., Gold, Silver, Bron
ze) via a VC to join exclusive forums, and to match with peers for private conve
rsations.                                                                       
- **Technology**: Cloudflare Workers, Hono, TypeScript, Domain-Driven Design.   
                                                                                
## 2. Architectural Principles                                                  
- **Serverless First**: The entire application must be deployable on Cloudflare'
s serverless platform (Workers, D1, R2).                                        
- **Domain-Driven Design (DDD)**: The core business logic must be modeled using 
DDD aggregates, value objects, repositories, and domain services. This isolates 
complexity and enhances testability.                                            
- **Secure by Default**: Security is not an afterthought. All features must be d
esigned with security in mind, including data encryption, authentication, author
ization, and input validation.                                                  
- **Immutability**: Prefer immutable data structures and value objects to reduce
 side effects and improve predictability.                                       
- **Explicit Dependencies**: Dependencies should be explicit and managed via int
erfaces to facilitate testing and swapping implementations.                     
                                                                                
## 3. Key Technology Choices                                                    
- **Runtime**: Cloudflare Workers (Node.js compatibility).                      
- **Routing**: Hono - A lightweight, fast web framework for the edge.           
- **Language**: TypeScript 5.x - For type safety and modern language features.  
- **Persistence**: Cloudflare D1 - A serverless SQL database for structured data
.                                                                               
- **Scheduled Jobs**: Cloudflare Cron Triggers - For reliable, scheduled task ex
ecution.                                                                        
- **Testing**: Vitest - For unit and integration tests.                         
- **Authentication**: OIDC (OpenID Connect) with JWTs - For standard, secure use
r authentication and session management.                                        
- **Encryption**: Web Crypto API (AES-256-GCM) - For encrypting sensitive data a
t rest.                                                                         
                                                                                
## 4. Coding Standards & Best Practices                                         
- **Style**: Adhere to the configuration in `.prettierrc` and `.editorconfig`.  
- **Naming**:                                                                   
    - Interfaces: `I` prefix (e.g., `IMemberProfileRepository`).                
    - Classes: PascalCase (e.g., `MemberProfile`).                              
    - Methods/Functions: camelCase (e.g., `verifyWithRankCard`).                
    - Constants: UPPER_SNAKE_CASE (e.g., `JWT_SECRET`).                         
- **Modularity**: Keep files focused on a single responsibility (e.g., one aggre
gate per file, one repository implementation per file).                         
- **Error Handling**:                                                           
    - Use custom exception classes for domain-specific errors (e.g., `ForumCapac
ityReachedException`).                                                          
    - Avoid generic `Error` or `Exception`.                                     
    - Never expose sensitive error details (e.g., stack traces) in API responses
.                                                                               
- **Testing**:                                                                  
    - Aim for high test coverage (>90%) on core domain logic.                   
    - Write tests in a TDD-style where possible.                                
    - Use mocks/stubs for external dependencies (e.g., repositories, external AP
Is).                                                                            
                                                                                
## 5. Security Mandates                                                         
- **PII Encryption**: All Personally Identifiable Information (PII) stored in th
e database MUST be encrypted using the `EncryptedPersonalInfo` value object (AES
-256-GCM).                                                                      
- **Authentication**: All sensitive endpoints MUST be protected by the OIDC auth
entication middleware. JWTs should be short-lived.                              
- **Authorization**: Business logic MUST perform authorization checks (e.g., ran
k requirements, session ownership) before executing actions.                    
- **Session Management**: Use HttpOnly, Secure, SameSite=Strict cookies for toke
ns. Implement refresh token rotation and a robust session expiry/cleanup mechani
sm.                                                                             
- **Input Validation**: All incoming data from users or external systems MUST be
 validated and sanitized to prevent injection attacks (SQLi, XSS).              
- **Secret Management**: API keys, secrets, and other credentials MUST be manage
d via Wrangler secrets, not hardcoded in source code.                           
- **Rate Limiting**: Apply rate limiting to sensitive endpoints to prevent abuse
.                                                                               
- **Replay Attack Prevention**: Use mechanisms like transaction IDs to prevent r
eplay attacks in multi-step processes.                                          
- **XSS Prevention**: Implement server-side HTML escaping for all user-controlle
d data rendered in HTML.                                                        
                                                                                
## 6. Version Control                                                           
- **Commits**: Follow the Conventional Commits specification.                   
- **Branches**: Use feature branches for new development.                       
- **Pull Requests**: All code must be reviewed before merging to `main`.
