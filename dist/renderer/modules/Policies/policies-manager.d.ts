/**
 * Policies Manager für Datenbank-RLS-Verwaltung
 */
export class PoliciesManager {
    policies: any[];
    tables: any[];
    dbConnection: any;
    /**
     * Setzt Datenbankverbindung
     */
    setDatabaseConnection(dbConnection: any): void;
    /**
     * Lädt alle Policies einer Tabelle
     * @param {string} schema
     * @param {string} table
     * @returns {Promise<Array>}
     */
    loadPolicies(schema: string, table: string): Promise<any[]>;
    /**
     * Erstellt neue Policy
     * @param {PolicyFormField} policyFormFields
     * @returns {Promise<{success: boolean, sql: string, error?: string}>}
     */
    createPolicy(policyFormFields: PolicyFormField): Promise<{
        success: boolean;
        sql: string;
        error?: string;
    }>;
    /**
     * Aktualisiert bestehende Policy
     * @param {PolicyFormField} policyFormFields
     * @param {PolicyFormField} originalPolicyFormFields
     * @returns {Promise<{success: boolean, sql: string, error?: string}>}
     */
    updatePolicy(policyFormFields: PolicyFormField, originalPolicyFormFields: PolicyFormField): Promise<{
        success: boolean;
        sql: string;
        error?: string;
    }>;
    /**
     * Löscht eine Policy
     * @param {string} policyName
     * @param {string} schema
     * @param {string} table
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    deletePolicy(policyName: string, schema: string, table: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Aktiviert RLS auf einer Tabelle
     * @param {string} schema
     * @param {string} table
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    enableRLS(schema: string, table: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Deaktiviert RLS auf einer Tabelle
     * @param {string} schema
     * @param {string} table
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    disableRLS(schema: string, table: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Gibt alle Tabellen mit RLS-Status zurück
     * @returns {Promise<Array>}
     */
    getTablesWithRLSStatus(): Promise<any[]>;
    /**
     * Gibt Policy-Template zurück
     * @param {string} templateId
     * @returns {PolicyTemplate|null}
     */
    getTemplate(templateId: string): PolicyTemplate | null;
    /**
     * Gibt alle verfügbaren Templates zurück
     * @returns {Array<PolicyTemplate>}
     */
    getAllTemplates(): Array<PolicyTemplate>;
    /**
     * Generiert Policy aus Template
     * @param {string} templateId
     * @param {string} schema
     * @param {string} table
     * @param {Object} customValues - Überschreiben von Template-Werten
     * @returns {PolicyFormField}
     */
    generatePolicyFromTemplate(templateId: string, schema: string, table: string, customValues?: any): PolicyFormField;
}
export const policiesManager: PoliciesManager;
