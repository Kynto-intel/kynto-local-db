export namespace tabRenderer {
    function init(): void;
    function render(): void;
    function escapeHtml(text: any): string;
    function updateTabTitle(id: any, newTitle: any): void;
    function switchTab(id: any): void;
}
