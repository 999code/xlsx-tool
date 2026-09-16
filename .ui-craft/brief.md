# 1. Product purpose

Use an `.xlsx` workbook as a small, inspectable data store with browser-based record management and JSON APIs.

# 2. Primary user

An operator maintaining structured Excel records on a desktop or laptop during short, repeated work sessions.

# 3. Principles

1. **The table is the product.** Data and row actions take priority over decoration.
2. **Make file state visible.** The active workbook, sheet, row count, and save result must always be clear.
3. **Prevent accidental loss.** Destructive actions require confirmation and failed writes never masquerade as success.
4. **Stay schema-flexible.** The interface adapts to workbook sheets and headers instead of hard-coding one data model.

# 4. Success metric for the surface

The user can find, add, edit, delete, and inspect a record as JSON without opening Excel or learning an API client.

# 5. Out of scope

- Does not edit workbook formatting, charts, merged cells, or formulas as a spreadsheet authoring tool.
- Does not support simultaneous multi-user conflict resolution across multiple server processes.
- Does not provide authentication or role-based permissions.
- Does not replace a transactional database for high-volume workloads.

# 6. Learned constraints

- In the XLSX table toolbar, keep workbook actions and JSON inspection grouped on the left; isolate “刷新数据” on the far right so refresh remains visually distinct.
- Always reserve a dedicated footer row for table pagination; the table body may scroll, but pagination must remain visible within the data panel.
