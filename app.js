/**
 * HIMITSU KINKO - Application Controller
 * Secure. Encrypt. Protect.
 * Connects UI interactions, CryptoEngine, AuthModule, and StorageManager.
 */

// Application State
let selectedEncryptFile = null;
let selectedDecryptFile = null;
let encryptedBlobUrl = null;
let decryptedBlobUrl = null;
let lastEncryptedPayload = null;

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initAuthUI();
  initLinkHandling();
  StorageManager.runCleanupWorker();
});

// --------------------------------------------------------------------------
// UI Initialization & Event Handlers
// --------------------------------------------------------------------------
function initUI() {
  const currentYearEl = document.getElementById('current-year');
  if (currentYearEl) currentYearEl.textContent = new Date().getFullYear();

  // Password strength meter
  const encPasswordInput = document.getElementById('enc-password');
  if (encPasswordInput) {
    encPasswordInput.addEventListener('input', updatePasswordStrength);
  }

  // Setup Drag & Drop for Encrypt
  setupDropZone(
    'enc-drop-zone',
    'enc-file-input',
    handleEncryptFileSelected
  );

  // Setup Drag & Drop for Decrypt
  setupDropZone(
    'dec-drop-zone',
    'dec-file-input',
    handleDecryptFileSelected
  );
}

// --------------------------------------------------------------------------
// Navigation & Dashboard Tabs
// --------------------------------------------------------------------------
function switchDashboardTab(tab) {
  const btnEncrypt = document.getElementById('tab-btn-encrypt');
  const btnDecrypt = document.getElementById('tab-btn-decrypt');
  const modEncrypt = document.getElementById('module-encrypt');
  const modDecrypt = document.getElementById('module-decrypt');
  const badgeText = document.getElementById('crypto-state-text');

  if (tab === 'encrypt') {
    btnEncrypt.className = 'flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-heading font-bold text-sm tracking-wider uppercase transition-all cyber-cyan-gradient text-vault-950 shadow-md';
    btnDecrypt.className = 'flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-heading font-bold text-sm tracking-wider uppercase text-slate-400 hover:text-white transition-all';
    modEncrypt.classList.remove('hidden');
    modDecrypt.classList.add('hidden');
    badgeText.textContent = selectedEncryptFile ? 'Status: File loaded, ready to encrypt' : 'Status: Ready for file input';
  } else {
    btnDecrypt.className = 'flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-heading font-bold text-sm tracking-wider uppercase transition-all cyber-cyan-gradient text-vault-950 shadow-md';
    btnEncrypt.className = 'flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-heading font-bold text-sm tracking-wider uppercase text-slate-400 hover:text-white transition-all';
    modDecrypt.classList.remove('hidden');
    modEncrypt.classList.add('hidden');
    badgeText.textContent = selectedDecryptFile ? 'Status: Encrypted payload ready' : 'Status: Ready for payload';
  }
}

function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// --------------------------------------------------------------------------
// Password Strength Meter
// --------------------------------------------------------------------------
function updatePasswordStrength() {
  const encPasswordInput = document.getElementById('enc-password');
  const strengthBar = document.getElementById('strength-bar');
  const strengthLabel = document.getElementById('strength-label');
  const pwd = encPasswordInput.value;

  if (!pwd) {
    strengthBar.style.width = '0%';
    strengthLabel.textContent = 'Strength: Awaiting input';
    strengthLabel.className = 'text-xs font-mono text-vault-cyan';
    return;
  }

  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (pwd.length >= 16) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

  if (score <= 2) {
    strengthBar.style.width = '25%';
    strengthBar.className = 'h-full rounded-full bg-rose-500 transition-all';
    strengthLabel.textContent = 'Strength: Weak';
    strengthLabel.className = 'text-xs font-mono text-rose-400 font-bold';
  } else if (score <= 4) {
    strengthBar.style.width = '60%';
    strengthBar.className = 'h-full rounded-full bg-amber-400 transition-all';
    strengthLabel.textContent = 'Strength: Good';
    strengthLabel.className = 'text-xs font-mono text-amber-400 font-bold';
  } else {
    strengthBar.style.width = '100%';
    strengthBar.className = 'h-full rounded-full bg-vault-emerald transition-all';
    strengthLabel.textContent = 'Strength: Robust (256-bit)';
    strengthLabel.className = 'text-xs font-mono text-vault-emerald font-bold';
  }
}

// --------------------------------------------------------------------------
// Drag & Drop Setup
// --------------------------------------------------------------------------
function setupDropZone(dropZoneId, inputId, onFileSelected) {
  const dropZone = document.getElementById(dropZoneId);
  const fileInput = document.getElementById(inputId);

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  });
}

// --------------------------------------------------------------------------
// Encryption Workflow (No login needed)
// --------------------------------------------------------------------------
function handleEncryptFileSelected(file) {
  if (file.size > 200 * 1024 * 1024) {
    alert('Notice: Maximum file size limit is 200MB.');
    return;
  }
  selectedEncryptFile = file;
  document.getElementById('enc-filename').textContent = file.name;
  document.getElementById('enc-filesize').textContent = CryptoEngine.formatBytes(file.size);
  document.getElementById('enc-drop-zone').classList.add('hidden');
  document.getElementById('enc-file-info').classList.remove('hidden');
  document.getElementById('crypto-state-text').textContent = 'Status: File ready for encryption';
  document.getElementById('crypto-state-badge').className = 'flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-vault-800 text-vault-cyan font-mono text-xs border border-vault-cyan/40';
}

function clearEncryptFile() {
  selectedEncryptFile = null;
  lastEncryptedPayload = null;
  document.getElementById('enc-file-input').value = '';
  document.getElementById('enc-file-info').classList.add('hidden');
  document.getElementById('enc-drop-zone').classList.remove('hidden');
  document.getElementById('enc-output-box').classList.add('hidden');
  document.getElementById('enc-progress-container').classList.add('hidden');
  document.getElementById('telemetry-salt').textContent = 'Auto-generated';
  document.getElementById('telemetry-iv').textContent = 'Auto-generated';
  if (encryptedBlobUrl) {
    URL.revokeObjectURL(encryptedBlobUrl);
    encryptedBlobUrl = null;
  }
  document.getElementById('crypto-state-text').textContent = 'Status: Ready for input';
}

async function executeEncryption() {
  if (!selectedEncryptFile) {
    alert('Please select a file to encrypt.');
    return;
  }
  const password = document.getElementById('enc-password').value;
  if (!password) {
    alert('Please specify an encryption password.');
    document.getElementById('enc-password').focus();
    return;
  }

  const progressContainer = document.getElementById('enc-progress-container');
  const progressBar = document.getElementById('enc-progress-bar');
  const progressStatus = document.getElementById('enc-progress-status');
  const progressPct = document.getElementById('enc-progress-percentage');
  const outputBox = document.getElementById('enc-output-box');
  const encBtn = document.getElementById('enc-btn-execute');

  try {
    encBtn.disabled = true;
    encBtn.classList.add('opacity-50');
    progressContainer.classList.remove('hidden');
    outputBox.classList.add('hidden');
    document.getElementById('crypto-state-text').textContent = 'Status: Encrypting (AES-256-GCM)...';

    const result = await CryptoEngine.encryptFile(
      selectedEncryptFile,
      password,
      (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPct.textContent = pct + '%';
        progressStatus.textContent = status;
      }
    );

    lastEncryptedPayload = result;

    document.getElementById('telemetry-salt').textContent = result.saltHex.substring(0, 16) + '...';
    document.getElementById('telemetry-iv').textContent = result.ivHex;

    const encryptedBlob = new Blob([result.buffer], { type: 'application/octet-stream' });
    if (encryptedBlobUrl) URL.revokeObjectURL(encryptedBlobUrl);
    encryptedBlobUrl = URL.createObjectURL(encryptedBlob);

    const downloadBtn = document.getElementById('enc-download-btn');
    downloadBtn.href = encryptedBlobUrl;
    downloadBtn.download = selectedEncryptFile.name + '.enc';

    outputBox.classList.remove('hidden');
    document.getElementById('crypto-state-text').textContent = 'Status: File Sealed & Encrypted';
    document.getElementById('crypto-state-badge').className = 'flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-vault-emerald/20 text-vault-emerald font-mono text-xs border border-vault-emerald/40';

    const user = AuthModule.getCurrentUser();
    StorageManager.addAuditLog('FILE_ENCRYPTED_LOCAL', {
      user: user ? user.username : 'anonymous',
      filename: selectedEncryptFile.name,
      sizeBytes: selectedEncryptFile.size
    });

  } catch (err) {
    console.error(err);
    alert('Encryption error: ' + err.message);
    document.getElementById('crypto-state-text').textContent = 'Status: Encryption Failed';
  } finally {
    encBtn.disabled = false;
    encBtn.classList.remove('opacity-50');
  }
}

// --------------------------------------------------------------------------
// Decryption Workflow
// --------------------------------------------------------------------------
function handleDecryptFileSelected(file) {
  selectedDecryptFile = file;
  document.getElementById('dec-filename').textContent = file.name;
  document.getElementById('dec-filesize').textContent = CryptoEngine.formatBytes(file.size);
  document.getElementById('dec-drop-zone').classList.add('hidden');
  document.getElementById('dec-file-info').classList.remove('hidden');
  document.getElementById('dec-error-banner').classList.add('hidden');
  document.getElementById('dec-output-box').classList.add('hidden');
  document.getElementById('crypto-state-text').textContent = 'Status: Encrypted payload loaded';
}

function clearDecryptFile() {
  selectedDecryptFile = null;
  document.getElementById('dec-file-input').value = '';
  document.getElementById('dec-file-info').classList.add('hidden');
  document.getElementById('dec-drop-zone').classList.remove('hidden');
  document.getElementById('dec-error-banner').classList.add('hidden');
  document.getElementById('dec-output-box').classList.add('hidden');
  document.getElementById('dec-progress-container').classList.add('hidden');
  document.getElementById('dec-tele-header').textContent = 'Awaiting payload';
  document.getElementById('dec-tele-tag').textContent = 'Unverified';
  document.getElementById('dec-tele-orig-name').textContent = '--';
  if (decryptedBlobUrl) {
    URL.revokeObjectURL(decryptedBlobUrl);
    decryptedBlobUrl = null;
  }
  document.getElementById('crypto-state-text').textContent = 'Status: Ready for input';
}

async function executeDecryption() {
  if (!selectedDecryptFile) {
    alert('Please select an encrypted file to decrypt.');
    return;
  }
  const password = document.getElementById('dec-password').value;
  if (!password) {
    alert('Please enter your decryption password.');
    document.getElementById('dec-password').focus();
    return;
  }

  const progressContainer = document.getElementById('dec-progress-container');
  const progressBar = document.getElementById('dec-progress-bar');
  const progressStatus = document.getElementById('dec-progress-status');
  const progressPct = document.getElementById('dec-progress-percentage');
  const outputBox = document.getElementById('dec-output-box');
  const decBtn = document.getElementById('dec-btn-execute');
  const decError = document.getElementById('dec-error-banner');
  const decErrMsg = document.getElementById('dec-error-message');

  decError.classList.add('hidden');
  outputBox.classList.add('hidden');

  try {
    decBtn.disabled = true;
    decBtn.classList.add('opacity-50');
    progressContainer.classList.remove('hidden');
    document.getElementById('crypto-state-text').textContent = 'Status: Decrypting & Authenticating...';

    const result = await CryptoEngine.decryptFile(
      selectedDecryptFile,
      password,
      (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPct.textContent = pct + '%';
        progressStatus.textContent = status;
      }
    );

    document.getElementById('dec-tele-header').textContent = 'HIMITSU1 (Valid)';
    document.getElementById('dec-tele-tag').textContent = 'AUTHENTICATED';
    document.getElementById('dec-tele-tag').className = 'text-vault-emerald font-bold';
    document.getElementById('dec-tele-orig-name').textContent = result.originalName;

    const decryptedBlob = new Blob([result.buffer]);
    if (decryptedBlobUrl) URL.revokeObjectURL(decryptedBlobUrl);
    decryptedBlobUrl = URL.createObjectURL(decryptedBlob);

    const downloadBtn = document.getElementById('dec-download-btn');
    downloadBtn.href = decryptedBlobUrl;
    downloadBtn.download = result.originalName || 'restored_file';

    document.getElementById('dec-output-name').textContent = result.originalName;
    outputBox.classList.remove('hidden');

    document.getElementById('crypto-state-text').textContent = 'Status: Decryption Successful';
    document.getElementById('crypto-state-badge').className = 'flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-vault-emerald/20 text-vault-emerald font-mono text-xs border border-vault-emerald/40';

    const user = AuthModule.getCurrentUser();
    StorageManager.addAuditLog('FILE_DECRYPTED_LOCAL', {
      user: user ? user.username : 'anonymous',
      originalName: result.originalName,
      restoredSize: result.size
    });

  } catch (err) {
    console.error(err);
    decError.classList.remove('hidden');
    decErrMsg.textContent = err.message.includes('AUTHENTICATION_FAILED')
      ? 'Authentication Tag Mismatch: Incorrect password or tampered file.'
      : (err.message || 'Decryption failed.');

    document.getElementById('dec-tele-tag').textContent = 'REJECTED';
    document.getElementById('dec-tele-tag').className = 'text-rose-400 font-bold';
    document.getElementById('crypto-state-text').textContent = 'Status: Authentication Failed';
    document.getElementById('crypto-state-badge').className = 'flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-xs border border-rose-500/40';

    const user = AuthModule.getCurrentUser();
    StorageManager.addAuditLog('DECRYPTION_AUTH_FAILURE', {
      user: user ? user.username : 'anonymous',
      filename: selectedDecryptFile.name,
      reason: 'Tag mismatch or wrong key'
    });
  } finally {
    decBtn.disabled = false;
    decBtn.classList.remove('opacity-50');
  }
}

// --------------------------------------------------------------------------
// Link Sharing & Ephemeral 1-Hour Storage
// --------------------------------------------------------------------------
function promptShareLink() {
  if (!lastEncryptedPayload) {
    alert('Please encrypt a file first before generating a sharing link.');
    return;
  }

  if (!AuthModule.isLoggedIn()) {
    openAuthModal('Please sign in to generate a secure expiring link. Accounts are optional for local encryption, but required for link ownership & management.');
    return;
  }

  openShareModal();
}

function openShareModal() {
  const modal = document.getElementById('share-modal');
  modal.classList.remove('hidden');
}

function closeShareModal() {
  const modal = document.getElementById('share-modal');
  modal.classList.add('hidden');
  document.getElementById('share-link-result').classList.add('hidden');
}

async function confirmGenerateShareLink() {
  if (!lastEncryptedPayload) return;

  const isOneTime = document.getElementById('share-onetime-toggle').checked;
  const user = AuthModule.getCurrentUser();

  try {
    const record = await StorageManager.storeTemporaryFile({
      filename: lastEncryptedPayload.originalName,
      originalSize: lastEncryptedPayload.originalSize,
      encryptedBuffer: lastEncryptedPayload.buffer,
      owner: user ? user.username : 'anonymous',
      isOneTime: isOneTime
    });

    const shareUrl = `${window.location.origin}${window.location.pathname}?fileId=${record.id}`;
    document.getElementById('share-link-input').value = shareUrl;
    document.getElementById('share-link-type-badge').textContent = isOneTime ? 'ONE-TIME BURN LINK' : '1-HOUR EXPIRING LINK';
    document.getElementById('share-link-type-badge').className = isOneTime
      ? 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40'
      : 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-vault-cyan/20 text-vault-cyan border border-vault-cyan/40';

    document.getElementById('share-link-result').classList.remove('hidden');
    renderUserFilesDashboard();
  } catch (err) {
    alert('Failed to generate sharing link: ' + err.message);
  }
}

function copyShareLink() {
  const input = document.getElementById('share-link-input');
  input.select();
  navigator.clipboard.writeText(input.value);
  alert('Secure link copied to clipboard! (Expires in 1 hour)');
}

// --------------------------------------------------------------------------
// Recipient URL Link Resolver
// --------------------------------------------------------------------------
async function initLinkHandling() {
  const params = new URLSearchParams(window.location.search);
  const fileId = params.get('fileId');

  if (!fileId) return;

  const banner = document.getElementById('recipient-download-banner');
  if (banner) banner.classList.remove('hidden');

  try {
    const fileRecord = await StorageManager.getTemporaryFile(fileId);
    if (!fileRecord || fileRecord.expired) {
      document.getElementById('recipient-banner-title').textContent = 'Link Expired or File Deleted';
      document.getElementById('recipient-banner-desc').textContent = 'This file has reached its 1-hour expiration time or was destroyed after download.';
      document.getElementById('recipient-action-btn').classList.add('hidden');
      return;
    }

    document.getElementById('recipient-filename').textContent = fileRecord.filename;
    document.getElementById('recipient-filesize').textContent = CryptoEngine.formatBytes(fileRecord.encryptedBuffer.byteLength);

    if (fileRecord.isOneTime) {
      document.getElementById('recipient-banner-badge').textContent = 'One-Time Link (Burned immediately)';
      document.getElementById('recipient-banner-badge').className = 'px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-mono font-bold';
    }

    const downloadBtn = document.getElementById('recipient-action-btn');
    const blob = new Blob([fileRecord.encryptedBuffer], { type: 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);
    downloadBtn.href = blobUrl;
    downloadBtn.download = fileRecord.filename + '.enc';

  } catch (err) {
    console.error('Error resolving file link:', err);
  }
}

// --------------------------------------------------------------------------
// Authentication UI (User Login Structure)
// --------------------------------------------------------------------------
function initAuthUI() {
  renderAuthHeader();
}

function renderAuthHeader() {
  const user = AuthModule.getCurrentUser();
  const unauthBox = document.getElementById('nav-unauth');
  const authBox = document.getElementById('nav-auth');
  const userHandle = document.getElementById('nav-user-handle');

  if (user) {
    if (unauthBox) unauthBox.classList.add('hidden');
    if (authBox) authBox.classList.remove('hidden');
    if (userHandle) userHandle.textContent = user.username;
    renderUserFilesDashboard();
  } else {
    if (unauthBox) unauthBox.classList.remove('hidden');
    if (authBox) authBox.classList.add('hidden');
    const myFilesSec = document.getElementById('my-files-section');
    if (myFilesSec) myFilesSec.classList.add('hidden');
  }
}

function openAuthModal(customNotice = null) {
  const modal = document.getElementById('auth-modal');
  const noticeEl = document.getElementById('auth-modal-notice');
  if (customNotice && noticeEl) {
    noticeEl.textContent = customNotice;
    noticeEl.classList.remove('hidden');
  } else if (noticeEl) {
    noticeEl.classList.add('hidden');
  }
  modal.classList.remove('hidden');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  modal.classList.add('hidden');
  document.getElementById('auth-error').classList.add('hidden');
}

function switchAuthMode(mode) {
  const isLogin = mode === 'login';
  document.getElementById('auth-mode-login').classList.toggle('hidden', !isLogin);
  document.getElementById('auth-mode-register').classList.toggle('hidden', isLogin);
  document.getElementById('auth-error').classList.add('hidden');
}

async function handleUserLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorBox = document.getElementById('auth-error');

  errorBox.classList.add('hidden');

  try {
    await AuthModule.login(email, password);
    closeAuthModal();
    renderAuthHeader();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
  }
}

async function handleUserRegisterSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const errorBox = document.getElementById('auth-error');

  errorBox.classList.add('hidden');

  try {
    await AuthModule.register(email, password);
    closeAuthModal();
    renderAuthHeader();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
  }
}

async function handleGoogleLogin() {
  try {
    await AuthModule.signInWithGoogle();
    closeAuthModal();
    renderAuthHeader();
  } catch (err) {
    alert('Google authentication error: ' + err.message);
  }
}

function handleLogout() {
  AuthModule.logoutUser();
  renderAuthHeader();
}

// --------------------------------------------------------------------------
// User's Shared Files Dashboard
// --------------------------------------------------------------------------
async function renderUserFilesDashboard() {
  const user = AuthModule.getCurrentUser();
  const section = document.getElementById('my-files-section');
  if (!user || !section) return;

  section.classList.remove('hidden');
  const listEl = document.getElementById('my-files-list');
  const files = await StorageManager.listUserFiles(user.username);

  if (files.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-6 text-slate-500 text-xs font-mono">
        No active sharing links. Files shared via temporary link will appear here.
      </div>
    `;
    return;
  }

  const now = Date.now();
  listEl.innerHTML = files.map(file => {
    const timeLeftMin = Math.max(0, Math.round((file.expiresAt - now) / (60 * 1000)));
    const shareUrl = `${window.location.origin}${window.location.pathname}?fileId=${file.id}`;

    return `
      <div class="bg-vault-950/80 border border-vault-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="overflow-hidden">
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold text-white text-sm truncate">${file.filename}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono ${file.isOneTime ? 'bg-rose-500/20 text-rose-300' : 'bg-vault-cyan/20 text-vault-cyan'}">
              ${file.isOneTime ? 'One-Time' : '1-Hour'}
            </span>
          </div>
          <div class="text-xs font-mono text-slate-400 mt-1 flex items-center gap-3">
            <span>Expires in: <strong class="text-vault-warning">${timeLeftMin} mins</strong></span>
            <span>Downloads: ${file.downloadCount}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="navigator.clipboard.writeText('${shareUrl}'); alert('Link copied!');" class="px-3 py-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-xs font-mono text-vault-cyan border border-vault-700">
            <i class="fa-solid fa-copy"></i> Copy Link
          </button>
          <button onclick="deleteMyFile('${file.id}')" class="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-xs font-mono text-rose-400 border border-rose-500/30">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function deleteMyFile(id) {
  if (confirm('Permanently remove this temporary file and invalidate the link immediately?')) {
    await StorageManager.deleteFile(id);
    renderUserFilesDashboard();
  }
}

function toggleFaq(id) {
  const answer = document.getElementById(`faq-answer-${id}`);
  const icon = document.getElementById(`faq-icon-${id}`);
  if (answer.classList.contains('hidden')) {
    answer.classList.remove('hidden');
    icon.classList.add('rotate-180');
  } else {
    answer.classList.add('hidden');
    icon.classList.remove('rotate-180');
  }
}
