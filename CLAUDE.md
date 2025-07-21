# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Status (Last Updated: 2025-07-16)

[... existing content remains unchanged ...]

### ADFS Single Sign-On (SSO) Implementation Discussion

#### ADFS Authentication Flow
- **Requirements for Main Page ADFS SSO**:
  - Implement Azure Active Directory Federation Services (ADFS) authentication
  - Centralized login mechanism for enterprise environment
  - Support for both service principal and user-based authentication
  - Minimal changes to existing architecture
  - Secure token management
  - Automatic user role/permission mapping

- **Key Authentication Flow Steps**:
  1. User accesses main application page
  2. Redirect to ADFS login endpoint
   - Use OpenID Connect or SAML 2.0 protocol
   - Supports enterprise credentials
  3. Azure AD/ADFS validates user credentials
   - Multi-factor authentication (MFA) support
   - Enterprise password policies
  4. Generate access token and ID token
   5. Redirect back to application with tokens
   6. Frontend validates and stores tokens
   7. Backend validates token for each request
   8. Extract user information (email, roles, groups)

- **Frontend Authentication Management**:
  - Use `@azure/msal-react` for React integration
  - Configure ADFS/Azure AD application registration
  - Handle login/logout flows
  - Token caching and renewal
  - Silent token refresh mechanism

- **Backend Authentication Validation**:
  - Use `azure-identity` Python library
  - Validate JWT tokens
  - Extract claims for authorization
  - Implement role-based access control (RBAC)
  - Token introspection endpoint

- **Security Considerations**:
  - Use HTTPS for all authentication flows
  - Implement token expiration and renewal
  - Secure token storage (HttpOnly cookies)
  - Protect against CSRF and XSS attacks
  - Implement proper logout mechanism
  - Log authentication events for audit trail

- **Potential Challenges**:
  - Handling token refresh
  - Managing different authentication scenarios
  - Performance overhead of token validation
  - Complex enterprise authentication requirements

- **Recommended Libraries**:
  - Frontend: `@azure/msal-react`
  - Backend (Python): `azure-identity`, `PyJWT`
  - Token Management: `cryptography` library

- **Configuration Requirements**:
  - Azure AD/ADFS application registration
  - Client ID and client secret
  - Tenant ID
  - Redirect URIs
  - Scope configuration
  - Enterprise-specific federation settings

#### Next Steps for Implementation
1. Register application in Azure Active Directory
2. Configure enterprise federation settings
3. Implement MSAL React for frontend
4. Add Azure Identity validation in backend
5. Create authentication middleware
6. Implement token refresh mechanism
7. Add comprehensive logging for auth events
8. Develop robust error handling
9. Perform security testing and penetration testing
