# TransactionTable component — Implementation details

This document describes how the TransactionTable component is currently implemented and how it handles data, rendering, and interactions. The description is limited to the component implementation as it exists in the codebase.

## Purpose / responsibility
The TransactionTable component is the UI component that renders a list of transactions in a table, provides row actions (edit, delete, note updates), and coordinates with the filtering controls (SearchFilterControls) to present the correct subset of transactions (paginated or infinite-scrolled) to the user.

## Public interface (props)
The component accepts these key props (names and shapes as used in the codebase):

- `transactions: FormattedTransaction[]`  
  The array of transactions provided by the parent. The component uses this as the source of truth for transaction data unless a control emits a filtered/paginated payload that it then uses for display.

- `onEdit?: (transactionId: string) => void`  
  Callback invoked when the user triggers the edit action for a row.

- `onDelete?: (transactionId: string) => void`  
  Callback invoked when the user triggers delete for a row.

- `onUpdateNote?: (transactionId: string, note: string) => Promise<void>`  
  Callback used to persist note edits (header or row controls call this when note changes).

- `className?: string`  
  Optional wrapper className passed into the table container.

(Other callbacks or props used in the code — pagination handlers, selection — are wired similarly where present.)

## Internal state
The component maintains local state for displaying and navigating the list:

- `filteredAndSortedTransactions` (internal array)  
  The component keeps an internal representation of transactions that it uses to compute visible rows. This state is derived from the incoming `transactions` prop and/or from payloads emitted by `SearchFilterControls`.

- `visiblePaginatedRows` (paginated slice)  
  The current slice of transactions to render in the table based on pagination or infinite-scroll position.

- `currentPage` and `itemsPerPage`  
  When explicit pagination is used, the component stores the current page and the items-per-page value. `SearchFilterControls` also manages itemsPerPage and page changes but emits page changes back to the table; the table uses emitted values to update visible rows.

- UI state variables (selection, expanded rows, loading flags, popover open state for per-row actions)  
  The component keeps standard UI state for row actions and presentation (which row is active, whether an edit modal is open, etc.).

## Lifecycle and data flow
1. Initial mount:
   - The parent passes `transactions` (may be empty initially while data loads).
   - The component initializes its internal state from `transactions`. The implementation includes a useEffect that responds to changes in the `transactions` prop and replaces the internal `filteredAndSortedTransactions` when `transactions` changes.

2. Filter/controls integration:
   - The component renders the `SearchFilterControls` component (the filtering UI) as part of the table header/controls area.
   - `SearchFilterControls` receives the full `transactions` (or categories list) and emits user-driven payloads through its `onChange` prop. That payload includes:
     - `filtered`: the full filtered & sorted array
     - `paginated`: the current page slice
     - `total`: total count after filtering
     - `currentPage`: current page number
     - `itemsPerPage`: current items per page
   - The TransactionTable implements a handler (commonly referred to as `handleControlsChange`) that receives that payload and updates:
     - internal `filteredAndSortedTransactions` to the `filtered` array
     - `visiblePaginatedRows` to the `paginated` array
     - `currentPage` and `itemsPerPage` to the emitted values
   - The component uses the emitted data as the authoritative display set so that filtering/sorting (performed by `SearchFilterControls`) drives the visible rows.

3. Parent-provided filtering (header search / external search)
   - The page header may host a separate search component (TransactionSearch) that emits filtered results up to the page. When the page passes those filtered results down as the `transactions` prop, the TransactionTable's prop-change effect updates internal state to reflect the newly supplied list.
   - The component therefore supports both: (a) filter control-driven updates via `SearchFilterControls` onChange; and (b) parent-driven updates when the `transactions` prop is replaced with a filtered list.

4. Pagination / infinite scroll
   - Pagination is coordinated between the controls component and the table. `SearchFilterControls` computes pages and emits the current slice; the table uses that slice to render rows.
   - For infinite scroll use cases, the table appends successive paginated slices (or requests the next slice via the same `handlePageChange` logic) and updates `visiblePaginatedRows` to include new rows as the user scrolls.

## Sorting
- Sorting is performed where filtering and sorting logic is centralised (in `SearchFilterControls`'s `filterAndSort` helper).  
- The TransactionTable consumes and displays transaction arrays already filtered and sorted. The table does not re-implement the sort algorithm; it relies on the order of the incoming array (either from the controls emitter or the parent).

## Row actions and updates
- Edit: invoking `onEdit` triggers the edit flow (modal or route navigation) implemented by the parent via the callback.
- Delete: invoking `onDelete` calls the provided callback to remove a transaction; the parent handles persistence and then supplies updated transactions back to the table.
- Update Note: the table provides inline note editing UIs that call `onUpdateNote(transactionId, note)`. `onUpdateNote` is an async prop that the parent implements; the table displays optimistic UI updates only if the parent updates the transactions prop accordingly.

## Rendering
- Column layout: the table renders the standard columns (Date, Description, Amount, Category, Status, Actions) as header cells, and maps `visiblePaginatedRows` to table rows.
- Empty states: when `visiblePaginatedRows` is empty, the table shows an empty state row. The parent handles loading states and may show skeletons instead of passing transactions.
- Row keys: rows are keyed by the transaction identifier so React can track updates and re-renders.

## Interaction summary
- User interacts with SearchFilterControls (filters, status, category, itemsPerPage, search) → SearchFilterControls computes filtered & paginated arrays → emits via `onChange` → TransactionTable `handleControlsChange` updates internal display state → table renders `paginated` slice.
- Parent-level search or other operations may replace `transactions` prop entirely → TransactionTable prop-change effect overwrites internal arrays → table renders new data.
- Row actions call parent callbacks; parent persists changes and re-supplies updated `transactions`.

## Notes on current implementation behavior
- The component treats the `SearchFilterControls` emitted payload as authoritative for filtering/sorting pagination when those controls are used.
- The component also updates its internal state in response to changes to the `transactions` prop, allowing parent-driven filtering (header search) to replace the display set.
- Pagination and infinite-scroll behavior are both supported; the table displays the current paginated slice and updates that slice in response to either control emissions or page navigation events.
