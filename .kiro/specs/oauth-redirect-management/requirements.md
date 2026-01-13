# Requirements Document

## Introduction

外部サイトでのマッシュアップ表示を可能にするため、OAuth 2.0認可コードフローを実装し、ダッシュボード側でユーザーごとに許可するリダイレクト先を管理できる機能を提供する。これにより、セキュアで制御された外部API連携を実現する。

**技術要件**: Node.js v22.18.0以上を使用し、OAuth識別子（認可コード、アクセストークン、クライアントID）にはbase64url エンコーディングを採用してURL安全性を確保する。

## Glossary

- **OAuth_Server**: 本サービスのOAuth 2.0認可サーバー
- **External_Site**: 外部のクライアントサイト（個人ブログ等）
- **Redirect_Manager**: ダッシュボード内のリダイレクト先管理機能
- **Authorization_Code**: OAuth 2.0認可コードフロー内の一時的な認可コード（base64url エンコード）
- **Access_Token**: APIアクセス用のアクセストークン（base64url エンコード）
- **Client_Application**: 外部サイトのOAuthクライアント登録情報
- **Base64url**: URL安全なbase64エンコーディング（RFC 4648 Section 5準拠）

## Requirements

### Requirement 1: OAuth 2.0認可コードフロー実装

**User Story:** As an external site developer, I want to integrate with the service using OAuth 2.0, so that I can securely access user data for mashup displays.

#### Acceptance Criteria

1. WHEN an external site initiates OAuth flow, THE OAuth_Server SHALL redirect users to the authorization page
2. WHEN a user approves authorization, THE OAuth_Server SHALL return a base64url-encoded authorization code to the registered redirect URI
3. WHEN an external site exchanges the authorization code, THE OAuth_Server SHALL return a base64url-encoded access token
4. WHEN an access token is used for API calls, THE OAuth_Server SHALL validate the base64url-encoded token and return appropriate data
5. THE OAuth_Server SHALL support standard OAuth 2.0 parameters (client_id, redirect_uri, response_type, scope, state)
6. THE OAuth_Server SHALL generate all OAuth identifiers using base64url encoding for URL safety

### Requirement 2: ダッシュボードでのリダイレクト先管理

**User Story:** As a service user, I want to manage allowed redirect URIs in my dashboard, so that I can control which external sites can access my data.

#### Acceptance Criteria

1. WHEN a user accesses the redirect management page, THE Redirect_Manager SHALL display current registered redirect URIs
2. WHEN a user adds a new redirect URI, THE Redirect_Manager SHALL validate the URI format and save it
3. WHEN a user removes a redirect URI, THE Redirect_Manager SHALL delete it and invalidate related tokens
4. WHEN a user edits a redirect URI, THE Redirect_Manager SHALL update the URI and maintain existing authorizations
5. THE Redirect_Manager SHALL enforce HTTPS requirement for production redirect URIs
6. THE Redirect_Manager SHALL limit the number of redirect URIs per user (maximum 10)

### Requirement 3: クライアントアプリケーション登録

**User Story:** As a service user, I want to register external applications, so that I can manage which applications can request authorization.

#### Acceptance Criteria

1. WHEN a user creates a new client application, THE Client_Application SHALL generate a unique base64url-encoded client_id and client_secret
2. WHEN a user configures a client application, THE Client_Application SHALL store application name, description, and allowed redirect URIs
3. WHEN a user views client applications, THE Client_Application SHALL display application details and usage statistics
4. WHEN a user revokes a client application, THE Client_Application SHALL invalidate all related tokens immediately
5. THE Client_Application SHALL enforce unique application names per user
6. THE Client_Application SHALL use base64url encoding for all generated identifiers

### Requirement 4: セキュリティとバリデーション

**User Story:** As a system administrator, I want robust security controls, so that unauthorized access is prevented.

#### Acceptance Criteria

1. WHEN validating redirect URIs, THE OAuth_Server SHALL ensure exact match with registered URIs
2. WHEN processing authorization requests, THE OAuth_Server SHALL validate client_id and redirect_uri combination
3. WHEN issuing access tokens, THE OAuth_Server SHALL include appropriate scope limitations
4. IF an invalid redirect_uri is provided, THEN THE OAuth_Server SHALL reject the request with an error
5. THE OAuth_Server SHALL implement PKCE (Proof Key for Code Exchange) for enhanced security
6. THE OAuth_Server SHALL log all authorization attempts for audit purposes

### Requirement 5: API アクセス制御

**User Story:** As a service provider, I want to control API access through OAuth tokens, so that data access is properly authorized.

#### Acceptance Criteria

1. WHEN an API request includes a valid access token, THE API_Server SHALL return user-specific data
2. WHEN an API request lacks a valid token, THE API_Server SHALL return a 401 Unauthorized error
3. WHEN an access token expires, THE API_Server SHALL reject requests and require token refresh
4. THE API_Server SHALL respect scope limitations defined in the access token
5. THE API_Server SHALL implement rate limiting per client application

### Requirement 6: CORS設定管理

**User Story:** As a service user, I want to configure CORS settings for my registered domains, so that my external sites can make direct API calls.

#### Acceptance Criteria

1. WHEN a user registers a redirect URI, THE CORS_Manager SHALL automatically add the domain to allowed origins
2. WHEN a user removes a redirect URI, THE CORS_Manager SHALL remove the domain from allowed origins
3. WHEN processing API requests, THE CORS_Manager SHALL validate request origin against allowed domains
4. THE CORS_Manager SHALL support both HTTP (development) and HTTPS (production) origins
5. THE CORS_Manager SHALL include appropriate CORS headers in API responses

### Requirement 7: ダッシュボードUI統合

**User Story:** As a service user, I want an intuitive interface in my dashboard, so that I can easily manage OAuth settings.

#### Acceptance Criteria

1. WHEN a user navigates to OAuth settings, THE Dashboard_UI SHALL display a dedicated OAuth management page
2. WHEN displaying client applications, THE Dashboard_UI SHALL show application cards with key information
3. WHEN adding redirect URIs, THE Dashboard_UI SHALL provide real-time validation feedback
4. WHEN viewing authorization history, THE Dashboard_UI SHALL display recent OAuth activities
5. THE Dashboard_UI SHALL provide clear instructions for external site integration

### Requirement 8: トークン管理とライフサイクル

**User Story:** As a system administrator, I want proper token lifecycle management, so that security is maintained over time.

#### Acceptance Criteria

1. WHEN issuing access tokens, THE Token_Manager SHALL set appropriate expiration times (1 hour default)
2. WHEN issuing refresh tokens, THE Token_Manager SHALL set longer expiration times (30 days default)
3. WHEN a refresh token is used, THE Token_Manager SHALL issue new access and refresh tokens
4. WHEN a user revokes authorization, THE Token_Manager SHALL invalidate all related tokens immediately
5. THE Token_Manager SHALL clean up expired tokens automatically