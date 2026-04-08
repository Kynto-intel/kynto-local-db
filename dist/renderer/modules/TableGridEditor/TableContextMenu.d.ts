export namespace TableContextMenu {
    let _menu: any;
    /** Initialisiert das Menü-Element im DOM */
    function init(): void;
    /** Öffnet das Menü an der Mausposition */
    function show(e: any, options?: {}): void;
    function close(): void;
}
