/* ── modules/utils.js ─────────────────────────────────────────────────
   Reine Hilfsfunktionen ohne Seiteneffekte.
   ──────────────────────────────────────────────────────────────────── */

/** Einzigartiger kurzer ID-String */
export const uid  = () => Math.random().toString(36).slice(2);

/** SQL-Bezeichner sicher in Anführungszeichen setzen */
export const esc  = (n) => {
    if (typeof n !== 'string') return n;
    // Erlaubt das korrekte Escapen von Pfaden wie "db.schema.table"
    return n.split('.').map(part => `"${part.replace(/"/g, '""')}"`).join('.');
};

/** HTML-Sonderzeichen escapen */
export const escH = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Status-Bar + Header-Info gleichzeitig setzen.
 * @param {string} msg
 * @param {'error'|'success'|''} type
 */
export function setStatus(msg, type = '') {
    const statusEl    = document.getElementById('status');
    const headerInfo  = document.getElementById('header-info');
    if (statusEl)   { statusEl.textContent = msg; statusEl.className = type; }
    if (headerInfo)   headerInfo.textContent = msg;
}

/** 
 * Aktuellen SQL-Editor-Inhalt lesen.
 * Bevorzugt markierten Text, falls vorhanden (Smart Run).
 */
export function getEditorVal(state) {
    if (state.editor) {
        const selection = state.editor.getSelection();
        const selectedText = state.editor.getModel().getValueInRange(selection);
        if (selectedText && selectedText.trim().length > 0) {
            return selectedText;
        }
        return state.editor.getValue();
    }
    return document.getElementById('sql-fallback')?.value ?? '';
}

/** SQL-Editor-Inhalt setzen */
export function setEditorVal(state, v) {
    console.debug('[setEditorVal] Attempting to set value:', v?.substring(0, 50) + '...');
    console.debug('[setEditorVal] state.editor exists?', !!state.editor);
    
    // Zuerst Monaco versuchen
    if (state.editor?.setValue) {
        try {
            state.editor.setValue(v);
            console.debug('[setEditorVal] Successfully set via Monaco');
            return;
        } catch (e) {
            console.error('[setEditorVal] Monaco setValue failed:', e);
        }
    }
    
    // Fallback: textarea
    const fb = document.getElementById('sql-fallback');
    if (fb) {
        fb.value = v;
        console.debug('[setEditorVal] Set via fallback textarea');
        return;
    }
    
    console.warn('[setEditorVal] No editor found - value not set!');
}

/**
 * Datei im Browser-Download-Dialog speichern.
 * @param {string} content
 * @param {string} mime
 * @param {string} name  Dateiname inkl. Extension
 */
export function dlBlob(content, mime, name) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    Object.assign(document.createElement('a'), { href: url, download: name }).click();
    URL.revokeObjectURL(url);
}