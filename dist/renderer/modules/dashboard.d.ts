export function setDashboardTableCallback(fn: any): void;
export namespace KyntoDashboard {
    function render(container: any, showAll?: boolean): Promise<void>;
    function renderAllDatabases(container: any): Promise<void>;
}
