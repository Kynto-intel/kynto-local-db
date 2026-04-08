/**
 * RLS Policies Tab - Pro Tabelle
 * Zeigt RLS-Richtlinien und erlaubt neue zu erstellen
 */

import { state } from '../../state.js';

let rlsPoliciesPanel = null;

/**
 * Initialisiert RLS-Policies Panel (wird als Tab angezeigt)
 */
export async function initRLSPoliciesPanel() {
  if (!rlsPoliciesPanel) {
    rlsPoliciesPanel = document.createElement('div');
    rlsPoliciesPanel.id = 'rls-policies-panel';
    rlsPoliciesPanel.className = 'rls-policies-panel';
  }
  
  // Aktuelle Tabelle prüfen
  if (!state.currentTable) {
    rlsPoliciesPanel.innerHTML = '<div class="rls-select-table">Wähle eine Tabelle</div>';
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
  
  rlsPoliciesPanel.innerHTML = '<div class="rls-loading">Laden...</div>';
  
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
    
    // HTML generieren
    let html = `
      <div class="rls-policies-container">
        <div class="rls-policies-header">
          <h3>🔒 RLS-Richtlinien für "${table}"</h3>
          <button class="rls-refresh-icon">↻</button>
        </div>
        
        <div class="rls-status-bar">
          <div class="rls-status-info">
            <span>RLS Status:</span>
            <span class="rls-status-badge ${rlsEnabled ? 'active' : 'inactive'}">
              ${rlsEnabled ? '🔒 Aktiv' : '🔓 Inaktiv'}
            </span>
          </div>
          <div class="rls-status-actions">
            <button class="rls-toggle-status" data-action="toggle">
              ${rlsEnabled ? 'RLS deaktivieren' : 'RLS aktivieren'}
            </button>
          </div>
        </div>
        
        <div class="rls-policies-list">
          <div class="rls-list-header">Bestehende Richtlinien</div>
          ${policies && policies.length > 0 ? 
            '<div class="rls-policies">' + policies.map(p => `
              <div class="rls-policy-row">
                <div class="rls-policy-info">
                  <div class="rls-policy-name">${p.name || p.policyname}</div>
                  <div class="rls-policy-command">${p.command || p.polcmd || 'ALL'}</div>
                </div>
                <div class="rls-policy-actions">
                  <button class="rls-policy-edit" data-policy="${p.name || p.policyname}" title="Bearbeiten">✏️</button>
                  <button class="rls-policy-delete" data-policy="${p.name || p.policyname}" title="Löschen">🗑️</button>
                </div>
              </div>
            `).join('') + '</div>'
            : '<div class="rls-no-policies">Keine Richtlinien vorhanden</div>'
          }
        </div>
        
        <div class="rls-add-section">
          <button class="rls-add-policy-btn">+ Neue Richtlinie hinzufügen</button>
        </div>
      </div>
    `;
    
    rlsPoliciesPanel.innerHTML = html;
    attachPoliciesEventListeners(schema, table, rlsEnabled);
    
  } catch (error) {
    console.error('Fehler beim Laden von Policies:', error);
    rlsPoliciesPanel.innerHTML = `<div class="rls-error">Fehler: ${error.message}</div>`;
  }
}

/**
 * Attacht Event Listener
 */
function attachPoliciesEventListeners(schema, table, rlsEnabled) {
  const schema_arg = schema;
  const table_arg = table;
  
  // Refresh Button
  rlsPoliciesPanel.querySelector('.rls-refresh-icon')?.addEventListener('click', () => {
    loadTablePolicies();
  });
  
  // RLS Status Toggle
  rlsPoliciesPanel.querySelector('.rls-toggle-status')?.addEventListener('click', async () => {
    try {
      if (rlsEnabled) {
        await window.api.policyDisableRLS(schema_arg, table_arg);
        console.log(`✅ RLS deaktiviert für ${table_arg}`);
      } else {
        await window.api.policyEnableRLS(schema_arg, table_arg);
        console.log(`✅ RLS aktiviert für ${table_arg}`);
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
      const policyName = e.target.dataset.policy;
      if (confirm(`Richtlinie "${policyName}" löschen?`)) {
        try {
          await window.api.policyDelete(policyName, schema_arg, table_arg);
          console.log(`✅ Gelöscht: ${policyName}`);
          await loadTablePolicies();
        } catch (error) {
          console.error('Fehler:', error);
          alert(`Fehler: ${error.message}`);
        }
      }
    });
  });
}

/**
 * Zeigt Policy Editor Modal
 */
async function showPolicyEditor(schema, table, existingPolicy = null) {
  const templates = await window.api.policyGetTemplates();
  
  const modal = document.createElement('div');
  modal.className = 'rls-policy-editor-modal';
  modal.innerHTML = `
    <div class="rls-modal-bg"></div>
    <div class="rls-modal">
      <div class="rls-modal-header">
        <h3>${existingPolicy ? '✏️ Richtlinie bearbeiten' : '➕ Neue Richtlinie'}</h3>
        <button class="rls-modal-close">✕</button>
      </div>
      
      <div class="rls-modal-body">
        <div class="rls-form-group">
          <label>Template wählen:</label>
          <select class="rls-template-select">
            <option value="">-- Eigenes SQL schreiben --</option>
            ${templates.map(t => `<option value="${t.id}">${t.templateName}</option>`).join('')}
          </select>
        </div>
        
        <div class="rls-form-group">
          <label>Richtlinie Name:</label>
          <input type="text" class="rls-policy-name" placeholder="z.B. user_isolation_select">
        </div>
        
        <div class="rls-form-group">
          <label>Operation (SELECT, INSERT, UPDATE, DELETE, ALL):</label>
          <select class="rls-operation-select">
            <option value="SELECT">SELECT</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="ALL">ALL</option>
          </select>
        </div>
        
        <div class="rls-form-group">
          <label>USING-Ausdruck (für SELECT/UPDATE/DELETE):</label>
          <textarea class="rls-using-expr" placeholder="z.B.: (select auth.uid()) = user_id" rows="4"></textarea>
        </div>
        
        <div class="rls-form-group">
          <label>WITH CHECK-Ausdruck (für INSERT/UPDATE):</label>
          <textarea class="rls-check-expr" placeholder="Optional" rows="3"></textarea>
        </div>
        
        <div class="rls-form-group rls-sql-preview">
          <label>Vorschau:</label>
          <pre class="rls-sql-code">CREATE POLICY ... (wird aktualisiert)</pre>
        </div>
      </div>
      
      <div class="rls-modal-footer">
        <button class="rls-btn-cancel">Abbrechen</button>
        <button class="rls-btn-save">Speichern</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const closeBtn = modal.querySelector('.rls-modal-close');
  const cancelBtn = modal.querySelector('.rls-btn-cancel');
  const saveBtn = modal.querySelector('.rls-btn-save');
  const bg = modal.querySelector('.rls-modal-bg');
  const templateSelect = modal.querySelector('.rls-template-select');
  
  const closeModal = () => modal.remove();
  
  bg.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  
  // Template-Änderung
  templateSelect.addEventListener('change', async (e) => {
    if (e.target.value) {
      const template = await window.api.policyGetTemplate(e.target.value);
      modal.querySelector('.rls-policy-name').value = template.name;
      modal.querySelector('.rls-operation-select').value = template.command;
      modal.querySelector('.rls-using-expr').value = template.definition || '';
      modal.querySelector('.rls-check-expr').value = template.check || '';
    }
  });
  
  // Speichern
  saveBtn.addEventListener('click', async () => {
    const policyData = {
      schema: schema,
      table: table,
      name: modal.querySelector('.rls-policy-name').value,
      command: modal.querySelector('.rls-operation-select').value,
      definition: modal.querySelector('.rls-using-expr').value || null,
      check: modal.querySelector('.rls-check-expr').value || null,
      roles: ['public']
    };
    
    try {
      const result = await window.api.policyCreate(policyData);
      console.log(`✅ Policy erstellt: ${policyData.name}`);
      closeModal();
      await loadTablePolicies();
    } catch (error) {
      console.error('Fehler:', error);
      alert(`Fehler: ${error.message}`);
    }
  });
}

/**
 * Wird aufgerufen wenn Tabelle wechselt
 */
export async function onTableChanged() {
  if (rlsPoliciesPanel) {
    await loadTablePolicies();
  }
}
