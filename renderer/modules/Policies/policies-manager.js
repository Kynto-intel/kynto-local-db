const {
  createSQLPolicy,
  createPayloadForCreatePolicy,
  createPayloadForUpdatePolicy,
  validatePolicy,
  createSQLStatementForDropPolicy,
  createSQLStatementToEnableRLS,
  createSQLStatementToDisableRLS,
} = require('./policies-utils');
const { POLICY_TEMPLATES } = require('./policies-constants');

/**
 * Policies Manager für Datenbank-RLS-Verwaltung
 */
class PoliciesManager {
  constructor() {
    this.policies = [];
    this.tables = [];
    this.dbConnection = null;
  }

  /**
   * Setzt Datenbankverbindung
   */
  setDatabaseConnection(dbConnection) {
    this.dbConnection = dbConnection;
  }

  /**
   * Lädt alle Policies einer Tabelle
   * @param {string} schema
   * @param {string} table
   * @returns {Promise<Array>}
   */
  async loadPolicies(schema, table) {
    try {
      if (!this.dbConnection) {
        console.warn('Keine Datenbankverbindung gesetzt');
        return [];
      }

      const query = `
        SELECT
          p.polname as name,
          c.relname as table,
          n.nspname as schema,
          p.polcmd as command,
          p.polpermissive as action,
          p.polroles as roles,
          p.polqual as definition,
          p.polwithcheck as check,
          p.oid as id
        FROM pg_policy p
        LEFT JOIN pg_class c ON c.oid = p.polrelid
        LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2
        ORDER BY p.polname ASC
      `;

      const result = await this.dbConnection.query(query, [schema, table]);
      this.policies = result.rows;
      return result.rows;
    } catch (error) {
      console.error('Fehler beim Laden von Policies:', error);
      return [];
    }
  }

  /**
   * Erstellt neue Policy
   * @param {PolicyFormField} policyFormFields
   * @returns {Promise<{success: boolean, sql: string, error?: string}>}
   */
  async createPolicy(policyFormFields) {
    try {
      // Validierung
      const validation = validatePolicy(policyFormFields);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', '),
        };
      }

      // SQL generieren
      const sqlResult = createSQLPolicy(policyFormFields);
      if (!sqlResult.statement) {
        return {
          success: false,
          error: 'SQL-Generierung fehlgeschlagen',
        };
      }

      // SQL ausführen
      if (this.dbConnection) {
        await this.dbConnection.query(sqlResult.statement);
      }

      return {
        success: true,
        sql: sqlResult.statement,
        description: sqlResult.description,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Aktualisiert bestehende Policy
   * @param {PolicyFormField} policyFormFields
   * @param {PolicyFormField} originalPolicyFormFields
   * @returns {Promise<{success: boolean, sql: string, error?: string}>}
   */
  async updatePolicy(policyFormFields, originalPolicyFormFields) {
    try {
      // Validierung
      const validation = validatePolicy(policyFormFields);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', '),
        };
      }

      // SQL generieren
      const sqlResult = createSQLPolicy(
        policyFormFields,
        originalPolicyFormFields
      );
      if (!sqlResult.statement) {
        return {
          success: true,
          message: 'Keine Änderungen erkannt',
        };
      }

      // SQL ausführen
      if (this.dbConnection) {
        await this.dbConnection.query(sqlResult.statement);
      }

      return {
        success: true,
        sql: sqlResult.statement,
        description: sqlResult.description,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Löscht eine Policy
   * @param {string} policyName
   * @param {string} schema
   * @param {string} table
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deletePolicy(policyName, schema, table) {
    try {
      const sql = createSQLStatementForDropPolicy(policyName, schema, table);

      if (this.dbConnection) {
        await this.dbConnection.query(sql);
      }

      return {
        success: true,
        message: `Policy "${policyName}" gelöscht`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Aktiviert RLS auf einer Tabelle
   * @param {string} schema
   * @param {string} table
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async enableRLS(schema, table) {
    try {
      const sql = createSQLStatementToEnableRLS(schema, table);

      if (this.dbConnection) {
        await this.dbConnection.query(sql);
      }

      return {
        success: true,
        message: `RLS aktiviert für "${schema}"."${table}"`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Deaktiviert RLS auf einer Tabelle
   * @param {string} schema
   * @param {string} table
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async disableRLS(schema, table) {
    try {
      const sql = createSQLStatementToDisableRLS(schema, table);

      if (this.dbConnection) {
        await this.dbConnection.query(sql);
      }

      return {
        success: true,
        message: `RLS deaktiviert für "${schema}"."${table}"`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Gibt alle Tabellen mit RLS-Status zurück
   * @returns {Promise<Array>}
   */
  async getTablesWithRLSStatus() {
    try {
      if (!this.dbConnection) {
        return [];
      }

      const query = `
        SELECT
          n.nspname as schema,
          c.relname as name,
          c.relrowsecurity as rls_enabled,
          c.oid as id
        FROM pg_class c
        LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY n.nspname, c.relname
      `;

      const result = await this.dbConnection.query(query);
      return result.rows;
    } catch (error) {
      console.error('Fehler beim Abrufen von Tabellen mit RLS-Status:', error);
      return [];
    }
  }

  /**
   * Gibt Policy-Template zurück
   * @param {string} templateId
   * @returns {PolicyTemplate|null}
   */
  getTemplate(templateId) {
    return (
      POLICY_TEMPLATES.find((t) => t.id === templateId) || null
    );
  }

  /**
   * Gibt alle verfügbaren Templates zurück
   * @returns {Array<PolicyTemplate>}
   */
  getAllTemplates() {
    return POLICY_TEMPLATES;
  }

  /**
   * Generiert Policy aus Template
   * @param {string} templateId
   * @param {string} schema
   * @param {string} table
   * @param {Object} customValues - Überschreiben von Template-Werten
   * @returns {PolicyFormField}
   */
  generatePolicyFromTemplate(templateId, schema, table, customValues = {}) {
    const template = this.getTemplate(templateId);
    if (!template) {
      return null;
    }

    return {
      name: customValues.name || template.name,
      schema: schema,
      table: table,
      command: customValues.command || template.command,
      definition: customValues.definition || template.definition,
      check: customValues.check || template.check,
      roles: customValues.roles || template.roles,
    };
  }
}

// Singleton-Instanz
const policiesManager = new PoliciesManager();

module.exports = {
  PoliciesManager,
  policiesManager,
};