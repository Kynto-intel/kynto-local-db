const { ipcMain } = require('electron');
const { policiesManager } = require('./policies-manager');

/**
 * Registriert alle Policy-IPC-Handler
 * @param {Object} databaseEngine - Database Engine vom Main Process
 */
function registerPolicyHandlers(databaseEngine) {
  // Erstelle einen Adapter für die DB-Connection
  // Nutze IMMER 'remote' für RLS-Policies (da Tabellen in Remote-DB sind)
  const dbAdapter = {
    query: async (sql, params = []) => {
      try {
        console.log('🔒 Policy-Query an Remote-DB:', sql.substring(0, 50) + '...');
        return await databaseEngine.executeQuery(sql, params, 'remote');
      } catch (error) {
        console.error('❌ Remote-DB Policy-Fehler:', error);
        throw error;
      }
    }
  };

  // Setze DB-Verbindung im Manager
  policiesManager.setDatabaseConnection(dbAdapter);

  /**
   * Lädt alle Policies einer Tabelle
   */
  ipcMain.handle('policy:load', async (event, schema, table) => {
    try {
      return await policiesManager.loadPolicies(schema, table);
    } catch (error) {
      console.error('Error in policy:load:', error);
      return { error: error.message };
    }
  });

  /**
   * Erstellt neue Policy
   */
  ipcMain.handle('policy:create', async (event, policyData) => {
    try {
      return await policiesManager.createPolicy(policyData);
    } catch (error) {
      console.error('Error in policy:create:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Aktualisiert bestehende Policy
   */
  ipcMain.handle('policy:update', async (event, policyData, originalData) => {
    try {
      return await policiesManager.updatePolicy(policyData, originalData);
    } catch (error) {
      console.error('Error in policy:update:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Löscht eine Policy
   */
  ipcMain.handle('policy:delete', async (event, policyName, schema, table) => {
    try {
      return await policiesManager.deletePolicy(policyName, schema, table);
    } catch (error) {
      console.error('Error in policy:delete:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Aktiviert RLS auf Tabelle
   */
  ipcMain.handle('policy:enable-rls', async (event, schema, table) => {
    try {
      return await policiesManager.enableRLS(schema, table);
    } catch (error) {
      console.error('Error in policy:enable-rls:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Deaktiviert RLS auf Tabelle
   */
  ipcMain.handle('policy:disable-rls', async (event, schema, table) => {
    try {
      return await policiesManager.disableRLS(schema, table);
    } catch (error) {
      console.error('Error in policy:disable-rls:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Gibt Tabellen mit RLS-Status zurück
   */
  ipcMain.handle('policy:get-tables', async (event) => {
    try {
      return await policiesManager.getTablesWithRLSStatus();
    } catch (error) {
      console.error('Error in policy:get-tables:', error);
      return { error: error.message };
    }
  });

  /**
   * Gibt alle Policy-Templates zurück
   */
  ipcMain.handle('policy:get-templates', (event) => {
    try {
      return policiesManager.getAllTemplates();
    } catch (error) {
      console.error('Error in policy:get-templates:', error);
      return { error: error.message };
    }
  });

  /**
   * Gibt spezifisches Template zurück
   */
  ipcMain.handle('policy:get-template', (event, templateId) => {
    try {
      const template = policiesManager.getTemplate(templateId);
      return template || { error: 'Template nicht gefunden' };
    } catch (error) {
      console.error('Error in policy:get-template:', error);
      return { error: error.message };
    }
  });

  /**
   * Generiert Policy aus Template
   */
  ipcMain.handle('policy:generate-from-template', (event, templateId, schema, table, customValues) => {
    try {
      return policiesManager.generatePolicyFromTemplate(
        templateId,
        schema,
        table,
        customValues || {}
      );
    } catch (error) {
      console.error('Error in policy:generate-from-template:', error);
      return { error: error.message };
    }
  });

  console.log('✅ Policy IPC-Handler registriert');
}

module.exports = {
  registerPolicyHandlers,
  policiesManager,
};