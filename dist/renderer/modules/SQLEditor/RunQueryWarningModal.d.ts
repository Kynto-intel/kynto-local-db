export class RunQueryWarningModal {
    constructor({ onConfirm, onCancel }: {
        onConfirm: any;
        onCancel: any;
    });
    onConfirm: any;
    onCancel: any;
    modalElement: HTMLDivElement;
    show(issues: any): void;
    hide(): void;
}
