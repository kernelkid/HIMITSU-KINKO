/**
 * HIMITSU KINKO - Admin Portal Controller
 * Secure. Encrypt. Protect.
 * 
 * Manages admin authentication, metadata telemetry, storage metrics,
 * and security event stream. Strictly adheres to zero-knowledge privacy:
 * NEVER requests, handles, or exposes plaintext user files or keys.
 */

let activeAdminTab = 'activity';

document.addEventListener('DOMContentLoaded', () => {
  checkAdminSession();
});

function checkAdminSession() {
  const isAuth = AuthModule.isAdminLoggedIn();
  const authContainer = document.getElementById('admin-auth-container');
  const dashboardView = document.getElementById('admin-dashboard-view');
  const sessionBadge = document.getElementById('admin-session-badge');

  if (isAuth) {
    if (authContainer) authContainer.classList.add('hidden');
    if (dashboardView) dashboardView.classList.remove('hidden');
    if (sessionBadge) sessionBadge.classList.remove('hidden');
    refreshAdminDashboardData();
  } else {
    if (authContainer) authContainer.classList.remove('hidden');
    if (dashboardView) dashboardView.classList.add('hidden');
    if (sessionBadge) sessionBadge.classList.add('hidden');
  }
}

async function handleAdminLoginSubmit(e) {
  e.preventDefault();
  const emailInput = document.getElementById('admin-email');
  const pwdInput = document.getElementById('admin-password');
  const errorBox = document.getElementById('admin-error-box');

  errorBox.classList.add('hidden');

  try {
    await AuthModule.loginAdmin(emailInput.value, pwdInput.value);
    checkAdminSession();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
  }
}

function handleAdminLogout() {
  AuthModule.logoutAdmin();
  checkAdminSession();
}

function switchAdminPortalTab(tab) {
  activeAdminTab = tab;
  const tabs = ['activity', 'users', 'storage', 'security'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t.substring(0, 3)}`);
    const view = document.getElementById(`admin-view-${t}`);
    if (btn && view) {
      if (t === tab) {
        btn.className = 'px-4 py-2 rounded-lg font-heading font-bold text-xs uppercase tracking-wider transition-all admin-tab-active border';
        view.classList.remove('hidden');
      } else {
        btn.className = 'px-4 py-2 rounded-lg font-heading font-bold text-xs uppercase tracking-wider transition-all text-slate-400 hover:text-white border border-transparent';
        view.classList.add('hidden');
      }
    }
  });

  refreshAdminDashboardData();
}

async function refreshAdminDashboardData() {
  if (!AuthModule.isAdminLoggedIn()) return;

  const users = AuthModule.listRegisteredUsers();
  const storageMetrics = await StorageManager.getAdminStorageMetrics();
  const auditLogs = StorageManager.getAuditLogs();

  // 1. Metric Cards
  document.getElementById('adm-metric-users').textContent = users.length;
  document.getElementById('adm-metric-files').textContent = storageMetrics.activeCount;
  document.getElementById('adm-metric-storage').textContent = `${CryptoEngine.formatBytes(storageMetrics.totalBytes)} in temporary buffer`;
  document.getElementById('adm-metric-events').textContent = auditLogs.length;

  // 2. Activity Feed
  const feedEl = document.getElementById('adm-activity-feed');
  if (feedEl) {
    if (auditLogs.length === 0) {
      feedEl.innerHTML = `<div class="text-center py-6 text-slate-500 text-xs font-mono">No recent activity logged yet.</div>`;
    } else {
      feedEl.innerHTML = auditLogs.slice(0, 15).map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        return `
          <div class="flex items-center justify-between py-2.5 border-b border-vault-850 text-xs font-mono">
            <div class="flex items-center gap-2 overflow-hidden">
              <span class="w-2 h-2 rounded-full bg-vault-cyan"></span>
              <span class="text-white font-bold">${log.action}</span>
              <span class="text-slate-400 truncate max-w-[240px]">${log.filename || log.user || log.fileId || ''}</span>
            </div>
            <span class="text-slate-500 shrink-0">${time}</span>
          </div>
        `;
      }).join('');
    }
  }

  // 3. Users Table (Metadata only)
  const usersTable = document.getElementById('adm-users-table');
  if (usersTable) {
    if (users.length === 0) {
      usersTable.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-slate-500 text-xs font-mono">No accounts registered yet. Normal users can encrypt without accounts.</td></tr>`;
    } else {
      usersTable.innerHTML = users.map(u => `
        <tr class="border-b border-vault-850 hover:bg-vault-850/40">
          <td class="py-2.5 px-3 font-mono text-xs text-white font-bold">${u.username}</td>
          <td class="py-2.5 px-3 font-mono text-xs">
            <span class="px-2 py-0.5 rounded text-[10px] ${u.authProvider === 'google' ? 'bg-amber-500/20 text-amber-300' : 'bg-vault-cyan/20 text-vault-cyan'}">
              ${u.authProvider === 'google' ? 'Google OAuth' : 'Email/Password'}
            </span>
          </td>
          <td class="py-2.5 px-3 font-mono text-xs text-slate-400">${new Date(u.createdAt).toLocaleDateString()}</td>
          <td class="py-2.5 px-3 font-mono text-xs text-emerald-400">Active</td>
        </tr>
      `).join('');
    }
  }

  // 4. Storage Table (Metadata only)
  const storageTable = document.getElementById('adm-storage-table');
  if (storageTable) {
    if (storageMetrics.files.length === 0) {
      storageTable.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-slate-500 text-xs font-mono">Zero active temporary files in ephemeral buffer.</td></tr>`;
    } else {
      const now = Date.now();
      storageTable.innerHTML = storageMetrics.files.map(f => {
        const minLeft = Math.max(0, Math.round((f.expiresAt - now) / 60000));
        return `
          <tr class="border-b border-vault-850 hover:bg-vault-850/40">
            <td class="py-2.5 px-3 text-white font-mono text-xs font-bold truncate max-w-[160px]">${f.filename}</td>
            <td class="py-2.5 px-3 text-slate-300 font-mono text-xs">${f.owner}</td>
            <td class="py-2.5 px-3 font-mono text-xs text-slate-400">${CryptoEngine.formatBytes(f.sizeBytes)}</td>
            <td class="py-2.5 px-3 font-mono text-xs text-vault-warning font-bold">${minLeft}m TTL</td>
            <td class="py-2.5 px-3 font-mono text-xs">
              <span class="px-2 py-0.5 rounded text-[10px] ${f.isOneTime ? 'bg-rose-500/20 text-rose-300' : 'bg-vault-cyan/20 text-vault-cyan'}">
                ${f.isOneTime ? 'One-Time' : '1-Hour TTL'}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 5. Security Feed
  const secFeed = document.getElementById('adm-security-feed');
  if (secFeed) {
    const secEvents = auditLogs.filter(l => l.action.includes('AUTH') || l.action.includes('CLEANUP') || l.action.includes('BURNED'));
    if (secEvents.length === 0) {
      secFeed.innerHTML = `<div class="text-center py-6 text-slate-500 text-xs font-mono">No security violations or auto-purge triggers recorded.</div>`;
    } else {
      secFeed.innerHTML = secEvents.slice(0, 15).map(e => `
        <div class="flex items-center justify-between py-2.5 border-b border-vault-850 text-xs font-mono">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${e.action.includes('FAILURE') ? 'bg-rose-500' : 'bg-vault-emerald'}"></span>
            <span class="${e.action.includes('FAILURE') ? 'text-rose-400' : 'text-vault-emerald'} font-bold">${e.action}</span>
            <span class="text-slate-400">${e.reason || e.filename || e.attemptedEmail || ''}</span>
          </div>
          <span class="text-slate-500 text-[11px]">${new Date(e.timestamp).toLocaleTimeString()}</span>
        </div>
      `).join('');
    }
  }
}
