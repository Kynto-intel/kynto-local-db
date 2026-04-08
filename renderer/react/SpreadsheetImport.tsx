/**
 * SpreadsheetImport - CSV Import Sidebar (wie storage.manager.html Design)
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

interface SpreadsheetImportProps {
  visible?: boolean
  selectedTable?: string | null
  onImport?: () => void
  onClose?: () => void
}

export const SpreadsheetImport: React.FC<SpreadsheetImportProps> = ({
  visible = false,
  selectedTable = null,
  onImport = () => {},
  onClose = () => {},
}) => {
  const [tab, setTab] = useState<'upload' | 'paste' | 'preview'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [csvText, setCsvText] = useState('')
  const [parsedData, setParsedData] = useState<any>(null)
  const [selectedHeaders, setSelectedHeaders] = useState<Set<string>>(new Set())
  const [columnTypeMap, setColumnTypeMap] = useState<Record<string, string>>({})
  const [treatEmptyAsNull, setTreatEmptyAsNull] = useState(true)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [debugLog, setDebugLog] = useState<string[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const addLog = (msg: string) => {
    console.log('[SpreadsheetImport]', msg)
    setDebugLog((prev) => [...prev.slice(-9), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  useEffect(() => {
    if (visible) {
      addLog('Sidebar öffnet...')
    }
  }, [visible])

  if (!visible) return null

  // ═════════════════════════════════════════════════════════════════════════════
  // Parse CSV
  // ═════════════════════════════════════════════════════════════════════════════
  const parseCSV = async (content: string) => {
    try {
      const fileSizeKB = content.length / 1024
      if (fileSizeKB > 10000) {
        addLog(`⚠️ Große Datei: ${Math.round(fileSizeKB / 1024)}MB - Import könnte langsam sein`)
      }

      addLog('Parsing CSV mit Type-Inferenz...')

      const parsed = await parseSpreadsheetText({
        text: content,
        emptyStringAsNullHeaders: [],
      })

      if (!parsed.headers || parsed.headers.length === 0) {
        addLog('❌ CSV hat keine Spalten')
        alert('❌ CSV-Datei hat keine Spalten/Header!')
        return null
      }

      if (parsed.rows.length === 0) {
        addLog('❌ CSV ist leer (0 Zeilen)')
        alert('❌ CSV-Datei enthält keine Daten!')
        return null
      }

      // Zeige erkannte Typen
      addLog(`✓ CSV geparst: ${parsed.headers.length} Spalten, ${parsed.rows.length} Zeilen`)
      Object.entries(parsed.columnTypeMap).forEach(([col, type]) => {
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
      alert(`❌ CSV Parse Fehler:\n${e instanceof Error ? e.message : String(e)}`)
      console.error('[SpreadsheetImport] Parse Error:', e)
      return null
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Handlers
  // ═════════════════════════════════════════════════════════════════════════════
  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) {
      addLog('❌ Keine Datei ausgewählt')
      return
    }

    if (!f.name.toLowerCase().endsWith('.csv')) {
      addLog(`❌ Nur .csv Dateien erlaubt (nicht ${f.name.split('.').pop()})`)
      alert('❌ Nur .csv Dateien werden unterstützt!')
      return
    }

    const fileSizeMB = f.size / (1024 * 1024)
    if (fileSizeMB > 10) {
      addLog(`⚠️ Datei ist sehr groß: ${fileSizeMB.toFixed(1)}MB`)
      const confirm = window.confirm(
        `⚠️ Datei ist ${fileSizeMB.toFixed(1)}MB - Import könnte langsam sein. Fortfahren?`
      )
      if (!confirm) {
        addLog('❌ Import abgebrochen')
        return
      }
    }

    addLog(`📄 Datei gewählt: ${f.name} (${Math.round(f.size / 1024)}KB)`)
    setFile(f)
    setFileName(f.name)

    const reader = new FileReader()
    reader.onerror = (err) => {
      addLog(`❌ Fehler beim Lesen der Datei`)
      alert(`❌ Fehler beim Lesen der Datei!`)
    }
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result as string
        if (!content) {
          addLog('❌ Dateiinhalt ist leer')
          alert('❌ Datei ist leer!')
          return
        }
        addLog('📖 Datei gelesen, parsing...')
        const parsed = await parseCSV(content)
        if (parsed) {
          setParsedData(parsed)
          setColumnTypeMap(parsed.columnTypeMap)
          setSelectedHeaders(new Set(parsed.headers))
          addLog(`✓ ${parsed.headers.length} Headers ausgewählt`)
          setTab('preview')
        }
      } catch (e) {
        addLog(`❌ Error: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    reader.readAsText(f)
  }

  const handleParsePasted = async () => {
    const trimmedText = csvText.trim()
    if (!trimmedText) {
      addLog('❌ Kein CSV-Text eingegeben')
      alert('❌ Bitte geben Sie CSV-Text ein!')
      return
    }

    const textSizeKB = trimmedText.length / 1024
    if (textSizeKB > 1000) {
      addLog(`⚠️ Großer Text: ${textSizeKB.toFixed(1)}KB`)
    }

    addLog(`📝 Parsing ${trimmedText.length} chars (${textSizeKB.toFixed(1)}KB)...`)
    try {
      const parsed = await parseCSV(trimmedText)
      if (parsed) {
        setParsedData(parsed)
        setColumnTypeMap(parsed.columnTypeMap)
        setSelectedHeaders(new Set(parsed.headers))
        addLog(`✓ ${parsed.headers.length} Headers ausgewählt`)
        setTab('preview')
      }
    } catch (e) {
      addLog(`❌ Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const handleToggleHeader = (header: string) => {
    const newSelected = new Set(selectedHeaders)
    if (newSelected.has(header)) {
      newSelected.delete(header)
      addLog(`⊘ Spalte abgewählt: ${header}`)
    } else {
      newSelected.add(header)
      addLog(`✓ Spalte gewählt: ${header}`)
    }
    setSelectedHeaders(newSelected)
  }

  const handleColumnTypeChange = (column: string, newType: string) => {
    setColumnTypeMap((prev) => ({
      ...prev,
      [column]: newType,
    }))
    addLog(`🔄 "${column}" Typ geändert zu: ${newType}`)
  }

  const handleImport = async () => {
    if (!parsedData) {
      addLog('❌ Keine CSV-Daten geladen')
      alert('Keine CSV-Daten geladen')
      return
    }

    if (selectedHeaders.size === 0) {
      addLog('❌ Keine Spalten gewählt')
      alert('Bitte mindestens eine Spalte auswählen')
      return
    }

    if (!window.executeQuery) {
      addLog('❌ executeQuery nicht verfügbar')
      alert('❌ Datenbankfunktion nicht verfügbar!')
      return
    }

    setImporting(true)
    setProgress('Starte Import...')

    try {
      const selectedHeadersArray = Array.from(selectedHeaders)
      const baseTableName = fileName ? fileName.replace(/\.csv$/i, '') : 'imported_table'

      const normalizedTableName = baseTableName
        .replace(/[^a-z0-9_]/gi, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase()

      addLog(`🚀 Import starten: ${parsedData.rows.length} Zeilen, ${selectedHeaders.size} Spalten`)
      addLog(`📝 Tabelle: ${normalizedTableName}`)

      // ═────────────────────────────────────────────────────────────────────────
      // CREATE TABLE mit echten Typen!
      // ═────────────────────────────────────────────────────────────────────────
      const columnDefs = selectedHeadersArray
        .map((header) => {
          const type = columnTypeMap[header] || 'text'
          const sqlType = inferredTypeToPostgreSQLType(type as any)
          return `"${header}" ${sqlType}`
        })
        .join(', ')

      const createTableSQL = `CREATE TABLE "public"."${normalizedTableName}" (${columnDefs})`

      addLog('📋 Erstelle Tabelle mit erkannten Typen...')
      console.log('[SpreadsheetImport] CREATE TABLE:', createTableSQL)
      setProgress('Erstelle Tabelle...')

      await window.executeQuery!(createTableSQL)
      addLog('✓ Tabelle erstellt')

      // ═────────────────────────────────────────────────────────────────────────
      // INSERT Batches
      // ═────────────────────────────────────────────────────────────────────────
      const batchSize = 500
      let successCount = 0
      let errorCount = 0

      for (let i = 0; i < parsedData.rows.length; i += batchSize) {
        const batch = parsedData.rows.slice(i, i + batchSize) as any[]
        const batchNum = Math.floor(i / batchSize) + 1
        const totalBatches = Math.ceil(parsedData.rows.length / batchSize)

        try {
          let insertSql = `INSERT INTO "public"."${normalizedTableName}" (${selectedHeadersArray
            .map((h) => `"${h}"`)
            .join(', ')}) VALUES `

          const values = (batch as any[])
            .map((row: any, rowIdx: number) => {
              try {
                const vals = selectedHeadersArray
                  .map((h: any) => {
                    const val = (row as any)[h as any]
                    if (val === null || val === undefined || val === '') return 'NULL'

                    const type = columnTypeMap[h] || 'text'

                    // Numeric types
                    if (type === 'int8' || type === 'int4') {
                      return String(parseInt(String(val), 10))
                    }
                    if (type === 'float8' || type === 'numeric') {
                      return String(parseFloat(String(val)))
                    }

                    // Boolean
                    if (type === 'bool') {
                      const boolVal = String(val).toLowerCase()
                      return ['true', 'yes', 'ja', '1', 'on'].includes(boolVal) ? 'true' : 'false'
                    }

                    // JSON
                    if (type === 'jsonb') {
                      const escaped = String(val).replace(/'/g, "''")
                      return `'${escaped}'::jsonb`
                    }

                    // Default: String
                    const escaped = String(val).replace(/'/g, "''")
                    return `'${escaped}'`
                  })
                  .join(', ')
                return `(${vals})`
              } catch (rowErr) {
                console.warn(`[SpreadsheetImport] Fehler in Zeile ${i + rowIdx}:`, rowErr)
                errorCount++
                return null
              }
            })
            .filter((v: any) => v !== null)

          if (values.length === 0) {
            addLog(`⚠️ Batch ${batchNum}: Keine gültigen Werte`)
            continue
          }

          insertSql += values.join(', ')

          await window.executeQuery!(insertSql)

          successCount += values.length
          addLog(`✓ Batch ${batchNum}/${totalBatches}: ${values.length} Zeilen`)
          setProgress(`Batch ${batchNum}/${totalBatches}...`)
        } catch (batchErr) {
          console.error(`[SpreadsheetImport] Fehler in Batch ${batchNum}:`, batchErr)
          errorCount += batch.length
          addLog(`⚠️ Batch ${batchNum} Fehler`)
        }
      }

      addLog(
        `═════════════════════════════════════════════════════════════════════════════`
      )
      addLog(`✅ IMPORT ABGESCHLOSSEN!`)
      addLog(`📝 Tabelle: ${normalizedTableName}`)
      addLog(`✓ Erfolgreich eingefügt: ${successCount}/${parsedData.rows.length} Zeilen`)
      if (errorCount > 0) addLog(`⚠️ Fehler: ${errorCount} Zeilen`)
      addLog(
        `═════════════════════════════════════════════════════════════════════════════`
      )

      setProgress('✅ Erfolgreich!')

      onImport()

      setTimeout(() => {
        onClose()
      }, 800)
    } catch (e) {
      addLog(`❌ Import Error: ${e instanceof Error ? e.message : String(e)}`)
      alert('Import Fehler: ' + (e instanceof Error ? e.message : String(e)))
      console.error('[SpreadsheetImport] Import Error:', e)
    } finally {
      setImporting(false)
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Render UI
  // ═════════════════════════════════════════════════════════════════════════════

  const typeOptions = ['text', 'int8', 'int4', 'float8', 'numeric', 'bool', 'date', 'timestamptz', 'uuid', 'jsonb']

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5000,
      }}
      onClick={onClose}
    >
      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90vw',
          maxWidth: '900px',
          maxHeight: '85vh',
          backgroundColor: '#1e1e1e',
          borderRadius: '10px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(194,154,64,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid rgba(194,154,64,0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: '#e8e8ee', fontSize: '16px', fontWeight: 700 }}>📊 CSV-Import</h2>
            <div style={{ fontSize: '11px', color: '#6b6b7e', marginTop: '4px' }}>
              Mit intelligenter Type-Erkennung (int8, float8, bool, timestamptz)
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: importing ? 'not-allowed' : 'pointer',
              color: '#6b6b7e',
              opacity: importing ? 0.5 : 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '2px',
            padding: '12px 20px',
            borderBottom: '1px solid rgba(58,58,66,0.5)',
            backgroundColor: 'rgba(0,0,0,0.2)',
          }}
        >
          {(['upload', 'paste', 'preview'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              disabled={t === 'preview' && !parsedData}
              style={{
                padding: '6px 14px',
                backgroundColor: tab === t ? 'rgba(194,154,64,0.15)' : 'transparent',
                color: tab === t ? '#c29a40' : '#6b6b7e',
                border: tab === t ? '1px solid rgba(194,154,64,0.4)' : '1px solid transparent',
                borderRadius: '4px',
                cursor: t === 'preview' && !parsedData ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: tab === t ? 600 : 400,
                transition: 'all 0.15s',
                opacity: t === 'preview' && !parsedData ? 0.4 : 1,
              }}
            >
              {t === 'upload' && '📁 Upload'}
              {t === 'paste' && '📝 Paste'}
              {t === 'preview' && '👁 Preview'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            minHeight: 0,
          }}
        >
          {/* Upload Tab */}
          {tab === 'upload' && (
            <div>
              <div
                style={{
                  textAlign: 'center',
                  backgroundColor: 'rgba(194,154,64,0.03)',
                  border: '2px dashed rgba(194,154,64,0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  minHeight: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  transition: 'all 0.2s',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleUploadFile}
                  style={{ display: 'none' }}
                />
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>📁</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#e8e8ee', marginBottom: '4px' }}>
                  CSV-Datei hochladen
                </div>
                <div style={{ fontSize: '12px', color: '#6b6b7e' }}>Oder klicken zum Auswählen</div>
                {file && <div style={{ marginTop: '12px', fontSize: '12px', color: '#c29a40' }}>✓ {file.name}</div>}
              </div>
            </div>
          )}

          {/* Paste Tab */}
          {tab === 'paste' && (
            <div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="CSV hier einfügen (Komma-Separator, mit Header)"
                style={{
                  width: '100%',
                  height: '300px',
                  fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace",
                  fontSize: '11px',
                  padding: '12px',
                  border: '1px solid rgba(58, 58, 66, 0.5)',
                  borderRadius: '6px',
                  backgroundColor: '#18181b',
                  color: '#e8e8ee',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={handleParsePasted}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #c29a40, #d4aa50)',
                  color: '#18181b',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                📝 Parsen & Vorschau
              </button>
            </div>
          )}

          {/* Preview Tab */}
          {tab === 'preview' && parsedData && (
            <div>
              {/* Column Selection */}
              <div style={{ marginBottom: '18px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: '#c29a40',
                    marginBottom: '10px',
                  }}
                >
                  📋 SPALTEN ({selectedHeaders.size}/{parsedData.headers.length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {parsedData.headers.map((h: string) => (
                    <label
                      key={h}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: selectedHeaders.has(h) ? 'rgba(194,154,64,0.2)' : 'rgba(58, 58, 66, 0.5)',
                        color: selectedHeaders.has(h) ? '#c29a40' : '#6b6b7e',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        fontSize: '11px',
                        border: selectedHeaders.has(h) ? '1px solid #c29a40' : '1px solid transparent',
                        transition: 'all 0.15s',
                      }}
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
              </div>

              {/* Type Selection */}
              <div style={{ marginBottom: '18px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: '#c29a40',
                    marginBottom: '10px',
                  }}
                >
                  🔍 SPALTEN-TYPEN (ERKANNT):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                  {parsedData.headers.map((h: string) => (
                    <div key={h} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#6b6b7e' }}>{h}</label>
                      <select
                        value={columnTypeMap[h] || 'text'}
                        onChange={(e) => handleColumnTypeChange(h, e.target.value)}
                        style={{
                          padding: '6px',
                          backgroundColor: '#2d2d2d',
                          border: '1px solid rgba(194,154,64,0.3)',
                          borderRadius: '4px',
                          color: '#e8e8ee',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
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
              </div>

              {/* Data Preview */}
              <div style={{ marginBottom: '14px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: '#c29a40',
                    marginBottom: '10px',
                  }}
                >
                  👁 PREVIEW ({Math.min(5, parsedData.rows.length)} von {parsedData.rows.length} Zeilen):
                </div>
                <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid rgba(58,58,66,0.5)' }}>
                  <table
                    style={{
                      width: '100%',
                      fontSize: '11px',
                      borderCollapse: 'collapse',
                      backgroundColor: '#18181b',
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#2d2d2d', borderBottom: '1px solid rgba(58,58,66,0.5)' }}>
                        {parsedData.headers.slice(0, 10).map((h: string) => (
                          <th
                            key={h}
                            style={{
                              padding: '8px',
                              textAlign: 'left',
                              fontWeight: 600,
                              color: '#c29a40',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.rows.slice(0, 5).map((row: any, idx: number) => (
                        <tr
                          key={idx}
                          style={{
                            backgroundColor: idx % 2 === 0 ? '#18181b' : '#1f1f23',
                            borderBottom: '1px solid rgba(58,58,66,0.3)',
                          }}
                        >
                          {parsedData.headers.slice(0, 10).map((h: string) => (
                            <td
                              key={h}
                              style={{
                                padding: '8px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '150px',
                                color: row[h] === null || row[h] === undefined || row[h] === '' ? '#6b6b7e' : '#e8e8ee',
                              }}
                            >
                              {row[h] === null || row[h] === undefined ? '(null)' : String(row[h]).slice(0, 50)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Debug Log */}
        <div
          style={{
            backgroundColor: '#18181b',
            borderTop: '1px solid rgba(58,58,66,0.5)',
            padding: '12px 20px',
            maxHeight: '100px',
            overflowY: 'auto',
            fontSize: '10px',
            fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace",
            color: '#6b6b7e',
          }}
        >
          {debugLog.map((log, idx) => (
            <div key={idx}>{log}</div>
          ))}
          {progress && (
            <div style={{ color: '#c29a40', fontWeight: 600 }}>
              {progress}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid rgba(58,58,66,0.5)',
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.2)',
          }}
        >
          <button
            onClick={onClose}
            disabled={importing}
            style={{
              padding: '8px 16px',
              backgroundColor: '#333',
              color: '#e8e8ee',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: importing ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              opacity: importing ? 0.5 : 1,
            }}
          >
            Abbrechen
          </button>

          {tab === 'preview' && parsedData && (
            <button
              onClick={handleImport}
              disabled={importing || selectedHeaders.size === 0}
              style={{
                padding: '8px 16px',
                background: importing || selectedHeaders.size === 0 ? '#666' : 'linear-gradient(135deg, #c29a40, #d4aa50)',
                color: importing || selectedHeaders.size === 0 ? '#999' : '#18181b',
                border: 'none',
                borderRadius: '4px',
                cursor: importing || selectedHeaders.size === 0 ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {importing ? `📤 Importiere... ${progress}` : `✓ Import (${parsedData.rows.length} Zeilen)`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SpreadsheetImport
