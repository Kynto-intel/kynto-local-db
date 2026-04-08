import { createAskAIWidget } from './AskAIWidget.js';
import { monacoInstance } from '../editor.js'; // Importiere monacoInstance, um auf EditorOption.lineHeight zuzugreifen

/**
 * Verwaltet das Einblenden des AI Widgets direkt zwischen den Zeilen
 */
export class InlineAIController {
    constructor(editor) {
        this.editor = editor;
        // Target the modified editor if it's a DiffEditor (robuste Portierung aus TS)
        this.targetEditor = 'getModifiedEditor' in editor ? editor.getModifiedEditor() : editor;
        this.viewZoneId = null;
        this.overlayWidget = null;
        this.resizeObserver = null;
        this.layoutListener = null;
        this.viewZoneRef = { top: 0, height: 0 };
    }

    /**
     * Berechnet die Position und Breite des Widgets basierend auf dem aktuellen Editor-Layout.
     * Übernommen aus der robusten React-Implementierung für maximale Stabilität.
     */
    recalculateLayout(widget) {
        const layoutInfo = this.targetEditor.getLayoutInfo();
        if (!layoutInfo || !this.viewZoneRef) return;

        const domNode = widget.domNode;
        domNode.style.left = `${layoutInfo.contentLeft}px`;
        domNode.style.top = `${this.viewZoneRef.top}px`;
        // Exakte Berechnung für den sichtbaren Bereich (ohne horizontale Scrollweite)
        domNode.style.width = `${layoutInfo.width - layoutInfo.contentLeft - 20}px`;
        domNode.style.height = `${this.viewZoneRef.height}px`;
    }

    show(onResolve) {
        if (this.viewZoneId) this.hide();

        const selection = this.targetEditor?.getSelection();
        if (!selection) return;

        const model = this.targetEditor.getModel();
        const selectedText = model ? model.getValueInRange(selection) : '';
        const lineNumber = selection.endLineNumber;

        // Widget erstellen mit Kontext-Logik
        const widget = createAskAIWidget(
            (prompt) => {
                // Wenn Text markiert war, hängen wir ihn als Kontext an den Prompt an
                const finalPrompt = selectedText 
                    ? `Bearbeite diesen SQL Code:\n${selectedText}\n\nAnweisung: ${prompt}`
                    : prompt;
                onResolve(finalPrompt); 
                this.hide(); 
            },
            () => this.hide()
        );

        // Reagieren auf globale Layout-Änderungen des Editors (Resize, Sidebar etc.)
        this.layoutListener = this.targetEditor.onDidLayoutChange(() => this.recalculateLayout(widget));

        // Hilfsfunktion für die ViewZone-Konfiguration (DRY)
        const getZoneConfig = (heightInLines) => ({
            afterLineNumber: lineNumber,
            heightInLines: heightInLines,
            domNode: document.createElement('div'),
            onDomNodeTop: (top) => {
                this.viewZoneRef.top = top;
                this.recalculateLayout(widget);
            },
            onComputedHeight: (height) => {
                this.viewZoneRef.height = height;
                this.recalculateLayout(widget);
            }
        });

        // 1. Initialer Block: ViewZone mit Standardhöhe erstellen
        this.targetEditor.changeViewZones((accessor) => {
            this.viewZoneId = accessor.addZone(getZoneConfig(5));
        });

        // 2. Dynamische Höhenanpassung:
        // Wir beobachten das Widget-Element. Wenn es wächst (z.B. durch Text-Eingabe),
        // passen wir die ViewZone im Editor an.
        this.resizeObserver = new ResizeObserver(() => {
            if (!this.viewZoneId) return;
            
            const lineHeight = this.targetEditor.getOption(monacoInstance.editor.EditorOption.lineHeight);
            const height = widget.domNode.offsetHeight;
            const newLines = Math.ceil(height / lineHeight);

            this.targetEditor.changeViewZones((accessor) => {
                accessor.removeZone(this.viewZoneId);
                this.viewZoneId = accessor.addZone(getZoneConfig(newLines));
            });
        });
        this.resizeObserver.observe(widget.domNode);

        this.overlayWidget = {
            getId: () => 'ai.inline.widget',
            getDomNode: () => widget.domNode,
            getPosition: () => null
        };

        this.targetEditor.addOverlayWidget(this.overlayWidget);
        widget.focus();

        // Sicherstellen, dass die Zeile im sichtbaren Bereich ist
        this.targetEditor.revealLine(lineNumber);
    }

    hide() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.layoutListener) {
            this.layoutListener.dispose();
            this.layoutListener = null;
        }

        if (this.viewZoneId || this.overlayWidget) {
            const zoneId = this.viewZoneId;
            const widget = this.overlayWidget;
            
            this.viewZoneId = null;
            this.overlayWidget = null;

            // Zusammengefasstes Unmounting in einem Layout-Zyklus
            this.targetEditor.changeViewZones((accessor) => {
                if (zoneId) accessor.removeZone(zoneId);
                if (widget) this.targetEditor.removeOverlayWidget(widget);
            });
        }

        this.targetEditor.focus(); // Fokus zurück zum Editor geben
    }
}