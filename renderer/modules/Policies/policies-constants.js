/**
 * Policy Modal View Konstanten
 */
const POLICY_MODAL_VIEWS = {
  SELECTION: 'SELECTION',
  TEMPLATES: 'TEMPLATES',
  EDITOR: 'EDITOR',
  REVIEW: 'REVIEW',
};

/**
 * Vordefinierte RLS Policy Templates
 * @type {Array<PolicyTemplate>}
 */
const POLICY_TEMPLATES = [
  {
    id: 'user-based-select',
    preview: false,
    templateName: 'User-based SELECT',
    description: 'Nutzer können nur ihre eigenen Zeilen sehen (user_id Spalte)',
    name: 'Enable select access for users based on user_id',
    statement: 'SELECT',
    definition: '(select auth.uid()) = user_id',
    check: null,
    command: 'SELECT',
    roles: ['public'],  // ← Geändert von 'authenticated' zu 'public'
  },
  {
    id: 'user-based-insert',
    preview: false,
    templateName: 'User-based INSERT',
    description: 'Nutzer können nur ihre eigenen Zeilen einfügen',
    name: 'Enable insert access for users based on user_id',
    statement: 'INSERT',
    definition: null,
    check: '(select auth.uid()) = user_id',
    command: 'INSERT',
    roles: ['public'],  // ← Geändert von 'authenticated' zu 'public'
  },
  {
    id: 'user-based-update',
    preview: false,
    templateName: 'User-based UPDATE',
    description: 'Nutzer können nur ihre eigenen Zeilen ändern',
    name: 'Enable update access for users based on user_id',
    statement: 'UPDATE',
    definition: '(select auth.uid()) = user_id',
    check: '(select auth.uid()) = user_id',
    command: 'UPDATE',
    roles: ['public'],  // ← Geändert von 'authenticated' zu 'public'
  },
  {
    id: 'user-based-delete',
    preview: false,
    templateName: 'User-based DELETE',
    description: 'Nutzer können nur ihre eigenen Zeilen löschen',
    name: 'Enable delete access for users based on user_id',
    statement: 'DELETE',
    definition: '(select auth.uid()) = user_id',
    check: null,
    command: 'DELETE',
    roles: ['public'],  // ← Geändert von 'authenticated' zu 'public'
  },
  {
    id: 'public-read',
    preview: false,
    templateName: 'Public Read-Only',
    description: 'Alle können Daten lesen (keine Änderungen)',
    name: 'Public read-only access',
    statement: 'SELECT',
    definition: 'true',
    check: null,
    command: 'SELECT',
    roles: ['public', 'authenticated'],
  },
  {
    id: 'owner-based-all',
    preview: false,
    templateName: 'Owner-based (vollständig)',
    description: 'Nur der Owner alle CRUD-Operationen',
    name: 'Owner-based full access',
    statement: 'ALL',
    definition: '(select auth.uid()) = owner_id',
    check: '(select auth.uid()) = owner_id',
    command: 'ALL',
    roles: ['public'],  // ← Geändert von 'authenticated' zu 'public'
  },
  {
    id: 'admin-only',
    preview: false,
    templateName: 'Admin-only',
    description: 'Nur Administratoren haben Zugriff',
    name: 'Admin only access',
    statement: 'ALL',
    definition: "(auth.jwt() ->> 'role') = 'admin'",
    check: "(auth.jwt() ->> 'role') = 'admin'",
    command: 'ALL',
    roles: ['public'],  // ← Geändert von 'authenticated' zu 'public'
  },
];

module.exports = {
  POLICY_MODAL_VIEWS,
  POLICY_TEMPLATES,
};