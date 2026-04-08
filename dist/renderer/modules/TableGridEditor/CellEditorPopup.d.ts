export namespace CellEditorPopup {
    let _el: any;
    let _targetTd: any;
    let _context: any;
    /** Initialisiert das Popup im DOM */
    function _init(): void;
    /** Öffnet das Popup an der Zelle */
    function open(td: any, ri: any, col: any, val: any): void;
    function save(): Promise<void>;
    function setNull(): Promise<void>;
    function expand(): void;
    function close(): void;
}
