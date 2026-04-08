export default ForeignRowSelector;
/**
 * ForeignRowSelector - Vereinfachte React-Komponente für die Auswahl von Foreign Key Rows
 * Mit Pagination, Suche und Filterung
 */
declare function ForeignRowSelector({ visible, foreignKey, tableName, columnName, selectedValue, onSelect, onClose }: {
    visible?: boolean;
    foreignKey?: any;
    tableName?: any;
    columnName?: any;
    selectedValue?: any;
    onSelect?: () => void;
    onClose?: () => void;
}): any;
