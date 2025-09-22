# Transaction Management System

## Overview

The transaction management system provides a comprehensive interface for viewing, editing, filtering, and managing financial transactions. It integrates CSV upload functionality, real-time search, advanced filtering, and manual transaction editing capabilities.

## Key Components

### Transaction Table (`TransactionTable.tsx`)

The enhanced transaction table is the core component for displaying transactions with:

- **Infinite Scroll Pagination**: Loads more transactions as user scrolls
- **Real-time Search**: Instant filtering as user types
- **Sort & Filter**: Multi-column sorting and advanced filter integration
- **Inline Editing**: Click-to-edit transaction details
- **Bulk Operations**: Select multiple transactions for batch actions

**Component Location**: `src/components/private/transactions/enhanced_table/`

**Key Features**:

```typescript
interface TransactionTableProps {
  transactions: FormattedTransaction[];
  onEdit: (transaction: FormattedTransaction) => void;
  onDelete: (transactionId: string) => void;
  loading?: boolean;
  searchQuery?: string;
}
```

### CSV Upload System (`CSVUploader.tsx`)

Complete CSV processing workflow with:

- **File Upload**: Drag-and-drop or click-to-upload interface
- **Column Mapping**: Intelligent mapping of CSV columns to transaction fields
- **Preview & Validation**: Preview parsed data before processing
- **Batch Processing**: Send processed transactions to backend

**Component Location**: `src/components/private/csv-uploader/`

**Upload Flow**:

1. User selects CSV file
2. System parses and displays column mapping interface
3. User maps CSV columns to required transaction fields
4. System validates and shows preview
5. User confirms and submits for processing
6. Backend processes and returns enriched transactions

### Search & Filter System

#### Transaction Search (`TransactionSearch.tsx`)

Lightweight header search component:

```typescript
interface TransactionSearchProps {
  transactions: FormattedTransaction[];
  onFilteredChange: (filtered: FormattedTransaction[]) => void;
  placeholder?: string;
}
```

**Search Capabilities**:

- Real-time search across descriptions, merchants, and categories
- Case-insensitive matching
- Instant results with debounced input
- Clear/reset functionality

#### Advanced Filter Panel (`AdvancedFilterPanel.tsx`)

Comprehensive filtering interface with:

- **Category Filtering**: Multi-select category checkboxes with icons
- **Merchant Filtering**: Multi-select merchant list
- **Amount Filtering**: Min/max range with type filters (debits/credits)
- **Date Range Filtering**: From/to date selection
- **Status Filtering**: Categorized, uncategorized, needs review

**Filter State Management**:

```typescript
interface FilterState {
  categories: string[];
  merchants: string[];
  amountRange: { min?: number; max?: number };
  dateRange: { from?: string; to?: string };
  onlyUncategorized: boolean;
  onlyNeedsReview: boolean;
  searchQuery: string;
}
```

### Transaction Editing

#### Transaction Drawer (`TransactionDrawer.tsx`)

Side panel for detailed transaction editing:

- **Merchant Management**: Search, select, or create merchants
- **Category Assignment**: Category tree picker with search
- **Description Editing**: Modify transaction descriptions
- **Manual Override**: Mark transactions as manually edited
- **Audit Trail**: Track editing history and changes

**Edit Operations**:

- PATCH `/transactions/{id}` for atomic updates
- Optimistic UI updates with rollback on failure
- Real-time validation and error handling
- Automatic save indicators

## Data Flow

### Transaction Loading

```
Page Load → API Call → Format Data → Set State → Render Table
     ↓
Search/Filter → Local Processing → Update Filtered State → Re-render
```

### CSV Upload Flow

```
File Selection → Parse CSV → Column Mapping → Preview → Backend Processing → Enrich Data → Update UI
```

### Transaction Editing Flow

```
Click Edit → Open Drawer → Modify Fields → Validate → API Call → Update State → Close Drawer
```

## API Integration

### Frontend API Routes (`src/app/api/transactions/`)

Next.js API routes that proxy to backend:

- **GET `/api/transactions`**: Fetch user transactions with filtering
- **PATCH `/api/transactions/[id]`**: Update individual transaction
- **POST `/api/transactions/upload`**: Process CSV uploads
- **DELETE `/api/transactions/[id]`**: Delete transaction

### Data Formatting

The `formatApiDataForUI` utility converts backend API responses to frontend-friendly format:

```typescript
function formatApiDataForUI(apiData: ApiTransaction[]): FormattedTransaction[] {
  return apiData.map((transaction) => ({
    id: transaction.id,
    date: transaction.date,
    description: transaction.description,
    amount: transaction.amount,
    merchantName: transaction.merchant_name,
    categoryName: transaction.category_name,
    categoryIcon: transaction.category_icon,
    needsReview: transaction.needs_review,
    manualEdit: transaction.manual_edit,
    // ... other mappings
  }));
}
```

## State Management

### Page-Level State (`src/app/private/transactions/page.tsx`)

```typescript
const [transactions, setTransactions] = useState<FormattedTransaction[]>([]);
const [filteredTransactions, setFilteredTransactions] = useState<
  FormattedTransaction[]
>([]);
const [loading, setLoading] = useState(true);
const [selectedTransaction, setSelectedTransaction] =
  useState<FormattedTransaction | null>(null);
```

### Component State Management

- **Search state**: Managed by search components, bubbled up via callbacks
- **Filter state**: Managed by filter panel, applied to transaction list
- **Edit state**: Managed by drawer component, synchronized with main list
- **Upload state**: Managed by CSV uploader, triggers main list refresh

## Performance Optimizations

### Infinite Scroll Implementation

```typescript
const useInfiniteScroll = (transactions: FormattedTransaction[]) => {
  const [displayedTransactions, setDisplayedTransactions] = useState<
    FormattedTransaction[]
  >([]);
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  // Load more items when user scrolls near bottom
  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    const endIndex = nextPage * itemsPerPage;
    setDisplayedTransactions(transactions.slice(0, endIndex));
    setPage(nextPage);
  }, [transactions, page]);

  return {
    displayedTransactions,
    loadMore,
    hasMore: displayedTransactions.length < transactions.length,
  };
};
```

### Search Optimization

- Debounced search input (300ms delay)
- Memoized filter functions
- Virtual scrolling for large datasets
- Cached search results

### Memory Management

- Cleanup effect listeners on component unmount
- Lazy loading of transaction details
- Efficient re-rendering with React.memo and useMemo

## Error Handling

### User-Facing Errors

- **Upload Errors**: Invalid CSV format, missing columns, processing failures
- **Edit Errors**: Validation failures, network errors, permission issues
- **Search Errors**: Invalid filter criteria, API failures

### Error Recovery

- Optimistic updates with rollback
- Retry mechanisms for failed API calls
- Graceful degradation when features unavailable
- User-friendly error messages with actionable advice

## Testing Considerations

### Component Testing

- Mock API responses for consistent testing
- Test user interactions (search, filter, edit)
- Verify state updates and side effects
- Test error scenarios and edge cases

### Integration Testing

- End-to-end CSV upload flow
- Transaction editing workflow
- Search and filter combinations
- Performance under load

## Future Enhancements

### Planned Features

- **Bulk Edit**: Select multiple transactions for batch editing
- **Export Options**: CSV, PDF, Excel export with custom filters
- **Transaction Templates**: Save common transaction patterns
- **Advanced Analytics**: In-line charts and spending insights

### Performance Improvements

- **Virtual Scrolling**: Handle 10k+ transactions efficiently
- **Server-Side Filtering**: Move complex filters to backend
- **Caching Strategy**: Implement sophisticated caching for frequent queries
- **Progressive Loading**: Load transaction details on demand

## Related Documentation

- [User Rules Management](./user-rules.md) - Custom categorization rules
- [Analytics Dashboard](./analytics.md) - Transaction analytics and insights
- [API Integration](../architecture/api-integration.md) - Backend integration patterns
- [Transaction Processing API](../../python/docs/core-apis/transaction-processing.md) - Backend processing

---

_Updated: September 1, 2025_
