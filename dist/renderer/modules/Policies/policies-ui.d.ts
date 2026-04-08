/**
* Policy IPC Helper für Renderer Process
* Benutzt window.api aus dem Preload-Script (ExposeInMainWorld)
*/
/**
 * Lädt alle Policies einer Tabelle
 */
export function loadPolicies(schema: any, table: any): Promise<any>;
/**
 * Erstellt eine neue Policy
 */
export function createPolicy(policyData: any): Promise<any>;
/**
 * Aktualisiert eine Policy
 */
export function updatePolicy(policyData: any, originalData: any): Promise<any>;
/**
 * Löscht eine Policy
 */
export function deletePolicy(policyName: any, schema: any, table: any): Promise<any>;
/**
 * Aktiviert RLS auf einer Tabelle
 */
export function enableRLS(schema: any, table: any): Promise<any>;
/**
 * Deaktiviert RLS auf einer Tabelle
 */
export function disableRLS(schema: any, table: any): Promise<any>;
/**
 * Gibt alle Tabellen mit RLS-Status zurück
 */
export function getTablesWithRLSStatus(): Promise<any>;
/**
 * Gibt alle Policy-Templates zurück
 */
export function getTemplates(): Promise<any>;
/**
 * Gibt ein spezifisches Policy-Template zurück
 */
export function getTemplate(templateId: any): Promise<any>;
/**
 * Generiert eine Policy aus einem Template
 */
export function generatePolicyFromTemplate(templateId: any, schema: any, table: any, customValues?: {}): Promise<any>;
