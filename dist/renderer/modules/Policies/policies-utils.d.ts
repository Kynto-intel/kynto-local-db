/**
 * Generiert SQL für Policy-Erstellung oder -Aktualisierung
 * @param {PolicyFormField} policyFormFields
 * @param {PolicyFormField} [originalPolicyFormFields]
 * @returns {PolicyForReview}
 */
export function createSQLPolicy(policyFormFields: PolicyFormField, originalPolicyFormFields?: PolicyFormField): PolicyForReview;
/**
 * Erstellt Payload für CREATE POLICY API
 * @param {PolicyFormField} policyFormFields
 * @returns {PostgresPolicyCreatePayload}
 */
export function createPayloadForCreatePolicy(policyFormFields: PolicyFormField): PostgresPolicyCreatePayload;
/**
 * Erstellt Payload für UPDATE POLICY API
 * @param {PolicyFormField} policyFormFields
 * @param {PolicyFormField} originalPolicyFormFields
 * @returns {PostgresPolicyUpdatePayload}
 */
export function createPayloadForUpdatePolicy(policyFormFields: PolicyFormField, originalPolicyFormFields: PolicyFormField): PostgresPolicyUpdatePayload;
/**
 * Erstellt SQL für CREATE POLICY
 * @param {PolicyFormField} policyFormFields
 * @returns {PolicyForReview}
 */
export function createSQLStatementForCreatePolicy(policyFormFields: PolicyFormField): PolicyForReview;
/**
 * Erstellt SQL für ALTER POLICY (Updates)
 * @param {PolicyFormField} policyFormFields
 * @param {Object} fieldsToUpdate
 * @returns {PolicyForReview}
 */
export function createSQLStatementForUpdatePolicy(policyFormFields: PolicyFormField, fieldsToUpdate: any): PolicyForReview;
/**
 * Generiert SQL für DROP POLICY
 * @param {string} policyName
 * @param {string} schema
 * @param {string} table
 * @returns {string}
 */
export function createSQLStatementForDropPolicy(policyName: string, schema: string, table: string): string;
/**
 * Aktiviert RLS auf einer Tabelle
 * @param {string} schema
 * @param {string} table
 * @returns {string}
 */
export function createSQLStatementToEnableRLS(schema: string, table: string): string;
/**
 * Deaktiviert RLS auf einer Tabelle
 * @param {string} schema
 * @param {string} table
 * @returns {string}
 */
export function createSQLStatementToDisableRLS(schema: string, table: string): string;
/**
 * Validiert eine Policy
 * @param {PolicyFormField} policy
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validatePolicy(policy: PolicyFormField): {
    valid: boolean;
    errors: string[];
};
/**
 * Normalisiert Whitespace in SQL-Expressions
 */
export function normalizeExpression(expr: any): any;
/**
 * Prüft ob zwei Objekte gleich sind (tiefe Vergleichung)
 */
export function deepEqual(obj1: any, obj2: any): boolean;
/**
 * Prüft ob Objekt leer ist
 */
export function isEmpty(obj: any): boolean;
