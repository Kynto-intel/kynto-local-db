/**
 * RLS Policies Tab - Pro Tabelle
 * Zeigt RLS-Richtlinien und erlaubt neue zu erstellen
 */

import { state } from '../../state.js';

let rlsPoliciesPanel = null;

// Language change listener - re-render wenn Sprache sich ändert
window.addEventListener('i18n:loaded', () => {
  console.log('[RLS-Policies] i18n:loaded event gefeuert, re-render...');
  if (rlsPoliciesPanel && rlsPoliciesPanel.parentElement) {
    loadTablePolicies();  // Re-render mit neuer Sprache
  }
});

// i18n Support - verwende direktly window.i18n wenn verfügbar
const t = (key, defaults = key, replacements = {}) => {
  try {
    if (!window.i18n?.t) {
      console.warn('[RLS i18n] window.i18n.t nicht verfügbar, verwende default');
      let text = defaults;
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(`{{${k}}}`, v);
      });
      return text;
    }
    
    const fullKey = `policies.${key}`;
    let text = window.i18n.t(fullKey);
    
    // Wenn i18n den Key selbst zurückgibt (nicht gefunden), verwende default
    if (text === fullKey) {
      console.debug(`[RLS i18n] Translation not found for ${fullKey}, using default: "${defaults}"`);
      text = defaults;
    }
    
    if (!text || typeof text !== 'string') {
      console.debug(`[RLS i18n] Invalid translation for ${fullKey}, using default: "${defaults}"`);
      text = defaults;
    }
    
    // Replace placeholders
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(new RegExp(`{{${k}}}`, 'g'), v);
    });
    
    console.debug(`[RLS i18n] ${key} → "${text}"`);
    return text;
  } catch (e) {
    console.error('[RLS i18n] Translation error:', e);
    let text = defaults;
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(`{{${k}}}`, v);
    });
    return text;
  }
};

/**
 * Wartet darauf, dass i18n bereit ist (mit Timeout)
 */
async function waitForI18n(maxWait = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (window.i18n?.t && typeof window.i18n.t === 'function') {
      console.log('[RLS-Policies] ✅ i18n bereit');
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.warn('[RLS-Policies] ⚠️ i18n nicht bereit nach', maxWait, 'ms - verwende defaults');
  return false;
}

/**
 * Initialisiert RLS-Policies Panel (wird als Tab angezeigt)
 */
export async function initRLSPoliciesPanel() {
  // Warte bis i18n bereit ist
  await waitForI18n();
  if (!rlsPoliciesPanel) {
    rlsPoliciesPanel = document.createElement('div');
    rlsPoliciesPanel.id = 'rls-policies-panel';
    rlsPoliciesPanel.className = 'rls-policies-panel';
  }
  
  // Aktuelle Tabelle prüfen
  if (!state.currentTable) {
    rlsPoliciesPanel.innerHTML = `
      <div class="rls-empty-state">
        <div class="rls-empty-icon">🔒</div>
        <div class="rls-empty-title">${t('empty_state', 'Keine Tabelle ausgewählt')}</div>
        <div class="rls-empty-text">${t('select_table', 'Wähle eine Tabelle aus, um RLS-Richtlinien zu verwalten')}</div>
      </div>
    `;
    return rlsPoliciesPanel;
  }
  
  // Lade Policies für aktuelle Tabelle
  await loadTablePolicies();
  return rlsPoliciesPanel;
}

/**
 * Lädt Policies für aktuelle Tabelle
 */
async function loadTablePolicies() {
  const schema = state.currentSchema || 'public';
  const table = state.currentTable;
  
  rlsPoliciesPanel.innerHTML = `
    <div class="rls-loading-container">
      <div class="rls-spinner"></div>
      <div class="rls-loading-text">${t('loading', 'Richtlinien werden geladen…')}</div>
    </div>
  `;
  
  try {
    // RLS Status prüfen
    const tables = await window.api.policyGetTablesWithRLSStatus();
    const tableInfo = tables?.find(t => t.name === table && t.schema === schema);
    const rlsEnabled = tableInfo?.rls_enabled || false;
    
    // Policies laden
    let policies = [];
    try {
      policies = await window.api.policyLoad(schema, table);
    } catch (e) {
      console.log('Keine Policies gefunden');
    }
    
    // HTML generieren mit i18n
    let html = `
      <div class="rls-policies-container">
        <!-- Header -->
        <div class="rls-policies-header">
          <div class="rls-header-content">
            <h2 class="rls-title">🔒 Row Level Security</h2>
            <div class="rls-subtitle">${t('col_name', 'Tabelle')}: <span class="rls-table-name">${table}</span></div>
          </div>
          <button class="rls-header-btn rls-refresh-btn" title="${t('btn_edit', 'Aktualisieren')}" aria-label="${t('btn_edit', 'Richtlinien aktualisieren')}">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 8a6 6 0 1 0 6-6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 2v3h3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        
        <!-- Status Card -->
        <div class="rls-status-card ${rlsEnabled ? 'rls-status-active' : 'rls-status-inactive'}">
          <div class="rls-status-left">
            <div class="rls-status-icon">${rlsEnabled ? '🔒' : '🔓'}</div>
            <div class="rls-status-info">
              <div class="rls-status-label">${t('status_label', 'RLS Status')}</div>
              <div class="rls-status-value">${rlsEnabled ? t('status_active', 'Aktiviert') : t('status_inactive', 'Deaktiviert')}</div>
            </div>
          </div>
          <button class="rls-btn rls-btn-toggle" data-action="toggle">
            ${rlsEnabled ? t('btn_deactivate', 'Deaktivieren') : t('btn_activate', 'Aktivieren')}
          </button>
        </div>
        
        <!-- Policies Section -->
        <div class="rls-section">
          <div class="rls-section-header">
            <h3 class="rls-section-title">
              <span class="rls-section-icon">📋</span>
              ${t('section_policies', 'Bestehende Richtlinien')}
            </h3>
            <span class="rls-count-badge">${policies?.length || 0}</span>
          </div>
          
          ${policies && policies.length > 0 ? 
            `<div class="rls-table-wrapper">
              <table class="rls-policies-table">
                <thead>
                  <tr>
                    <th class="rls-col-name">${t('col_name', 'Name')}</th>
                    <th class="rls-col-operation">${t('col_operation', 'Operation')}</th>
                    <th class="rls-col-roles">${t('col_roles', 'Rollen')}</th>
                    <th class="rls-col-actions">${t('col_actions', 'Aktionen')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${policies.map((p, idx) => `
                    <tr class="rls-policy-row" data-policy="${p.name || p.policyname}">
                      <td class="rls-col-name">
                        <span class="rls-policy-name">${p.name || p.policyname}</span>
                      </td>
                      <td class="rls-col-operation">
                        <span class="rls-operation-badge rls-op-${(p.command || p.polcmd || 'ALL').toLowerCase()}">
                          ${p.command || p.polcmd || 'ALL'}
                        </span>
                      </td>
                      <td class="rls-col-roles">
                        <span class="rls-roles-text">${p.roles?.join(', ') || 'public'}</span>
                      </td>
                      <td class="rls-col-actions">
                        <button class="rls-btn-icon rls-policy-edit" data-policy="${p.name || p.policyname}" title="${t('btn_edit', 'Bearbeiten')}">
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1a1.5 1.5 0 0 1 2.12 2.12l-9.94 9.94a1 1 0 0 1-.4.25L1.5 14.5a1 1 0 0 1-1.21-1.21l1.25-3.76a1 1 0 0 1 .25-.4l9.94-9.94z"/></svg>
                        </button>
                        <button class="rls-btn-icon rls-btn-danger rls-policy-delete" data-policy="${p.name || p.policyname}" title="${t('btn_delete', 'Löschen')}">
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3h2v11a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3h2V2H2v1zm3 2v9H5V5h2zm3 0v9H8V5h2zm3 0v9h-2V5h2z"/></svg>
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
            : `<div class="rls-empty-box">
              <div class="rls-empty-icon-sm">📋</div>
              <div class="rls-empty-text">${t('no_policies', 'Keine Richtlinien erstellt')}</div>
              <div class="rls-empty-hint">${t('no_policies_hint', 'Klicke auf "Neue Richtlinie", um die erste zu erstellen')}</div>
            </div>`
          }
        </div>
        
        <!-- Add Button -->
        <div class="rls-action-footer">
          <button class="rls-btn rls-btn-primary rls-add-policy-btn">
            <span>➕</span> ${t('btn_add_policy', 'Neue Richtlinie hinzufügen')}
          </button>
        </div>
      </div>
    `;
    
    rlsPoliciesPanel.innerHTML = html;
    attachPoliciesEventListeners(schema, table, rlsEnabled);
    
  } catch (error) {
    console.error('Fehler beim Laden von Policies:', error);
    rlsPoliciesPanel.innerHTML = `
      <div class="rls-error-box">
        <div class="rls-error-icon">⚠️</div>
        <div class="rls-error-title">${t('error_loading', 'Fehler beim Laden')}</div>
        <div class="rls-error-message">${error.message}</div>
      </div>
    `;
  }
}

/**
 * Attacht Event Listener
 */
function attachPoliciesEventListeners(schema, table, rlsEnabled) {
  const schema_arg = schema;
  const table_arg = table;
  
  // Refresh Button
  rlsPoliciesPanel.querySelector('.rls-refresh-btn')?.addEventListener('click', () => {
    const btn = rlsPoliciesPanel.querySelector('.rls-refresh-btn');
    btn.classList.add('rls-spinning');
    loadTablePolicies().then(() => {
      btn.classList.remove('rls-spinning');
    });
  });
  
  // RLS Status Toggle
  rlsPoliciesPanel.querySelector('.rls-btn-toggle')?.addEventListener('click', async (e) => {
    try {
      e.target.disabled = true;
      if (rlsEnabled) {
        await window.api.policyDisableRLS(schema_arg, table_arg);
        console.log(`✅ ${t('success_toggled', 'RLS deaktiviert für {{table}}', { action: t('btn_deactivate', 'Deaktiviert'), table: table_arg })}`);
      } else {
        await window.api.policyEnableRLS(schema_arg, table_arg);
        console.log(`✅ ${t('success_toggled', 'RLS aktiviert für {{table}}', { action: t('btn_activate', 'Aktiviert'), table: table_arg })}`);
      }
      await loadTablePolicies();
    } catch (error) {
      console.error('Fehler:', error);
      alert(`Fehler: ${error.message}`);
    }
  });
  
  // Add Policy Button
  rlsPoliciesPanel.querySelector('.rls-add-policy-btn')?.addEventListener('click', () => {
    showPolicyEditor(schema_arg, table_arg);
  });
  
  // Delete Policy
  rlsPoliciesPanel.querySelectorAll('.rls-policy-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const policyName = e.currentTarget.dataset.policy;
      const confirmMsg = t('confirm_delete', `Richtlinie "${policyName}" wirklich löschen?`, { name: policyName });
      if (confirm(confirmMsg)) {
        try {
          await window.api.policyDelete(policyName, schema_arg, table_arg);
          console.log(`✅ ${t('success_deleted', `Gelöscht: ${policyName}`, { name: policyName })}`);
          await loadTablePolicies();
        } catch (error) {
          console.error('Fehler:', error);
          alert(`Fehler: ${error.message}`);
        }
      }
    });
  });
  
  // Edit Policy (if needed)
  rlsPoliciesPanel.querySelectorAll('.rls-policy-edit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const policyName = e.currentTarget.dataset.policy;
      // Optional: Implement edit functionality
      console.log('Edit policy:', policyName);
    });
  });
}

/**
 * Zeigt Policy Editor Modal
 */
async function showPolicyEditor(schema, table, existingPolicy = null) {
  try {
    const templates = await window.api.policyGetTemplates() || [];
    
    const modal = document.createElement('div');
    modal.className = 'rls-policy-modal';
    modal.innerHTML = `
      <div class="rls-modal-overlay"></div>
      <div class="rls-modal-container">
        <div class="rls-modal-header">
          <div class="rls-modal-title">
            <span class="rls-modal-icon">${existingPolicy ? '✏️' : '➕'}</span>
            <div>
              <h2>${existingPolicy ? t('modal_edit_title', 'Richtlinie bearbeiten') : t('modal_new_title', 'Neue Richtlinie')}</h2>
              <div class="rls-modal-subtitle">${table}</div>
            </div>
          </div>
          <button class="rls-modal-close" aria-label="${t('modals.close', 'Schließen')}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="rls-modal-body">
          <!-- Template Selection -->
          ${templates.length > 0 ? `
            <div class="rls-form-group">
              <label class="rls-form-label">
                <span class="rls-label-text">${t('modal_template_label', 'Template')}</span>
                <div class="rls-label-hint">${t('modal_template_hint', 'Vordefinierte Struktur wählen')}</div>
              </label>
              <select class="rls-form-input rls-template-select">
                <option value="">${t('modal_template_custom', '-- Eigenes SQL schreiben --')}</option>
                ${templates.map(tpl => `<option value="${tpl.id}">${tpl.templateName}</option>`).join('')}
              </select>
            </div>
          ` : ''}
          
          <!-- Policy Name -->
          <div class="rls-form-group">
            <label class="rls-form-label">
              <span class="rls-label-text">${t('modal_name_label', 'Richtlinienahme')}</span>
              <div class="rls-label-hint">${t('modal_name_hint', 'z.B. user_isolation, team_access')}</div>
            </label>
            <input type="text" class="rls-form-input rls-policy-name" placeholder="${t('modal_name_placeholder', 'user_isolation_select')}">
          </div>
          
          <!-- Operation -->
          <div class="rls-form-group">
            <label class="rls-form-label">
              <span class="rls-label-text">${t('modal_operation_label', 'Operation')}</span>
              <div class="rls-label-hint">${t('modal_operation_hint', 'Welche Operationen schützen?')}</div>
            </label>
            <div class="rls-operation-grid">
              <select class="rls-form-input rls-operation-select">
                <option value="SELECT">SELECT</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="ALL">ALL</option>
              </select>
            </div>
          </div>
          
          <!-- Divider -->
          <div class="rls-divider"></div>
          
          <!-- USING Expression -->
          <div class="rls-form-group">
            <label class="rls-form-label">
              <span class="rls-label-text">${t('modal_using_label', 'USING-Ausdruck')}</span>
              <div class="rls-label-hint">${t('modal_using_hint', 'Für SELECT, UPDATE, DELETE')}</div>
            </label>
            <textarea class="rls-form-input rls-form-textarea rls-using-expr" placeholder="${t('modal_using_placeholder', '(select auth.uid()) = user_id')}" rows="3"></textarea>
          </div>
          
          <!-- WITH CHECK Expression -->
          <div class="rls-form-group">
            <label class="rls-form-label">
              <span class="rls-label-text">${t('modal_check_label', 'WITH CHECK (Optional)')}</span>
              <div class="rls-label-hint">${t('modal_check_hint', 'Für INSERT und UPDATE')}</div>
            </label>
            <textarea class="rls-form-input rls-form-textarea rls-check-expr" placeholder="${t('modal_check_placeholder', 'Leer lassen, um kein WITH CHECK zu verwenden')}" rows="3"></textarea>
          </div>
          
          <!-- SQL Preview -->
          <div class="rls-form-group">
            <label class="rls-form-label">
              <span class="rls-label-text">${t('modal_preview_label', 'SQL-Vorschau')}</span>
            </label>
            <pre class="rls-sql-preview"><code class="rls-sql-code">CREATE POLICY ... (wird aktualisiert)</code></pre>
          </div>
        </div>
        
        <div class="rls-modal-footer">
          <button class="rls-btn rls-btn-secondary rls-btn-cancel">${t('modal_btn_cancel', 'Abbrechen')}</button>
          <button class="rls-btn rls-btn-primary rls-btn-save">${t('modal_btn_save', 'Speichern')}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeBtn = modal.querySelector('.rls-modal-close');
    const cancelBtn = modal.querySelector('.rls-btn-cancel');
    const saveBtn = modal.querySelector('.rls-btn-save');
    const overlay = modal.querySelector('.rls-modal-overlay');
    const templateSelect = modal.querySelector('.rls-template-select');
    
    const closeModal = () => {
      modal.classList.add('rls-modal-closing');
      setTimeout(() => modal.remove(), 150);
    };
    
    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Template-Änderung
    if (templateSelect) {
      templateSelect.addEventListener('change', async (e) => {
        if (e.target.value) {
          try {
            const template = await window.api.policyGetTemplate(e.target.value);
            modal.querySelector('.rls-policy-name').value = template.name;
            modal.querySelector('.rls-operation-select').value = template.command;
            modal.querySelector('.rls-using-expr').value = template.definition || '';
            modal.querySelector('.rls-check-expr').value = template.check || '';
          } catch (err) {
            console.warn('Template konnte nicht geladen werden', err);
          }
        }
      });
    }
    
    // Speichern
    saveBtn.addEventListener('click', async () => {
      const policyName = modal.querySelector('.rls-policy-name').value?.trim();
      if (!policyName) {
        alert('Bitte geben Sie einen Namen ein');
        return;
      }
      
      const policyData = {
        schema: schema,
        table: table,
        name: policyName,
        command: modal.querySelector('.rls-operation-select').value,
        definition: modal.querySelector('.rls-using-expr').value?.trim() || null,
        check: modal.querySelector('.rls-check-expr').value?.trim() || null,
        roles: ['public']
      };
      
      try {
        saveBtn.disabled = true;
        const result = await window.api.policyCreate(policyData);
        console.log(`✅ ${t('success_created', `Policy erstellt: ${policyData.name}`, { name: policyData.name })}`);
        closeModal();
        await loadTablePolicies();
      } catch (error) {
        console.error('Fehler:', error);
        alert(`Fehler: ${error.message}`);
        saveBtn.disabled = false;
      }
    });
  } catch (error) {
    console.error('Fehler beim Öffnen des Editors:', error);
    alert(`Fehler: ${error.message}`);
  }
}

/**
 * Wird aufgerufen wenn Tabelle wechselt
 */
export async function onTableChanged() {
  if (rlsPoliciesPanel) {
    await loadTablePolicies();
  }
}
