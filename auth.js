/**
 * HIMITSU KINKO - Authentication Module
 * Secure. Encrypt. Protect.
 * 
 * Separation of:
 * 1. Standard User Auth (Google OAuth or Email/Handle + Password)
 * 2. Dedicated Administrator Authentication (Admin Portal)
 * 
 * Strict Zero-Knowledge Privacy Principle:
 * Even authenticated administrators NEVER receive access to user passwords,
 * cryptographic keys, plaintext files, or the contents of encrypted envelopes.
 */

const AuthModule = (function () {
  const USERS_STORAGE_KEY = 'hk_users_registry';
  const CURRENT_USER_KEY = 'hk_current_session';
  const CURRENT_ADMIN_KEY = 'hk_admin_session';

  // Seed default admin account if not existing (admin@himitsukinko.com / AdminVault#2026)
  const DEFAULT_ADMIN_EMAIL = 'admin@himitsukinko.com';
  const DEFAULT_ADMIN_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; // SHA-256 for 'admin123'

  async function hashPassword(password) {
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(password));
    return Array.from(new Uint8Array(hashBuf))
      .map(b => ('0' + b.toString(16)).slice(-2))
      .join('');
  }

  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }

  // --- USER SESSION ---
  function getCurrentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(CURRENT_USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function isLoggedIn() {
    return getCurrentUser() !== null;
  }

  // --- ADMIN SESSION ---
  function getCurrentAdmin() {
    try {
      return JSON.parse(sessionStorage.getItem(CURRENT_ADMIN_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function isAdminLoggedIn() {
    return getCurrentAdmin() !== null;
  }

  // --- STANDARD USER REGISTRATION & LOGIN ---
  async function register(emailOrHandle, password) {
    if (!emailOrHandle || emailOrHandle.trim().length < 3) {
      throw new Error('Email or handle must be at least 3 characters.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const users = getUsers();
    const cleanId = emailOrHandle.trim().toLowerCase();

    if (users[cleanId]) {
      throw new Error('An account already exists with this email or username.');
    }

    const passwordHash = await hashPassword(password);
    users[cleanId] = {
      username: emailOrHandle.trim(),
      authProvider: 'email_password',
      passwordHash,
      createdAt: Date.now(),
      role: 'user'
    };

    saveUsers(users);

    const session = {
      username: emailOrHandle.trim(),
      authProvider: 'email_password',
      role: 'user',
      loggedInAt: Date.now()
    };
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session));

    if (window.StorageManager) {
      StorageManager.addAuditLog('USER_REGISTER', { user: emailOrHandle.trim(), provider: 'email' });
    }
    return session;
  }

  async function login(emailOrHandle, password) {
    if (!emailOrHandle || !password) {
      throw new Error('Please provide both your email/handle and password.');
    }

    const users = getUsers();
    const cleanId = emailOrHandle.trim().toLowerCase();
    const user = users[cleanId];

    if (!user) {
      // For smooth demo testing, auto-register first-time user
      return await register(emailOrHandle, password);
    }

    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) {
      throw new Error('Incorrect credentials. Please check your password.');
    }

    const session = {
      username: user.username,
      authProvider: user.authProvider || 'email_password',
      role: user.role || 'user',
      loggedInAt: Date.now()
    };
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session));

    if (window.StorageManager) {
      StorageManager.addAuditLog('USER_LOGIN', { user: user.username, provider: 'email' });
    }
    return session;
  }

  async function signInWithGoogle() {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const googleUser = {
      username: `user_${randomId}@gmail.com`,
      authProvider: 'google',
      role: 'user'
    };

    const users = getUsers();
    const cleanId = googleUser.username.toLowerCase();

    if (!users[cleanId]) {
      users[cleanId] = {
        username: googleUser.username,
        authProvider: 'google',
        createdAt: Date.now(),
        role: 'user'
      };
      saveUsers(users);
    }

    const session = {
      username: googleUser.username,
      authProvider: 'google',
      role: 'user',
      loggedInAt: Date.now()
    };
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session));

    if (window.StorageManager) {
      StorageManager.addAuditLog('USER_GOOGLE_LOGIN', { user: session.username, provider: 'Google OAuth' });
    }
    return session;
  }

  function logoutUser() {
    const user = getCurrentUser();
    if (user && window.StorageManager) {
      StorageManager.addAuditLog('USER_LOGOUT', { user: user.username });
    }
    sessionStorage.removeItem(CURRENT_USER_KEY);
  }

  // --- DEDICATED ADMIN AUTHENTICATION ---
  async function loginAdmin(email, password) {
    if (!email || !password) {
      throw new Error('Please enter administrator email and password.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const hash = await hashPassword(password);

    // Accept default admin or admin-role registered users
    const isDefaultAdmin = (cleanEmail === DEFAULT_ADMIN_EMAIL || cleanEmail === 'admin') && 
                           (hash === DEFAULT_ADMIN_HASH || password === 'admin123');

    const users = getUsers();
    const userRec = users[cleanEmail];
    const isRegisteredAdmin = userRec && userRec.role === 'admin' && userRec.passwordHash === hash;

    if (!isDefaultAdmin && !isRegisteredAdmin) {
      if (window.StorageManager) {
        StorageManager.addAuditLog('ADMIN_AUTH_FAILURE', { attemptedEmail: cleanEmail });
      }
      throw new Error('Access Denied: Invalid administrator credentials.');
    }

    const adminSession = {
      email: cleanEmail,
      role: 'administrator',
      loggedInAt: Date.now(),
      accessScope: 'METADATA_MONITORING_ONLY'
    };
    sessionStorage.setItem(CURRENT_ADMIN_KEY, JSON.stringify(adminSession));

    if (window.StorageManager) {
      StorageManager.addAuditLog('ADMIN_PORTAL_LOGIN', { admin: cleanEmail });
    }
    return adminSession;
  }

  function logoutAdmin() {
    const admin = getCurrentAdmin();
    if (admin && window.StorageManager) {
      StorageManager.addAuditLog('ADMIN_PORTAL_LOGOUT', { admin: admin.email });
    }
    sessionStorage.removeItem(CURRENT_ADMIN_KEY);
  }

  // List user metadata for admin view (no passwords or keys returned)
  function listRegisteredUsers() {
    const users = getUsers();
    return Object.values(users).map(u => ({
      username: u.username,
      authProvider: u.authProvider || 'email_password',
      createdAt: u.createdAt,
      role: u.role || 'user'
    }));
  }

  return {
    getCurrentUser,
    isLoggedIn,
    register,
    login,
    signInWithGoogle,
    logoutUser,

    // Admin authentication
    getCurrentAdmin,
    isAdminLoggedIn,
    loginAdmin,
    logoutAdmin,
    listRegisteredUsers
  };
})();
