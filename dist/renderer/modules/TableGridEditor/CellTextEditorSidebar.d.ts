export namespace CellTextEditorSidebar {
    let isOpen: boolean;
    let _el: any;
    let _context: any;
    function _init(): void;
    function open(td: any, ri: any, col: any, val: any): void;
    function close(): void;
    function save(): Promise<void>;
}
