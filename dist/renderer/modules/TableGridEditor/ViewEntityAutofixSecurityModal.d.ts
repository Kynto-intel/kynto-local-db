/**
 * Öffnet den Autofix-Security-Dialog für eine View.
 *
 * @param {{ entity: object, dbId: string, onSuccess?: function }} opts
 *   entity – das Entity-Objekt mit { schema, name, entity_type }
 *   dbId   – aktive Datenbank-ID
 */
export function openAutofixSecurityModal({ entity, dbId, onSuccess }: {
    entity: object;
    dbId: string;
    onSuccess?: Function;
}): Promise<void>;
