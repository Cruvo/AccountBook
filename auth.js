'use strict';

// ============================================================
// Auth – client-side password lock using SHA-256 (Web Crypto)
// ============================================================

const Auth = {
  HASH_KEY:    'ab_auth_hash',
  SESSION_KEY: 'ab_authed',

  // Return stored hash or null
  storedHash() { return localStorage.getItem(this.HASH_KEY); },

  // SHA-256 a string → hex
  async sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // True if already authenticated this session
  isAuthed() { return sessionStorage.getItem(this.SESSION_KEY) === '1'; },

  markAuthed() { sessionStorage.setItem(this.SESSION_KEY, '1'); },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    location.reload();
  },

  // Change / remove password (called from Settings)
  async changePassword(current, newPw) {
    const hash = this.storedHash();
    if (hash) {
      const currentHash = await this.sha256(current);
      if (currentHash !== hash) throw new Error('Current password is incorrect.');
    }
    if (!newPw) {
      localStorage.removeItem(this.HASH_KEY);
    } else {
      localStorage.setItem(this.HASH_KEY, await this.sha256(newPw));
    }
  },

  // ── UI ────────────────────────────────────────────────────
  showLock() {
    const hasPassword = !!this.storedHash();
    const overlay = document.getElementById('auth-overlay');
    overlay.classList.remove('hidden');

    this._render(hasPassword ? 'login' : 'setup');
  },

  _render(mode) {
    const overlay = document.getElementById('auth-overlay');
    overlay.innerHTML = `
      <div class="auth-card">
        <div class="auth-logo">📒</div>
        <h1 class="auth-title">Account Book</h1>
        <p class="auth-sub">${mode === 'setup' ? 'Create a password to protect your account book.' : 'Enter your password to continue.'}</p>

        ${mode === 'setup' ? `
          <div class="auth-form">
            <div class="form-group">
              <label class="form-label">New Password</label>
              <input class="form-control" type="password" id="auth-pw" placeholder="Choose a strong password" autocomplete="new-password">
            </div>
            <div class="form-group">
              <label class="form-label">Confirm Password</label>
              <input class="form-control" type="password" id="auth-pw2" placeholder="Repeat password" autocomplete="new-password">
            </div>
            <p id="auth-err" class="auth-err"></p>
            <button class="btn btn-primary" style="width:100%" onclick="Auth._handleSetup()">🔐 Set Password & Enter</button>
          </div>` : `
          <div class="auth-form">
            <div class="form-group">
              <label class="form-label">Password</label>
              <input class="form-control" type="password" id="auth-pw" placeholder="Enter your password" autocomplete="current-password">
            </div>
            <p id="auth-err" class="auth-err"></p>
            <button class="btn btn-primary" style="width:100%" onclick="Auth._handleLogin()">🔓 Unlock</button>
          </div>`}

        <p style="font-size:11px;color:var(--text-dim);margin-top:18px;text-align:center">
          Your data stays in this browser only.
        </p>
      </div>`;

    // Allow Enter key submission
    setTimeout(() => {
      const pw = document.getElementById('auth-pw');
      if (pw) pw.addEventListener('keydown', e => {
        if (e.key === 'Enter') mode === 'setup' ? Auth._handleSetup() : Auth._handleLogin();
      });
      const pw2 = document.getElementById('auth-pw2');
      if (pw2) pw2.addEventListener('keydown', e => { if (e.key === 'Enter') Auth._handleSetup(); });
      if (pw) pw.focus();
    }, 50);
  },

  async _handleLogin() {
    const pw  = document.getElementById('auth-pw').value;
    const err = document.getElementById('auth-err');
    if (!pw) { err.textContent = 'Please enter your password.'; return; }
    const hash = await this.sha256(pw);
    if (hash !== this.storedHash()) {
      err.textContent = 'Incorrect password. Please try again.';
      document.getElementById('auth-pw').value = '';
      document.getElementById('auth-pw').focus();
      return;
    }
    this.markAuthed();
    this._unlock();
  },

  async _handleSetup() {
    const pw  = document.getElementById('auth-pw').value;
    const pw2 = document.getElementById('auth-pw2').value;
    const err = document.getElementById('auth-err');
    if (!pw)        { err.textContent = 'Password cannot be empty.'; return; }
    if (pw.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
    if (pw !== pw2) { err.textContent = 'Passwords do not match.'; return; }
    localStorage.setItem(this.HASH_KEY, await this.sha256(pw));
    this.markAuthed();
    this._unlock();
  },

  _unlock() {
    const overlay = document.getElementById('auth-overlay');
    overlay.classList.add('hidden');
    // Initialise main app
    App.init();
  },

  // Called on page load
  async boot() {
    if (this.isAuthed()) {
      document.getElementById('auth-overlay').classList.add('hidden');
      App.init();
    } else {
      this.showLock();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => Auth.boot());
