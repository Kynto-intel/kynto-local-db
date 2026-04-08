/**
 * RLS Dashboard - Vollständige grafische UI für RLS-Management
 * Zeigt Tabellen, RLS-Status, Policies mit Edit/Delete
 */

import { state } from '../state.js';

let rlsPanel = null;
let policiesData = {};

/**
 * Initialisiert das RLS-Dashboard Panel
 */
export async function initRLSDashboard() {
  // Panel erstellen wenn nicht vorhanden
  if (!rlsPanel) {
    rlsPanel = document.createElement('div');
    rlsPanel.id = 'rls-dashboard-panel';
    rlsPanel.className = 'rls-dashboard-panel';
    rlsPanel.innerHTML = `
      <div class="rls-header">
        <h3>🔒 RLS Manager</h3>
        <button class="rls-refresh-btn" title="Aktualisieren">↻</button>
      </div>
      <div class="rls-content">
        <div class="rls-empty">Warte auf Remote-DB...</div>
      </div>
    `;
    
    // In Sidebar einfügen
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.appendChild(rlsPanel);
    }
    
    // Event Listener
    rlsPanel.querySelector('.rls-refresh-btn').addEventListener('click', refreshRLSPanel);
  }
  
  // Initial laden mit Retry
  setTimeout(() => {
    refreshRLSPanel().catch(e => console.log('RLS Dashboard initial load skipped:', e.message));
  }, 2000); // 2 Sekunden warten bis Remote-DB verbunden ist
}

/**
 * Aktualisiert das RLS-Panel mit aktuellen Daten
 */
export async function refreshRLSPanel() {
  const content = rlsPanel.querySelector('.rls-content');
  content.innerHTML = '<div class="rls-loading">Laden...</div>';
  
  try {
    // Tabellen mit RLS-Status laden
    let tables = [];
    try {
      tables = await window.api.policyGetTablesWithRLSStatus();
    } catch (error) {
      // Remote-DB noch nicht verbunden - zeige Platzhalter
      if (error.message.includes('Keine Remote-Datenbank')) {
        content.innerHTML = '<div class="rls-empty">Warte auf Remote-DB...</div>';
        return;
      }
      throw error;
    }
    
    if (!tables || tables.length === 0) {
      content.innerHTML = '<div class="rls-empty">Keine Tabellen gefunden</div>';
      return;
    }
    
    // HTML generieren
    let html = '<div class="rls-tables-list">';
    
    for (const table of tables) {
      const schema = table.schema || 'public';
      const tableName = table.name;
      const rlsActive = table.rls_enabled;
      
      // Policies laden
      let policies = [];
      try {
        policies = await window.api.policyLoad(schema, tableName);
      } catch (e) {
        console.log(`Keine Policies für ${schema}.${tableName}`);
      }
      
      html += `
        <div class="rls-table-item" data-schema="${schema}" data-table="${tableName}">
          <div class="rls-table-header">
            <div class="rls-table-name">
              ${rlsActive ? '🔒' : '🔓'} ${tableName}
            </div>
            <button class="rls-toggle-btn" data-enabled="${rlsActive}">
              ${rlsActive ? 'RLS An' : 'RLS Aus'}
            </button>
          </div>
          
          <div class="rls-policies-list">
            ${renderPolicies(policies)}
          </div>
          
          <button class="rls-add-policy-btn">+ Policy</button>
        </div>
      `;
    }
    
    html += '</div>';
    content.innerHTML = html;
    
    // Event Listener
    attachRLSEventListeners();
    
  } catch (error) {
    console.error('Fehler beim Laden von RLS-Daten:', error);
    content.innerHTML = `<div class="rls-error">Fehler: ${error.message}</div>`;
  }
}

/**
 * Rendert Policies für eine Tabelle
 */
function renderPolicies(policies) {
  if (!policies || policies.length === 0) {
    return '<div class="rls-no-policies">Keine Policies</div>';
  }
  
  return policies.map(policy => `
    <div class="rls-policy-item">
      <div class="rls-policy-name">${policy.name || policy.policyname || 'Unbenannt'}</div>
      <div class="rls-policy-command">${policy.command || policy.polcmd || 'N/A'}</div>
      <div class="rls-policy-actions">
        <button class="rls-edit-btn" data-policy="${policy.name || policy.policyname}">✏️</button>
        <button class="rls-delete-btn" data-policy="${policy.name || policy.policyname}">🗑️</button>
      </div>
    </div>
  `).join('');
}

/**
 * Attacht Event Listener für RLS-Buttons
 */
function attachRLSEventListeners() {
  // RLS Ein/Aus Toggle
  document.querySelectorAll('.rls-toggle-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const item = e.target.closest('.rls-table-item');
      const schema = item.dataset.schema;
      const table = item.dataset.table;
      const isEnabled = e.target.dataset.enabled === 'true';
      
      try {
        if (isEnabled) {
          await window.api.policyDisableRLS(schema, table);
          console.log(`✅ RLS deaktiviert für ${table}`);
        } else {
          await window.api.policyEnableRLS(schema, table);
          console.log(`✅ RLS aktiviert für ${table}`);
        }
        await refreshRLSPanel();
      } catch (error) {
        console.error('RLS Toggle Fehler:', error);
      }
    });
  });
  
  // Neue Policy Button
  document.querySelectorAll('.rls-add-policy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = e.target.closest('.rls-table-item');
      const schema = item.dataset.schema;
      const table = item.dataset.table;
      showPolicyEditor(schema, table, null);
    });
  });
  
  // Edit Policy
  document.querySelectorAll('.rls-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = e.target.closest('.rls-table-item');
      const schema = item.dataset.schema;
      const table = item.dataset.table;
      const policyName = e.target.dataset.policy;
      // TODO: Edit-Mode implementieren
      console.log(`Edit Policy: ${policyName}`);
    });
  });
  
  // Delete Policy
  document.querySelectorAll('.rls-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const item = e.target.closest('.rls-table-item');
      const schema = item.dataset.schema;
      const table = item.dataset.table;
      const policyName = e.target.dataset.policy;
      
      if (confirm(`Policy "${policyName}" löschen?`)) {
        try {
          await window.api.policyDelete(policyName, schema, table);
          console.log(`✅ Policy gelöscht: ${policyName}`);
          await refreshRLSPanel();
        } catch (error) {
          console.error('Policy Delete Fehler:', error);
        }
      }
    });
  });
}

/**
 * Zeigt Policy-Editor Modal
 */
async function showPolicyEditor(schema, table, existingPolicy = null) {
  // Templates laden
  const templates = await window.api.policyGetTemplates();
  
  // Modal erstellen
  const modal = document.createElement('div');
  modal.className = 'rls-policy-modal';
  modal.innerHTML = `
    <div class="rls-modal-overlay"></div>
    <div class="rls-modal-content">
      <div class="rls-modal-header">
        <h4>${existingPolicy ? '✏️ Policy Bearbeiten' : '➕ Neue Policy'}</h4>
        <button class="rls-modal-close">✕</button>
      </div>
      
      <div class="rls-modal-body">
        <div class="rls-form-group">
          <label>Template:</label>
          <select class="rls-template-select">
            <option value="">-- Eigenes SQL --</option>
            ${templates.map(t => `<option value="${t.id}">${t.templateName}</option>`).join('')}
          </select>
        </div>
        
        <div class="rls-form-group">
          <label>Policy Name:</label>
          <input type="text" class="rls-policy-name-input" placeholder="z.B. user_isolation">
        </div>
        
        <div class="rls-form-group">
          <label>Operation:</label>
          <select class="rls-command-select">
            <option value="SELECT">SELECT</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="ALL">ALL</option>
          </select>
        </div>
        
        <div class="rls-form-group">
          <label>USING (SELECT):</label>
          <textarea class="rls-definition-input" placeholder="z.B. (select auth.uid()) = user_id"></textarea>
        </div>
        
        <div class="rls-form-group">
          <label>WITH CHECK (INSERT/UPDATE):</label>
          <textarea class="rls-check-input" placeholder="Optional für INSERT/UPDATE"></textarea>
        </div>
      </div>
      
      <div class="rls-modal-footer">
        <button class="rls-modal-cancel">Abbrechen</button>
        <button class="rls-modal-save">Speichern</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event Listener
  const overlay = modal.querySelector('.rls-modal-overlay');
  const closeBtn = modal.querySelector('.rls-modal-close');
  const cancelBtn = modal.querySelector('.rls-modal-cancel');
  const saveBtn = modal.querySelector('.rls-modal-save');
  const templateSelect = modal.querySelector('.rls-template-select');
  
  const closeModal = () => modal.remove();
  
  overlay.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  
  // Template-Änderung
  templateSelect.addEventListener('change', async (e) => {
    if (e.target.value) {
      const template = await window.api.policyGetTemplate(e.target.value);
      modal.querySelector('.rls-policy-name-input').value = template.name;
      modal.querySelector('.rls-command-select').value = template.command;
      modal.querySelector('.rls-definition-input').value = template.definition || '';
      modal.querySelector('.rls-check-input').value = template.check || '';
    }
  });
  
  // Speichern
  saveBtn.addEventListener('click', async () => {
    const policyData = {
      schema: schema,
      table: table,
      name: modal.querySelector('.rls-policy-name-input').value,
      command: modal.querySelector('.rls-command-select').value,
      definition: modal.querySelector('.rls-definition-input').value || null,
      check: modal.querySelector('.rls-check-input').value || null,
      roles: ['public']
    };
    
    try {
      await window.api.policyCreate(policyData);
      console.log(`✅ Policy erstellt: ${policyData.name}`);
      closeModal();
      await refreshRLSPanel();
    } catch (error) {
      console.error('Policy Create Fehler:', error);
      alert(`Fehler: ${error.message}`);
    }
  });
}

// Auto-Init wenn Module geladen
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRLSDashboard);
} else {
  initRLSDashboard().catch(e => console.error('RLS Dashboard Init Fehler:', e));
}
