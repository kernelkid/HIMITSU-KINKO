/**
 * HIMITSU KINKO - Ephemeral Storage & Security Telemetry
 * Secure. Encrypt. Protect.
 * 
 * Philosophy: “We don't need to keep your files.”
 * - Ephemeral file store with 1-Hour strict TTL.
 * - One-time download mode ("Burn after reading").
 * - Automatic background worker purges expired links every 30 seconds.
 * - Zero-knowledge audit logging (never logs passwords or decrypted contents).
 * - Metadata & Security Monitoring telemetry for Admin Dashboard.
 */

const StorageManager = (function () {
  const DB_NAME = 'HimitsuKinko_EphemeralStore';
  const DB_VERSION = 1;
  const STORE_NAME = 'temp_files';
  const AUDIT_LOGS_KEY = 'hk_audit_logs';
  const EXPIRATION_MS = 60 * 60 * 1000; // 1 Hour TTL

  let dbPromise = null;

  function openDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('owner', 'owner', { unique: false });
            store.createIndex('expiresAt', 'expiresAt', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  // Security Audit Logs (Operational metadata only - never passwords or file contents)
  function getAuditLogs() {
    try {
      return JSON.parse(localStorage.getItem(AUDIT_LOGS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function addAuditLog(action, details = {}) {
    const logs = getAuditLogs();
    logs.unshift({
      id: 'evt_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      action,
      ...details
    });
    // Keep max 100 recent events
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs.slice(0, 100)));
  }

  function clearAuditLogs() {
    localStorage.removeItem(AUDIT_LOGS_KEY);
  }

  /**
   * Save an encrypted file package temporarily
   */
  async function storeTemporaryFile({ filename, originalSize, encryptedBuffer, owner, isOneTime = false }) {
    const db = await openDB();
    const id = 'hk_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const now = Date.now();
    const expiresAt = now + EXPIRATION_MS;

    const record = {
      id,
      filename,
      originalSize,
      encryptedSize: encryptedBuffer.byteLength,
      encryptedBuffer, // Uint8Array
      owner: owner || 'anonymous',
      createdAt: now,
      expiresAt: expiresAt,
      isOneTime: !!isOneTime,
      downloadCount: 0,
      status: 'active'
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(record);

      req.onsuccess = () => {
        addAuditLog('FILE_STORED_EPHEMERAL', {
          fileId: id,
          filename,
          sizeBytes: encryptedBuffer.byteLength,
          isOneTime,
          owner: owner || 'anonymous',
          ttlMinutes: 60
        });
        resolve({
          id,
          expiresAt,
          isOneTime,
          filename
        });
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Fetch temporary file by ID.
   */
  async function getTemporaryFile(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const record = req.result;
        if (!record) {
          resolve(null);
          return;
        }

        const now = Date.now();
        if (now >= record.expiresAt) {
          store.delete(id);
          addAuditLog('AUTO_DELETE_EXPIRED', { fileId: id, filename: record.filename });
          resolve({ expired: true });
          return;
        }

        record.downloadCount += 1;

        if (record.isOneTime) {
          store.delete(id);
          addAuditLog('ONE_TIME_DOWNLOAD_BURNED', {
            fileId: id,
            filename: record.filename,
            message: 'One-time link destroyed after download.'
          });
          resolve({
            ...record,
            burned: true
          });
        } else {
          store.put(record);
          addAuditLog('FILE_DOWNLOADED', {
            fileId: id,
            filename: record.filename,
            downloadCount: record.downloadCount
          });
          resolve(record);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * List files for a specific user
   */
  async function listUserFiles(ownerUsername) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = req.result || [];
        const now = Date.now();
        const active = records.filter(r => r.owner === ownerUsername && now < r.expiresAt);
        resolve(active);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Admin: List all active files metadata across system (no payload exposed)
   */
  async function getAdminStorageMetrics() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = req.result || [];
        const now = Date.now();
        const active = records.filter(r => now < r.expiresAt);
        const totalBytes = active.reduce((acc, r) => acc + (r.encryptedSize || 0), 0);

        resolve({
          activeCount: active.length,
          totalBytes: totalBytes,
          files: active.map(r => ({
            id: r.id,
            filename: r.filename,
            owner: r.owner,
            isOneTime: r.isOneTime,
            downloadCount: r.downloadCount,
            sizeBytes: r.encryptedSize,
            createdAt: r.createdAt,
            expiresAt: r.expiresAt
          }))
        });
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteFile(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => {
        addAuditLog('FILE_MANUAL_DELETE', { fileId: id });
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Background Cleanup Worker: Purges files older than 1 hour
   */
  async function runCleanupWorker() {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = req.result || [];
        const now = Date.now();
        let purgedCount = 0;

        for (const rec of records) {
          if (now >= rec.expiresAt) {
            store.delete(rec.id);
            purgedCount++;
            addAuditLog('AUTO_CLEANUP_PURGED', {
              fileId: rec.id,
              filename: rec.filename,
              reason: '1-Hour TTL expired'
            });
          }
        }
        if (purgedCount > 0) {
          console.info(`[Himitsu Kinko Worker] Auto-purged ${purgedCount} expired temporary files.`);
        }
      };
    } catch (e) {
      console.warn('[Himitsu Kinko Worker] Cleanup error:', e);
    }
  }

  // Periodic cleanup
  setInterval(runCleanupWorker, 30000);

  return {
    storeTemporaryFile,
    getTemporaryFile,
    listUserFiles,
    getAdminStorageMetrics,
    deleteFile,
    runCleanupWorker,
    getAuditLogs,
    addAuditLog,
    clearAuditLogs,
    EXPIRATION_MS
  };
})();
