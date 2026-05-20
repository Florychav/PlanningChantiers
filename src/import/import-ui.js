// @ts-check
/**
 * Cablage DOM de la page d'import.
 *
 * Isole toute la manipulation du DOM ; la logique pure vit dans `import-core`,
 * l'I/O Supabase dans `import-runner`. Aucun handler inline dans le HTML :
 * tout est branche ici via `addEventListener` (contrainte du scope module ESM).
 */
import { extractCollections } from './import-core.js';
import { runImport } from './import-runner.js';

/** Roles autorises a importer. */
const ALLOWED_ROLES = ['editor', 'admin'];

/** @param {string} id @returns {any} */
const byId = (id) => document.getElementById(id);

// ── Helpers UI ───────────────────────────────────────────────────────

/** @param {string} id */
function setStepDone(id) {
  const s = byId(id);
  if (!s) return;
  s.classList.remove('active');
  s.classList.add('done');
}

/** @param {string} id */
function setStepActive(id) {
  const s = byId(id);
  if (s) s.classList.add('active');
}

/** @param {number} pct */
function setProgress(pct) {
  const bar = byId('progress-bar');
  if (bar) bar.style.width = Math.min(100, Math.max(0, Math.round(pct))) + '%';
}

/**
 * Ajoute une ligne horodatee au journal.
 * @param {string} msg
 * @param {string} [type] - 'ok' | 'new' | 'skip' | 'error' | 'success'
 */
function log(msg, type = '') {
  const logEl = byId('log');
  if (!logEl) return;
  const div = document.createElement('div');
  div.className = 'log-line' + (type ? ' ' + type : '');
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

/**
 * Remplace l'etape de connexion par la barre utilisateur connecte.
 * Construit en API DOM (pas d'innerHTML) — l'email n'est jamais interprete.
 *
 * @param {string} email
 * @param {string} role
 * @param {() => void} onLogout
 */
function showUserBar(email, role, onLogout) {
  const stepEl = byId('step-login');
  if (!stepEl) return;
  stepEl.textContent = '';

  const bar = document.createElement('div');
  bar.className = 'user-bar';

  const who = document.createElement('strong');
  who.textContent = email;

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = role;

  const spacer = document.createElement('span');
  spacer.style.flex = '1';

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn-ghost';
  logoutBtn.type = 'button';
  logoutBtn.textContent = 'Déconnexion';
  logoutBtn.addEventListener('click', onLogout);

  bar.append('👤 ', who, ' ', badge, spacer, logoutBtn);
  stepEl.appendChild(bar);

  setStepDone('step-login');
  setStepActive('step-file');
}

// ── Setup principal ──────────────────────────────────────────────────

/**
 * Branche toute la page d'import sur un client Supabase donne.
 *
 * @param {any} client - client supabase-js
 */
export function setupImportUI(client) {
  /** @type {any} contenu JSON parse, ou null tant qu'aucun fichier valide. */
  let parsedData = null;

  /**
   * Resout le role applicatif d'un utilisateur.
   * @param {string} userId
   * @returns {Promise<string>}
   */
  async function fetchRole(userId) {
    const { data, error } = await client
      .from('app_users')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) console.warn('Rôle :', error);
    return (data && data.role) || 'viewer';
  }

  async function doLogout() {
    await client.auth.signOut();
    location.reload();
  }

  // ── Etape 1 : connexion ────────────────────────────────────────────
  async function doLogin() {
    const email = String(byId('email').value || '').trim();
    const password = String(byId('password').value || '');
    const errEl = byId('login-error');
    const btn = byId('login-btn');
    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Connexion…';
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      const role = await fetchRole(data.session.user.id);
      if (!ALLOWED_ROLES.includes(role)) {
        throw new Error(
          `Rôle "${role}" insuffisant — il faut editor ou admin pour importer.`,
        );
      }
      showUserBar(email, role, doLogout);
    } catch (e) {
      errEl.textContent = (e && e.message) || 'Erreur de connexion';
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  }

  const loginForm = byId('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (/** @type {Event} */ ev) => {
      ev.preventDefault();
      doLogin();
    });
  }

  // ── Etape 2 : choix du fichier ─────────────────────────────────────
  const fileInput = byId('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', async (/** @type {any} */ ev) => {
      const file = ev.target.files && ev.target.files[0];
      const summaryEl = byId('file-summary');
      const importBtn = byId('import-btn');
      if (!file) return;
      try {
        parsedData = JSON.parse(await file.text());
        const c = extractCollections(parsedData);

        summaryEl.textContent = '';
        const box = document.createElement('div');
        box.className = 'summary';
        /** @type {[string,string][]} */
        const rows = [
          ['Fichier', `${file.name} (${(file.size / 1024).toFixed(1)} ko)`],
          ['Personnes', String(c.personnes.length)],
          ['Étiquettes', String(c.etiquettes.length)],
          ['Ponts offerts', String(c.ponts.length)],
          ['Réunions', String(c.reunions.length)],
        ];
        for (const [k, v] of rows) {
          const row = document.createElement('div');
          row.className = 'row';
          const key = document.createElement('span');
          key.className = 'key';
          key.textContent = k;
          const val = document.createElement('span');
          val.className = 'val';
          val.textContent = v;
          row.append(key, val);
          box.appendChild(row);
        }
        summaryEl.appendChild(box);

        if (c.personnes.length === 0) {
          const warn = document.createElement('div');
          warn.className = 'warn';
          warn.textContent = "⚠️ Aucune personne trouvée — l'import est inutile.";
          summaryEl.appendChild(warn);
          importBtn.disabled = true;
        } else {
          importBtn.disabled = false;
          setStepDone('step-file');
          setStepActive('step-import');
        }
      } catch (err) {
        summaryEl.textContent = '';
        const warn = document.createElement('div');
        warn.className = 'warn';
        warn.textContent = `❌ Fichier invalide : ${(err && err.message) || err}`;
        summaryEl.appendChild(warn);
        importBtn.disabled = true;
        parsedData = null;
      }
    });
  }

  // ── Etape 3 : import ───────────────────────────────────────────────
  async function doImport() {
    if (!parsedData) return;
    const btn = byId('import-btn');
    btn.disabled = true;
    btn.textContent = 'Import en cours…';
    byId('log').textContent = '';
    setProgress(0);
    try {
      await runImport(client, parsedData, { onLog: log, onProgress: setProgress });
      setStepDone('step-import');
      btn.textContent = '✓ Import terminé';
    } catch (e) {
      log('❌ ERREUR : ' + ((e && e.message) || e), 'error');
      btn.disabled = false;
      btn.textContent = 'Réessayer';
      setProgress(0);
    }
  }

  const importBtn = byId('import-btn');
  if (importBtn) importBtn.addEventListener('click', doImport);

  // ── Auto-login si une session est deja en cache ────────────────────
  (async () => {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session) return;
    byId('email').value = session.user.email;
    const role = await fetchRole(session.user.id);
    if (ALLOWED_ROLES.includes(role)) {
      showUserBar(session.user.email, role, doLogout);
    } else {
      byId('login-error').textContent =
        `Rôle "${role}" insuffisant — déconnectez-vous et utilisez un compte editor/admin.`;
    }
  })();
}
