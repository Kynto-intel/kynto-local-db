/**
 * SpreadsheetImportSidebar - CSV Import als rechte Seitenleiste (wie storage.manager.html)
 * Design mit CSS-Variablen, Accent-Farben, Gradient-Header, Smooth Animations
 */

import React, { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import { parseSpreadsheetText, inferredTypeToPostgreSQLType } from './SpreadsheetImport.utils'

declare global {
  interface Window {
    executeQuery?: (sql: string, params?: Array<any>, options?: any) => Promise<any>
    getSelectedDatabase?: () => string
  }
}

interface SpreadsheetImportSidebarProps {
  visible?: boolean
  selectedTable?: string | null
  onImport?: () => void
  onClose?: () => void
}

// CSS für Sidebar (wie storage.manager.html)
const SIDEBAR_STYLES = `
  :root {
    --bg: #18181b;
    --surface: #1f1f23;
    --surface2: #2d2d2d;
    --border: rgba(255,255,255,0.11);
    --border-light: rgba(255,255,255,0.05);
    --accent: #c29a40;
    --accent-rgb: 194,154,64;
    --muted: #6b6b7e;
    --text: #e8e8ee;
  }

  .sidebar-import {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 420px;
    max-width: 100vw;
    background: var(--bg);
    z-index: 5000;
    display: flex;
    flex-direction: column;
    box-shadow: -8px 0 8px rgba(0,0,0,0.2), -1px 0 0 var(--border);
    animation: slideInRight 0.3s ease-out;
    border-left: 1px solid var(--border);
  }

  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .sidebar-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-light);
    background: linear-gradient(180deg, rgba(var(--accent-rgb),0.05) 0%, transparent 100%);
    border-top: 2px solid var(--accent);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .sidebar-header-title {
    color: var(--text);
    font-size: 14px;
    font-weight: 700;
    margin: 0;
  }

  .sidebar-header-subtitle {
    color: var(--muted);
    font-size: 10px;
    margin-top: 4px;
    font-weight: 400;
  }

  .sidebar-close-btn {
    background: none;
    border: none;
    font-size: 20px;
    color: var(--muted);
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .sidebar-close-btn:hover {
    color: var(--accent);
  }

  .sidebar-tabs {
    display: flex;
    gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--border-light);
    background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
    overflow-x: auto;
  }

  .sidebar-tab-btn {
    padding: 6px 14px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--muted);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    border-radius: 4px;
    position: relative;
  }

  .sidebar-tab-btn:hover {
    color: var(--accent);
    border-color: rgba(var(--accent-rgb),0.3);
  }

  .sidebar-tab-btn.active {
    color: var(--accent);
    background: rgba(var(--accent-rgb),0.1);
    border-color: rgba(var(--accent-rgb),0.4);
  }

  .sidebar-tab-btn.active::after {
    content: '';
    position: absolute;
    bottom: -12px;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    box-shadow: 0 0 8px rgba(var(--accent-rgb),0.4);
  }

  .sidebar-tab-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    background: linear-gradient(180deg, rgba(255,255,255,0.01) 0%, transparent 100%);
  }

  .sidebar-content::-webkit-scrollbar {
    width: 6px;
  }

  .sidebar-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar-content::-webkit-scrollbar-thumb {
    background: rgba(var(--accent-rgb),0.2);
    border-radius: 3px;
  }

  .sidebar-content::-webkit-scrollbar-thumb:hover {
    background: rgba(var(--accent-rgb),0.4);
  }

  .upload-zone {
    text-align: center;
    background: rgba(var(--accent-rgb),0.03);
    border: 2px dashed rgba(var(--accent-rgb),0.3);
    border-radius: 8px;
    cursor: pointer;
    min-height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    transition: all 0.2s;
  }

  .upload-zone:hover {
    border-color: rgba(var(--accent-rgb),0.5);
    background: rgba(var(--accent-rgb),0.06);
  }

  .upload-icon {
    font-size: 32px;
    margin-bottom: 12px;
  }

  .upload-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 4px;
  }

  .upload-subtitle {
    font-size: 11px;
    color: var(--muted);
  }

  .upload-success {
    font-size: 12px;
    color: var(--accent);
    margin-top: 12px;
  }

  .section-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--accent);
    margin-bottom: 10px;
    margin-top: 18px;
    display: block;
  }

  .section-label:first-child {
    margin-top: 0;
  }

  .column-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .column-tag {
    padding: 6px 12px;
    background: rgba(58,58,66,0.5);
    color: var(--muted);
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    font-size: 11px;
    border: 1px solid transparent;
    transition: all 0.15s;
  }

  .column-tag:hover {
    background: rgba(58,58,66,0.7);
  }

  .column-tag.selected {
    background: rgba(var(--accent-rgb),0.2);
    color: var(--accent);
    border: 1px solid var(--accent);
  }

  .textarea-input {
    width: 100%;
    height: 240px;
    font-family: 'Cascadia Code','Fira Code','Consolas',monospace;
    font-size: 11px;
    padding: 12px;
    border: 1px solid rgba(58,58,66,0.5);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    resize: vertical;
    box-sizing: border-box;
    margin-bottom: 12px;
  }

  .textarea-input::placeholder {
    color: var(--muted);
  }

  .btn-parse {
    width: 100%;
    padding: 8px 16px;
    background: linear-gradient(135deg, var(--accent), #d4aa50);
    color: var(--bg);
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    transition: all 0.2s;
  }

  .btn-parse:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(var(--accent-rgb),0.3);
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 8px;
  }

  .type-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .type-field label {
    font-size: 10px;
    color: var(--muted);
    font-weight: 500;
  }

  .type-select {
    padding: 6px;
    background: var(--surface2);
    border: 1px solid rgba(var(--accent-rgb),0.3);
    border-radius: 4px;
    color: var(--text);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .type-select:hover {
    border-color: rgba(var(--accent-rgb),0.6);
  }

  .type-select:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 8px rgba(var(--accent-rgb),0.2);
  }

  .data-preview-table {
    width: 100%;
    font-size: 10px;
    border-collapse: collapse;
    background: var(--surface);
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid rgba(58,58,66,0.5);
  }

  .data-preview-table thead tr {
    background: var(--surface2);
    border-bottom: 1px solid rgba(58,58,66,0.5);
  }

  .data-preview-table th {
    padding: 8px;
    text-align: left;
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
  }

  .data-preview-table tbody tr {
    border-bottom: 1px solid rgba(58,58,66,0.3);
  }

  .data-preview-table tbody tr:nth-child(odd) {
    background: var(--surface);
  }

  .data-preview-table tbody tr:nth-child(even) {
    background: rgba(255,255,255,0.01);
  }

  .data-preview-table td {
    padding: 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
    color: var(--text);
  }

  .data-preview-table td.null {
    color: var(--muted);
  }

  .debug-log {
    background: var(--surface);
    border-top: 1px solid var(--border-light);
    padding: 12px 20px;
    max-height: 80px;
    overflow-y: auto;
    font-size: 9px;
    font-family: 'Cascadia Code','Fira Code','Consolas',monospace;
    color: var(--muted);
    line-height: 1.4;
  }

  .debug-log-entry {
    margin-bottom: 4px;
  }

  .debug-log-entry.success {
    color: rgba(76,175,80,0.8);
  }

  .debug-log-entry.error {
    color: rgba(244,67,54,0.8);
  }

  .debug-log-entry.progress {
    color: var(--accent);
    font-weight: 600;
  }

  .sidebar-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border-light);
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    background: linear-gradient(180deg, transparent, rgba(0,0,0,0.1));
  }

  .btn-secondary {
    padding: 8px 16px;
    background: rgba(58,58,66,0.4);
    color: var(--text);
    border: 1px solid rgba(58,58,66,0.7);
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: rgba(58,58,66,0.6);
    border-color: rgba(58,58,66,1);
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    padding: 8px 16px;
    background: linear-gradient(135deg, var(--accent), #d4aa50);
    color: var(--bg);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    transition: all 0.2s;
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(var(--accent-rgb),0.3);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0);
    z-index: 4999;
    animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`

export const SpreadsheetImportSidebar: React.FC<SpreadsheetImportSidebarProps> = ({
  visible = false,
  selectedTable = null,
  onImport = () => {},
  onClose = () => {},
}) => {
  const [tab, setTab] = useState<'upload' | 'paste' | 'preview'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [csvText, setCsvText] = useState('')
  const [parsedData, setParsedData] = useState<any>(null)
  const [selectedHeaders, setSelectedHeaders] = useState<Set<string>>(new Set())
  const [columnTypeMap, setColumnTypeMap] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [debugLog, setDebugLog] = useState<string[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const styleRef = useRef<HTMLStyleElement | null>(null)

  // Inject CSS
  useEffect(() => {
    if (!styleRef.current) {
      const style = document.createElement('style')
      style.textContent = SIDEBAR_STYLES
      document.head.appendChild(style)
      styleRef.current = style
    }
    return () => {
      if (styleRef.current) {
        styleRef.current.remove()
        styleRef.current = null
      }
    }
  }, [])

  const addLog = (msg: string) => {
    console.log('[SpreadsheetImport]', msg)
    setDebugLog((prev) => [...prev.slice(-9), msg])
  }

  const parseCSV = async (content: string) => {
    try {
      const fileSizeKB = content.length / 1024
      if (fileSizeKB > 10000) {
        addLog(`⚠️ Große Datei: ${Math.round(fileSizeKB / 1024)}MB`)
      }

      addLog('Parsing CSV mit Type-Inferenz...')

      const parsed = await parseSpreadsheetText({
        text: content,
        emptyStringAsNullHeaders: [],
      })

      if (!parsed.headers || parsed.headers.length === 0) {
        addLog('❌ CSV hat keine Spalten')
        alert('❌ CSV-Datei hat keine Spalten!')
        return null
      }

      if (parsed.rows.length === 0) {
        addLog('❌ CSV ist leer')
        alert('❌ CSV-Datei enthält keine Daten!')
        return null
      }

      addLog(`✓ CSV geparst: ${parsed.headers.length} Spalten, ${parsed.rows.length} Zeilen`)
      Object.entries(parsed.columnTypeMap).slice(0, 5).forEach(([col, type]) => {
        addLog(`  "${col}" → ${type}`)
      })

      return {
        headers: parsed.headers,
        rows: parsed.rows,
        columnTypeMap: parsed.columnTypeMap,
        errors: parsed.errors,
      }
    } catch (e) {
      addLog(`❌ Parse Error: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }
  }

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    setFile(f)
    addLog(`📁 Datei ausgewählt: ${f.name}`)

    const text = await f.text()
    const parsed = await parseCSV(text)
    if (parsed) {
      setParsedData(parsed)
      setColumnTypeMap(parsed.columnTypeMap)
      setSelectedHeaders(new Set(parsed.headers))
      setTab('preview')
    }
  }

  const handleParsePasted = async () => {
    if (!csvText.trim()) {
      alert('❌ Bitte CSV-Text eingeben!')
      return
    }
    const parsed = await parseCSV(csvText)
    if (parsed) {
      setParsedData(parsed)
      setColumnTypeMap(parsed.columnTypeMap)
      setSelectedHeaders(new Set(parsed.headers))
      setTab('preview')
    }
  }

  const handleToggleHeader = (h: string) => {
    const newSet = new Set(selectedHeaders)
    if (newSet.has(h)) {
      newSet.delete(h)
    } else {
      newSet.add(h)
    }
    setSelectedHeaders(newSet)
  }

  const handleColumnTypeChange = (col: string, type: string) => {
    setColumnTypeMap((prev) => ({ ...prev, [col]: type }))
  }

  const handleImport = async () => {
    if (selectedHeaders.size === 0) {
      alert('Bitte mindestens eine Spalte auswählen!')
      return
    }

    setImporting(true)
    addLog('═════════════════════════════════════════════════════════════════')
    addLog(`📤 IMPORT STARTET - ${new Date().toLocaleTimeString()}`)

    try {
      // Besserer Tabellennamen - aus Dateiname oder Zeit
      let tableName = 'imported_data'
      if (file) {
        tableName = file.name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/\.csv$/i, '').toLowerCase()
        if (!tableName) tableName = 'imported_data'
      }
      const normalizedTableName = tableName.split('_').slice(0, 20).join('_') // Limit auf 20 Teile

      const headers = Array.from(selectedHeaders)
      const types = headers.map((h: string) => columnTypeMap[h] || 'text')

      addLog(`📋 Spalten: ${headers.length} | Types: ${types.join(', ')}`)
      addLog(`📊 Zeilen: ${parsedData.rows.length} | Selektiert: ${selectedHeaders.size}`)

      const columnDefs = headers
        .map((h, i) => `"${h}" ${inferredTypeToPostgreSQLType(types[i])}`)
        .join(', ')

      const createTableSQL = `CREATE TABLE IF NOT EXISTS "${normalizedTableName}" (${columnDefs})`
      addLog(`✓ CREATE TABLE: ${normalizedTableName}`)
      
      // Nutze executeQuery mit Parameters (wurde gerade mit Parameter-Support erweitert!)
      await window.executeQuery?.(createTableSQL, [])

      let totalSuccessCount = 0
      let totalErrorCount = 0

      // Import in Batches von 100 Zeilen
      addLog(`🔄 Starte Import-Loop: ${parsedData.rows.length} Zeilen total`)
      
      for (let batchIdx = 0; batchIdx < parsedData.rows.length; batchIdx += 100) {
        const batchEnd = Math.min(batchIdx + 100, parsedData.rows.length)
        const batchRows = parsedData.rows.slice(batchIdx, batchEnd)

        addLog(`📦 Batch ${Math.floor(batchIdx / 100) + 1}: Verarbeite Zeilen ${batchIdx}-${batchEnd}`)

        // Flatten alle Werte aus dieser Batch
        const flatValues: any[] = []
        for (const row of batchRows) {
          for (const header of headers) {
            let value = row[header]
            
            // Wert-Konvertierung basierend auf Type
            const type = columnTypeMap[header] || 'text'
            if (value === null || value === undefined || value === '') {
              flatValues.push(null)
            } else if (type === 'float8' || type === 'numeric') {
              // German format: 30,42 → 30.42
              const normalized = String(value).replace(',', '.')
              flatValues.push(parseFloat(normalized) || null)
            } else if (type === 'int4' || type === 'int8') {
              flatValues.push(parseInt(String(value), 10) || null)
            } else if (type === 'bool') {
              const v = String(value).toLowerCase()
              flatValues.push(v === 'true' || v === '1' || v === 'ja' || v === 'yes')
            } else if (type === 'date' || type === 'timestamptz') {
              flatValues.push(value)
            } else {
              flatValues.push(value)
            }
          }
        }

        addLog(`📊 flatValues: ${flatValues.length} items für ${batchRows.length} Zeilen`)

        // Build INSERT SQL
        const placeholderRows = batchRows.map((_, rowIdx) =>
          `(${headers.map((_, colIdx) => `$${rowIdx * headers.length + colIdx + 1}`).join(',')})`
        )

        const insertSQL = `INSERT INTO "${normalizedTableName}" (${headers.map((h) => `"${h}"`).join(',')}) VALUES ${placeholderRows.join(',')}`

        try {
          addLog(`📤 Führe INSERT aus mit ${flatValues.length} Parametern...`)
          const result = await window.executeQuery?.(insertSQL, flatValues)
          addLog(`✓ INSERT erfolgreich: ${result ? JSON.stringify(result).substring(0, 50) : 'OK'}`)
          totalSuccessCount += batchRows.length
          setProgress(`${totalSuccessCount}/${parsedData.rows.length}`)
          addLog(`✓ Batch erfolgreich: +${batchRows.length} Zeilen (Total: ${totalSuccessCount})`)
        } catch (e) {
          totalErrorCount += batchRows.length
          const errorMsg = e instanceof Error ? e.message : String(e)
          addLog(`❌ Batch FEHLER: ${errorMsg.substring(0, 100)}`)
        }
      }

      addLog(`═════════════════════════════════════════════════════════════════`)
      addLog(`✅ IMPORT ABGESCHLOSSEN!`)
      addLog(`✓ Tabelle: ${normalizedTableName}`)
      addLog(`✓ Erfolgreich eingefügt: ${totalSuccessCount} Zeilen`)
      if (totalErrorCount > 0) addLog(`⚠️ Fehler: ${totalErrorCount} Zeilen`)

      onImport()
      setTimeout(() => onClose(), 1200)
    } catch (e) {
      addLog(`❌ KRITISCHER FEHLER: ${e instanceof Error ? e.message : String(e)}`)
      console.error('[SpreadsheetImport] Import Error:', e)
    } finally {
      setImporting(false)
    }
  }

  const typeOptions = ['text', 'int8', 'int4', 'float8', 'numeric', 'bool', 'date', 'timestamptz', 'uuid', 'jsonb']

  if (!visible) return null

  return (
    <>
      <div className="sidebar-overlay" onClick={onClose} />
      <div className="sidebar-import">
        {/* Header */}
        <div className="sidebar-header">
          <div>
            <h2 className="sidebar-header-title">📊 CSV-Import</h2>
            <div className="sidebar-header-subtitle">Intelligente Type-Erkennung</div>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={onClose}
            disabled={importing}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="sidebar-tabs">
          {(['upload', 'paste', 'preview'] as const).map((t) => (
            <button
              key={t}
              className={`sidebar-tab-btn ${tab === t ? 'active' : ''} ${t === 'preview' && !parsedData ? 'disabled' : ''}`}
              onClick={() => setTab(t)}
              disabled={t === 'preview' && !parsedData}
            >
              {t === 'upload' && '📁 Upload'}
              {t === 'paste' && '📝 Paste'}
              {t === 'preview' && '👁 Preview'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="sidebar-content">
          {tab === 'upload' && (
            <div
              className="upload-zone"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleUploadFile}
                style={{ display: 'none' }}
              />
              <div className="upload-icon">📁</div>
              <div className="upload-title">CSV-Datei hochladen</div>
              <div className="upload-subtitle">Oder klicken zum Auswählen</div>
              {file && <div className="upload-success">✓ {file.name}</div>}
            </div>
          )}

          {tab === 'paste' && (
            <div>
              <textarea
                className="textarea-input"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="CSV hier einfügen (Komma-Separator, mit Header)"
              />
              <button className="btn-parse" onClick={handleParsePasted}>
                📝 Parsen & Vorschau
              </button>
            </div>
          )}

          {tab === 'preview' && parsedData && (
            <div>
              {/* Column Selection */}
              <label className="section-label">📋 SPALTEN ({selectedHeaders.size}/{parsedData.headers.length})</label>
              <div className="column-tags">
                {parsedData.headers.map((h: string) => (
                  <label
                    key={h}
                    className={`column-tag ${selectedHeaders.has(h) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedHeaders.has(h)}
                      onChange={() => handleToggleHeader(h)}
                      style={{ marginRight: '5px' }}
                    />
                    {h}
                  </label>
                ))}
              </div>

              {/* Type Selection */}
              <label className="section-label">🔍 SPALTEN-TYPEN</label>
              <div className="type-grid">
                {parsedData.headers.map((h: string) => (
                  <div key={h} className="type-field">
                    <label>{h.slice(0, 15)}</label>
                    <select
                      className="type-select"
                      value={columnTypeMap[h] || 'text'}
                      onChange={(e) => handleColumnTypeChange(h, e.target.value)}
                    >
                      {typeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Data Preview */}
              <label className="section-label">👁 PREVIEW ({Math.min(5, parsedData.rows.length)} Zeilen)</label>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-preview-table">
                  <thead>
                    <tr>
                      {parsedData.headers.slice(0, 8).map((h: string) => (
                        <th key={h}>{h.slice(0, 12)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.rows.slice(0, 5).map((row: any, idx: number) => (
                      <tr key={idx}>
                        {parsedData.headers.slice(0, 8).map((h: string) => (
                          <td
                            key={h}
                            className={row[h] === null || row[h] === undefined || row[h] === '' ? 'null' : ''}
                          >
                            {row[h] === null || row[h] === undefined ? '(null)' : String(row[h]).slice(0, 30)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Debug Log */}
        <div className="debug-log">
          {debugLog.map((log, idx) => (
            <div
              key={idx}
              className={`debug-log-entry ${log.includes('✓') ? 'success' : log.includes('❌') ? 'error' : log.includes('📤') || log.includes('✅') || progress ? 'progress' : ''}`}
            >
              {log}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={importing}
          >
            Abbrechen
          </button>

          {tab === 'preview' && parsedData && (
            <button
              className="btn-primary"
              onClick={handleImport}
              disabled={importing || selectedHeaders.size === 0}
            >
              {importing ? `📤 ${progress}` : `✓ Import`}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default SpreadsheetImportSidebar
