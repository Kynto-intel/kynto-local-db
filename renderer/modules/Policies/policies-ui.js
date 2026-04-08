/**
 * Policy IPC Helper für Renderer Process
 * Benutzt window.api aus dem Preload-Script (ExposeInMainWorld)
 */

/**
 * Lädt alle Policies einer Tabelle
 */
export async function loadPolicies(schema, table) {
  try {
    return await window.api.policyLoad(schema, table);
  } catch (error) {
    console.error('Error loading policies:', error);
    throw error;
  }
}

/**
 * Erstellt eine neue Policy
 */
export async function createPolicy(policyData) {
  try {
    return await window.api.policyCreate(policyData);
  } catch (error) {
    console.error('Error creating policy:', error);
    throw error;
  }
}

/**
 * Aktualisiert eine Policy
 */
export async function updatePolicy(policyData, originalData) {
  try {
    return await window.api.policyUpdate(policyData, originalData);
  } catch (error) {
    console.error('Error updating policy:', error);
    throw error;
  }
}

/**
 * Löscht eine Policy
 */
export async function deletePolicy(policyName, schema, table) {
  try {
    return await window.api.policyDelete(policyName, schema, table);
  } catch (error) {
    console.error('Error deleting policy:', error);
    throw error;
  }
}

/**
 * Aktiviert RLS auf einer Tabelle
 */
export async function enableRLS(schema, table) {
  try {
    return await window.api.policyEnableRLS(schema, table);
  } catch (error) {
    console.error('Error enabling RLS:', error);
    throw error;
  }
}

/**
 * Deaktiviert RLS auf einer Tabelle
 */
export async function disableRLS(schema, table) {
  try {
    return await window.api.policyDisableRLS(schema, table);
  } catch (error) {
    console.error('Error disabling RLS:', error);
    throw error;
  }
}

/**
 * Gibt alle Tabellen mit RLS-Status zurück
 */
export async function getTablesWithRLSStatus() {
  try {
    return await window.api.policyGetTablesWithRLSStatus();
  } catch (error) {
    console.error('Error getting tables:', error);
    throw error;
  }
}

/**
 * Gibt alle Policy-Templates zurück
 */
export async function getTemplates() {
  try {
    return await window.api.policyGetTemplates();
  } catch (error) {
    console.error('Error getting templates:', error);
    throw error;
  }
}

/**
 * Gibt ein spezifisches Policy-Template zurück
 */
export async function getTemplate(templateId) {
  try {
    return await window.api.policyGetTemplate(templateId);
  } catch (error) {
    console.error('Error getting template:', error);
    throw error;
  }
}

/**
 * Generiert eine Policy aus einem Template
 */
export async function generatePolicyFromTemplate(templateId, schema, table, customValues = {}) {
  try {
    return await window.api.policyGenerateFromTemplate(templateId, schema, table, customValues);
  } catch (error) {
    console.error('Error generating policy from template:', error);
    throw error;
  }
}

// Auch als globale Funktionen verfügbar (für inline Scripts)
if (typeof window !== 'undefined') {
  window.policiesAPI = {
    loadPolicies,
    createPolicy,
    updatePolicy,
    deletePolicy,
    enableRLS,
    disableRLS,
    getTablesWithRLSStatus,
    getTemplates,
    getTemplate,
    generatePolicyFromTemplate,
  };
  console.log('✅ Policies API verfügbar unter window.policiesAPI');
}
