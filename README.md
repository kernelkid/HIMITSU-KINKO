# 🛡️ HIMITSU KINKO (秘密金庫)
### *Zero-Knowledge, Client-Side Cryptographic Vault & Ephemeral Sharing Platform*

[![Web Crypto API](https://img.shields.io/badge/Security-Web%20Crypto%20API-06b6d4?style=flat-square&logo=security&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
[![Encryption](https://img.shields.io/badge/Cipher-AES--256--GCM-10b981?style=flat-square)](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
[![KDF](https://img.shields.io/badge/KDF-PBKDF2--SHA256%20(100k%20rounds)-8b5cf6?style=flat-square)](https://tools.ietf.org/html/rfc8018)
[![Architecture](https://img.shields.io/badge/Architecture-Zero--Knowledge-f59e0b?style=flat-square)](#-zero-knowledge-guarantee)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

> **"Secure. Encrypt. Protect."**  
> **Himitsu Kinko** (*Japanese for "Secret Safe / Confidential Vault"*) is a privacy-first, zero-knowledge cybersecurity web platform. It delivers client-side authenticated file encryption, tamper-proof decryption, and secure ephemeral file-sharing with an automated 1-hour time-to-live (TTL) and "burn-after-reading" capability.

---

## 📑 Table of Contents

- [Core Purpose & Value Proposition](#-core-purpose--value-proposition)
- [Zero-Knowledge Architecture](#-zero-knowledge-architecture)
- [Key Features](#-key-features)
- [Cryptographic Specifications & Binary Format](#-cryptographic-specifications--binary-format)
  - [PBKDF2 Key Derivation](#1-key-derivation-pbkdf2)
  - [AES-256-GCM Envelope Structure](#2-envelope-format-himitsu1)
- [Application Workflows](#-application-workflows)
  - [1. Instant Local Encryption (No Account)](#workflow-1-instant-local-encryption-v1)
  - [2. Ephemeral Link Sharing & TTL (Authenticated)](#workflow-2-ephemeral-link-sharing-v2)
  - [3. Isolated Admin Telemetry Portal](#workflow-3-isolated-admin-telemetry-portal)
- [File & Codebase Documentation](#-file--codebase-documentation)
- [API & Module Reference](#-api--module-reference)
  - [CryptoEngine (`js/crypto.js`)](#cryptoengine-jscryptojs)
  - [StorageManager (`js/storage.js`)](#storagemanager-jsstoragejs)
  - [AuthModule (`js/auth.js`)](#authmodule-jsauthjs)
  - [Application Controller (`js/app.js`)](#application-controller-jsappjs)
  - [Admin Controller (`js/admin.js`)](#admin-controller-jsadminjs)
- [Admin Portal & Privacy Guardrails](#-admin-portal--privacy-guardrails)
- [Quickstart & Local Setup](#-quickstart--local-setup)
- [Security Considerations & Threat Model](#-security-considerations--threat-model)

---

## 🎯 Core Purpose & Value Proposition

Traditional cloud storage and sharing utilities retain decryption keys, metadata, or unencrypted byte buffers on centralized servers, exposing files to man-in-the-middle (MITM) attacks, cloud breaches, and insider threats.

**Himitsu Kinko solves this by enforcing absolute cryptographic isolation:**
1. **Zero Cloud Ingestion for Core Operations**: Local encryption and decryption occur entirely within your browser's private memory buffers using native hardware-accelerated Web Cryptography primitives.
2. **Ephemeral Transience**: Shared files exist strictly within a time-boxed buffer (60-minute TTL or instant one-time burn on download).
3. **Strict Privacy Boundary**: Even platform administrators have zero visibility into plaintext content, file payloads, or encryption passphrases.

---

## 🛡️ Zero-Knowledge Guarantee

```
┌────────────────────────────────────────────────────────────────────────┐
│                        USER BROWSER / CLIENT RAM                       │
│                                                                        │
│  [ Plaintext File ] + [ User Passphrase ]                              │
│           │                     │                                      │
│           ▼                     ▼                                      │
│  Crypto.getRandomValues()  PBKDF2-HMAC-SHA256 (100,000 rounds)         │
│     (16B Salt, 12B IV)          │                                      │
│           │                     ▼                                      │
│           └──────────► AES-256-GCM Hardware Encrypt ◄─────────────────┘
│                                 │
│                                 ▼
│                    [ Sealed .enc Binary Payload ]
│                     (Magic: HIMITSU1 + GCM Tag)
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ (Only encrypted payload stored)
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    EPHEMERAL STORE / ADMIN TELEMETRY                   │
│                                                                        │
│  • Holds encrypted envelope ONLY during active TTL (Max: 1 Hour)       │
│  • Purges immediately after download (if One-Time Burn enabled)        │
│  • Zero access to Passwords, Derived Keys, or Plaintext                │
└────────────────────────────────────────────────────────────────────────┘
```

| Asset | Visible to Client? | Stored on Server / DB? | Visible to Administrator? |
| :--- | :---: | :---: | :---: |
| **Plaintext File Content** | ✅ Yes (Client RAM only) | ❌ Never | ❌ Never |
| **Encryption Passphrase** | ✅ Yes (User input only) | ❌ Never | ❌ Never |
| **AES-256 Symmetric Key** | ✅ Derived in RAM | ❌ Never | ❌ Never |
| **Salt & IV (Nonces)** | ✅ Packaged in Header | ✅ Public in Envelope | ✅ Visible (Metadata) |
| **Encrypted Ciphertext** | ✅ Output file | ⏳ Ephemeral (Max 1hr) | ⏳ Stored as opaque blob |
| **Encrypted File Metadata** | ✅ Yes | ⏳ File name & size (1hr) | ✅ Size, TTL & timestamps |

---

## ⚡ Key Features

- **Standard-Compliant Cryptography**: Powered by the W3C Web Cryptography API (`crypto.subtle`) using **AES-256-GCM** (Galois/Counter Mode) with an authenticated 128-bit integrity tag.
- **Robust Key Stretching**: Derives 256-bit symmetric keys using **PBKDF2** with **100,000 iterations** of HMAC-SHA-256 and a 128-bit cryptographically secure pseudorandom salt (`crypto.getRandomValues`).
- **No-Account Local Mode (v1)**: Encrypt and decrypt unlimited local files on your computer with zero account creation or network requests.
- **Expiring Links (v2)**: Generate secure download URLs that self-destruct after **60 minutes**.
- **Burn-After-Reading**: One-time download mode that permanently deletes the encrypted record the moment the recipient downloads it.
- **Client-Side Integrity Verification**: Decryption automatically validates the 128-bit GCM authentication tag. If even a single bit of the file or password is wrong, decryption fails cleanly without leaking corrupted data.
- **Real-Time Entropy Meter**: Evaluates user passphrase complexity and length, enforcing strong security standards before sealing envelopes.
- **Separated Admin Dashboard**: A standalone telemetry portal (`/admin.html`) offering real-time system monitoring, storage consumption metrics, and security audit logs without compromising zero-knowledge privacy.

---

## 🔐 Cryptographic Specifications & Binary Format

### 1. Key Derivation (PBKDF2)
- **Base Algorithm**: PBKDF2 (Password-Based Key Derivation Function 2)
- **Hash Function**: HMAC-SHA-256
- **Salt**: 16 bytes (128 bits) generated via `crypto.getRandomValues()`
- **Iteration Count**: `100,000` rounds
- **Derived Key**: 256-bit AES-GCM key (`length: 256`, non-extractable)

### 2. Envelope Format (`HIMITSU1`)
Encrypted files generated by Himitsu Kinko carry the `.enc` extension and strictly follow this binary specification:

```
+------------------+-------------------+------------------+----------------------+--------------------+---------------------------------------+
|  MAGIC HEADER    |    SALT (16B)     |     IV (12B)     | FILENAME LENGTH (2B) |   ORIGINAL NAME    |         CIPHERTEXT + AUTH TAG         |
|   "HIMITSU1"     | 128-bit random    | 96-bit unique    | Big-Endian uint16    | UTF-8 Encoded      | AES-256-GCM output buffer             |
|   (8 bytes)      | bytes             | nonce            |                      | (N bytes)          | (Variable + 16-byte GCM Tag)          |
+------------------+-------------------+------------------+----------------------+--------------------+---------------------------------------+
| Offset: 0..7     | Offset: 8..23     | Offset: 24..35   | Offset: 36..37       | Offset: 38..(38+N) | Offset: (38+N)..EOF                   |
+------------------+-------------------+------------------+----------------------+--------------------+---------------------------------------+
```

- **Header Signature (`HIMITSU1`)**: Prevents parsing of incompatible files.
- **Initialization Vector (`IV`)**: Unique 96-bit (12 bytes) nonce generated per encryption event, preventing replay and key-stream reuse attacks.
- **Metadata Framing**: The original filename and extension are preserved within the encrypted package so that the recipient can restore the exact file upon authenticated decryption.
- **Integrity Tag**: AES-256-GCM automatically appends a 16-byte authentication tag to the ciphertext. Decryption fails if the file is tampered with or if the password is incorrect.

---

## 🔄 Application Workflows

### Workflow 1: Instant Local Encryption (v1)
1. User drops any file (up to 200MB) onto the encryption zone.
2. User provides a custom password (checked by the real-time entropy meter).
3. The browser creates an `ArrayBuffer`, generates random Salt & IV, derives the key, and encrypts the buffer.
4. The sealed `.enc` binary is compiled and downloaded directly onto the user's hard drive.
5. All memory pointers are released and garbage collected.

### Workflow 2: Ephemeral Link Sharing (v2)
1. User authenticates via Google OAuth (simulated/pluggable) or Email/Password.
2. User encrypts their target file.
3. User opts to generate an ephemeral share link:
   - **Standard Mode**: Stored with an automatic 1-hour expiration timestamp.
   - **Burn After Reading**: Configured to auto-destruct immediately after 1 download.
4. The recipient opens the unique URL (`index.html?fileId=...`), downloads the payload, and decrypts it with the secret passphrase shared out-of-band by the sender.
5. A background worker periodically purges all records older than 60 minutes.

### Workflow 3: Isolated Admin Telemetry Portal
1. Accessed through `/admin.html` (separated from public navigation).
2. Secured by administrator credentials (`admin@himitsukinko.com`).
3. Renders high-level platform telemetry:
   - Total registered user accounts & auth providers.
   - Active ephemeral files count and total storage footprint.
   - Live security audit feed (failed auth attempts, purge triggers, download cycles).
   - **Guaranteed Zero-Access**: Does not provide administrative routes or APIs to decrypt or inspect payloads.

---

## 📁 File & Codebase Documentation

```
cap final/
├── index.html              # Main public application: Landing page, Local Encrypt/Decrypt, Link Sharing
├── admin.html              # Isolated Administrator Portal (Metrics, Audit Log & Storage monitoring)
├── css/
│   └── styles.css          # Cyber-glassmorphism styles, responsive layout, animations & custom UI components
├── js/
│   ├── tailwind-config.js  # Tailwind CSS theme configuration (custom palette: vault-950, cyan, emerald)
│   ├── crypto.js           # Core Web Cryptography engine (AES-256-GCM, PBKDF2, Envelope serialization)
│   ├── auth.js             # Authentication provider (Email/Password, Google OAuth, Admin role control)
│   ├── storage.js          # Ephemeral IndexedDB manager, 1-Hour TTL cleanup worker, audit log engine
│   ├── app.js              # UI controller for index.html (Event handling, Drag-and-Drop, progress bars)
│   └── admin.js            # Controller for admin.html (Telemetry cards, activity feeds, metrics renderer)
└── README.md               # Detailed system documentation
```

---

## 🔧 API & Module Reference

### `CryptoEngine` (`js/crypto.js`)
The core cryptographic engine exposing pure client-side Web Crypto operations.

| Method | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `encryptFile()` | `file: File, password: str, onProgress?: fn` | `Promise<Object>` | Reads file into memory, derives key via PBKDF2, encrypts via AES-GCM, and packages `HIMITSU1` binary envelope. |
| `decryptFile()` | `fileOrBuffer: File\|ArrayBuffer, password: str, onProgress?: fn` | `Promise<Object>` | Parses binary envelope, validates magic header, extracts Salt/IV/Filename, authenticates tag, and returns restored buffer. |
| `toHexString()` | `byteArray: Uint8Array` | `string` | Converts raw cryptographic bytes into uppercase hexadecimal format. |
| `formatBytes()` | `bytes: number` | `string` | Converts integer byte counts into readable strings (`KB`, `MB`, `GB`). |

---

### `StorageManager` (`js/storage.js`)
Manages ephemeral file storage using IndexedDB (`HimitsuKinko_EphemeralStore`) and security audit logging.

| Method | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `storeTemporaryFile()` | `{ filename, originalSize, encryptedBuffer, owner, isOneTime }` | `Promise<Object>` | Persists an encrypted buffer with a 60-minute expiration timestamp (`expiresAt = now + 3600000`). |
| `getTemporaryFile()` | `id: string` | `Promise<Object>` | Retrieves a file by ID. Deletes the file if expired or if flagged as `isOneTime: true`. |
| `listUserFiles()` | `ownerUsername: string` | `Promise<Array>` | Returns all non-expired file records created by a given user. |
| `deleteFile()` | `id: string` | `Promise<boolean>` | Manually removes an ephemeral file from IndexedDB. |
| `runCleanupWorker()` | *None* | `Promise<void>` | Background routine running every 30 seconds to purge expired records. |
| `getAuditLogs()` | *None* | `Array<Object>` | Retrieves the last 100 non-sensitive operational audit logs from `localStorage`. |
| `addAuditLog()` | `action: string, details?: Object` | `void` | Records operational actions (e.g., `FILE_ENCRYPTED_LOCAL`, `AUTO_CLEANUP_PURGED`). |
| `getAdminStorageMetrics()` | *None* | `Promise<Object>` | Aggregates active file count, total bytes stored, and file metadata for admin reporting. |

---

### `AuthModule` (`js/auth.js`)
Handles session management, role verification, and password hashing for both regular users and administrators.

| Method | Parameters | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `register()` | `emailOrHandle: str, password: str` | `Promise<Object>` | Hashes password with SHA-256 and registers a new user in local registry. |
| `login()` | `emailOrHandle: str, password: str` | `Promise<Object>` | Verifies password hash and creates a user session in `sessionStorage`. |
| `signInWithGoogle()`| *None* | `Promise<Object>` | Simulates Google OAuth flow, registering or logging in a Google identity. |
| `logoutUser()` | *None* | `void` | Clears active user session and records an audit log. |
| `loginAdmin()` | `email: str, password: str` | `Promise<Object>` | Validates administrator credentials against default credentials or admin-tier users. |
| `logoutAdmin()` | *None* | `void` | Destroys admin session token. |
| `listRegisteredUsers()`| *None* | `Array<Object>` | Exposes safe user metadata (username, auth provider, creation date) for admin tables. |

---

### Application Controller (`js/app.js`)
Connects the user interface in `index.html` to the core libraries:
- **`initUI()`**: Binds password visibility toggles, strength checking, and drag-and-drop file listeners.
- **`switchDashboardTab(tab)`**: Toggles UI view between the Encrypt and Decrypt workspaces.
- **`updatePasswordStrength()`**: Calculates entropy score based on length, symbols, numbers, and casing.
- **`executeEncryption()` / `executeDecryption()`**: Manages async progress state, error banners, and triggers file downloads.
- **`confirmGenerateShareLink()`**: Persists payload into `StorageManager` and generates a shareable query link (`?fileId=...`).
- **`initLinkHandling()`**: Detects `?fileId=` on page load, queries IndexedDB, and displays a prominent recipient download banner.

---

### Admin Controller (`js/admin.js`)
Controls the isolated administrator interface in `admin.html`:
- **`checkAdminSession()`**: Enforces authentication guardrails on the admin panel.
- **`switchAdminPortalTab(tab)`**: Switches between Telemetry tabs: Activity Feed, Registered Users, Storage Footprint, and Security Events.
- **`refreshAdminDashboardData()`**: Gathers aggregate metrics from `StorageManager` and updates dashboard cards and data tables.

---

## 📊 Admin Portal & Privacy Guardrails

The Admin Portal is located at `/admin.html` and is decoupled from standard user flows.

### Demo Admin Credentials
- **Portal URL**: `http://localhost:8000/admin.html`
- **Email**: `admin@himitsukinko.com`
- **Password**: `admin123`

### Absolute Privacy Separation Matrix

```
┌─────────────────────────────────────────────────────────────┐
│                      WHAT ADMIN CAN SEE                     │
├─────────────────────────────────────────────────────────────┤
│  ✔ Total number of registered user accounts                 │
│  ✔ Authentication providers (Email vs. Google OAuth)        │
│  ✔ Active temporary file count & total storage size (MB/GB) │
│  ✔ Ephemeral link expiration counters (Minutes left to TTL) │
│  ✔ Operational audit events & cleanup purge triggers        │
└─────────────────────────────────────────────────────────────┘
                              VS.
┌─────────────────────────────────────────────────────────────┐
│                   WHAT ADMIN CAN NEVER SEE                  │
├─────────────────────────────────────────────────────────────┤
│  ✖ Plaintext passwords or master keys                       │
│  ✖ PBKDF2 derived keys                                      │
│  ✖ Plaintext file contents or preview images                │
│  ✖ Decrypted byte buffers                                   │
│  ✖ Payload contents of active ephemeral envelopes           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quickstart & Local Setup

Himitsu Kinko is built with modern, dependency-free vanilla web technologies. It runs on any standard HTTP server without complex build steps or node modules.

### Prerequisites
- Any modern web browser supporting the [Web Cryptography API](https://caniuse.com/cryptography) (Chrome, Edge, Firefox, Safari, Opera).
- A lightweight local HTTP server (required for IndexedDB and Web Workers).

### Step-by-Step Launch

1. **Clone or Navigate to the Project Directory**:
   ```bash
   cd "cap final"
   ```

2. **Start a Local Server**:
   ```bash
   # Using Python 3 (Recommended)
   python -m http.server 8000

   # Or using Node.js npx serve
   npx serve .

   # Or using PHP
   php -S localhost:8000
   ```

3. **Access the Application**:
   - **Main User Platform**: Open [http://localhost:8000](http://localhost:8000)
   - **Isolated Admin Portal**: Open [http://localhost:8000/admin.html](http://localhost:8000/admin.html)

---

## 🔒 Security Considerations & Threat Model

### Cryptographic Strengths
- **Replay Protection**: Every encrypted envelope uses a fresh, cryptographically secure 12-byte IV (`crypto.getRandomValues`). An IV is never reused with the same key.
- **Brute-Force Resistance**: 100,000 rounds of PBKDF2-SHA256 significantly increase the computational cost for offline dictionary and rainbow table attacks.
- **Authentication & Integrity**: AES-256-GCM uses an authenticated cipher mode. Any modification to ciphertext, salt, or IV produces an `OperationError` on decryption, preventing bit-flipping attacks.

### Browser Environment Best Practices
- Always serve Himitsu Kinko over **HTTPS** (or `localhost` for development) to ensure the Web Crypto API is available in a secure context.
- Keep passphrases secret; passwords are never sent across the network or logged in telemetry.

---

## 📄 License
This project is released under the [MIT License](LICENSE).  
*Himitsu Kinko — Empowering personal data sovereignty through zero-knowledge encryption.*
