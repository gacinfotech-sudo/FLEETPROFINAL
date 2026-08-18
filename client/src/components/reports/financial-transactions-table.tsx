"use client"

import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { Badge } from '@/components/ui/badge'
import { AnalyticsDrilldownDrawer } from '@/components/reports/analytics-drilldown-drawer'
import { cn } from '@/lib/utils'

/**
 * Financial Transaction type definition
 */
export interface FinancialTransaction {
  id: string
  date: string // ISO date format
  bookingId: string
  customerName: string
  vehicleName: string
  type: 'Booking' | 'Expense'
  revenue: number
  expense: number
  collected: number
  pending: number
  net: number
  status: 'Completed' | 'Pending' | 'Cancelled'
  // Additional optional fields for drawer
  bookingDetails?: {
    customerPhone?: string
    vehicleType?: string
    location?: string
    durationDays?: number
  }
}

/**
 * Props for FinancialTransactionsTable component
 */
export interface FinancialTransactionsTableProps {
  /**
   * Array of financial transactions to display
   */
  transactions: FinancialTransaction[]

  /**
   * Whether data is currently loading
   */
  isLoading?: boolean

  /**
   * Callback when a row is clicked, passing the transaction
   */
  onRowClick?: (transaction: FinancialTransaction) => void

  /**
   * Additional CSS classes to apply to the table container
   */
  className?: string
}

/**
 * Sort configuration type
 */
type SortKey = 'date' | 'bookingId' | 'customerName' | 'vehicleName' | 'revenue' | 'net' | 'status'

type SortDirection = 'asc' | 'desc' | null

interface SortState {
  key: SortKey | null
  direction: SortDirection
}

/**
 * FinancialTransactionsTable Component
 *
 * A comprehensive financial transactions table with:
 * - Search functionality (customer, booking ID, vehicle)
 * - Filter dropdowns (status, type, date range)
 * - Sortable columns (click header to sort)
 * - Pagination (10/25/50 rows per page)
 * - Row click to view details
 * - Theme-aware styling
 * - Responsive design
 * - Loading skeleton
 * - Empty state handling
 */
export const FinancialTransactionsTable = React.forwardRef<
  HTMLDivElement,
  FinancialTransactionsTableProps
>(
  (
    {
      transactions = [],
      isLoading = false,
      onRowClick,
      className,
    },
    ref
  ) => {
    // Filter and search state
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [typeFilter, setTypeFilter] = useState<string>('')
    const [dateRangeFilter, setDateRangeFilter] = useState<string>('all')

    // Sorting state
    const [sortState, setSortState] = useState<SortState>({
      key: null,
      direction: null,
    })

    // Pagination state
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [currentPage, setCurrentPage] = useState(1)

    // Drawer state for row details
    const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    /**
     * Get date range based on filter selection
     */
    const getDateRangeFilter = (filterType: string): [Date, Date] | null => {
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfToday = new Date(startOfToday)
      endOfToday.setHours(23, 59, 59, 999)

      switch (filterType) {
        case 'today':
          return [startOfToday, endOfToday]
        case 'week': {
          const weekStart = new Date(now)
          weekStart.setDate(weekStart.getDate() - 7)
          weekStart.setHours(0, 0, 0, 0)
          return [weekStart, now]
        }
        case 'month': {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
          return [monthStart, monthEnd]
        }
        case 'quarter': {
          const quarterMonth = Math.floor(now.getMonth() / 3) * 3
          const quarterStart = new Date(now.getFullYear(), quarterMonth, 1)
          const quarterEnd = new Date(now.getFullYear(), quarterMonth + 3, 0, 23, 59, 59, 999)
          return [quarterStart, quarterEnd]
        }
        case 'year': {
          const yearStart = new Date(now.getFullYear(), 0, 1)
          const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
          return [yearStart, yearEnd]
        }
        default:
          return null
      }
    }

    /**
     * Filter transactions based on search and filter criteria
     */
    const filteredTransactions = useMemo(() => {
      return transactions.filter((transaction) => {
        // Search filter: customer name, booking ID, vehicle name
        const searchLower = searchQuery.toLowerCase()
        const matchesSearch =
          searchLower === '' ||
          transaction.customerName.toLowerCase().includes(searchLower) ||
          transaction.bookingId.toLowerCase().includes(searchLower) ||
          transaction.vehicleName.toLowerCase().includes(searchLower)

        // Status filter
        const matchesStatus =
          statusFilter === '' || transaction.status === statusFilter

        // Type filter
        const matchesType = typeFilter === '' || transaction.type === typeFilter

        // Date range filter
        let matchesDateRange = true
        if (dateRangeFilter !== 'all') {
          const dateRange = getDateRangeFilter(dateRangeFilter)
          if (dateRange) {
            const [start, end] = dateRange
            const transactionDate = new Date(transaction.date)
            matchesDateRange = transactionDate >= start && transactionDate <= end
          }
        }

        return matchesSearch && matchesStatus && matchesType && matchesDateRange
      })
    }, [transactions, searchQuery, statusFilter, typeFilter, dateRangeFilter])

    /**
     * Sort and paginate transactions
     */
    const sortedTransactions = useMemo(() => {
      const sorted = [...filteredTransactions]

      if (sortState.key && sortState.direction) {
        sorted.sort((a, b) => {
          let aVal: any = a[sortState.key!]
          let bVal: any = b[sortState.key!]

          // Handle date comparison
          if (sortState.key === 'date') {
            aVal = new Date(a.date).getTime()
            bVal = new Date(b.date).getTime()
          }

          // Handle string comparison (case-insensitive)
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            aVal = aVal.toLowerCase()
            bVal = bVal.toLowerCase()
          }

          if (sortState.direction === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
          } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
          }
        })
      }

      return sorted
    }, [filteredTransactions, sortState])

    /**
     * Paginate sorted transactions
     */
    const paginatedTransactions = useMemo(() => {
      const startIndex = (currentPage - 1) * rowsPerPage
      const endIndex = startIndex + rowsPerPage
      return sortedTransactions.slice(startIndex, endIndex)
    }, [sortedTransactions, currentPage, rowsPerPage])

    /**
     * Calculate total pages
     */
    const totalPages = Math.ceil(sortedTransactions.length / rowsPerPage)

    /**
     * Handle sort column click
     */
    const handleSort = (key: SortKey) => {
      setSortState((prev) => {
        if (prev.key === key) {
          // Cycle through: asc -> desc -> null
          if (prev.direction === 'asc') {
            return { key, direction: 'desc' }
          } else if (prev.direction === 'desc') {
            return { key: null, direction: null }
          }
        }
        return { key, direction: 'asc' }
      })
      // Reset to first page when sorting changes
      setCurrentPage(1)
    }

    /**
     * Get sort indicator for column header
     */
    const getSortIndicator = (key: SortKey): React.ReactNode => {
      if (sortState.key !== key) return null

      return sortState.direction === 'asc' ? (
        <ChevronUp className="inline h-4 w-4 ml-1" />
      ) : (
        <ChevronDown className="inline h-4 w-4 ml-1" />
      )
    }

    /**
     * Format currency with rupee symbol
     */
    const formatCurrency = (amount: number): string => {
      return `₹ ${amount.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`
    }

    /**
     * Format date for display
     */
    const formatDate = (dateString: string): string => {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    }

    /**
     * Get status badge variant
     */
    const getStatusVariant = (status: string) => {
      switch (status) {
        case 'Completed':
          return 'default'
        case 'Pending':
          return 'secondary'
        case 'Cancelled':
          return 'destructive'
        default:
          return 'outline'
      }
    }

    /**
     * Handle row click to open drawer
     */
    const handleRowClick = (transaction: FinancialTransaction) => {
      setSelectedTransaction(transaction)
      setIsDrawerOpen(true)
      if (onRowClick) {
        onRowClick(transaction)
      }
    }

    /**
     * Handle drawer close
     */
    const handleDrawerClose = () => {
      setIsDrawerOpen(false)
      setTimeout(() => setSelectedTransaction(null), 300) // Wait for animation
    }

    /**
     * Reset filters
     */
    const handleResetFilters = () => {
      setSearchQuery('')
      setStatusFilter('')
      setTypeFilter('')
      setDateRangeFilter('all')
      setSortState({ key: null, direction: null })
      setCurrentPage(1)
    }

    /**
     * Handle rows per page change
     */
    const handleRowsPerPageChange = (value: string) => {
      setRowsPerPage(Number(value))
      setCurrentPage(1)
    }

    // Loading skeleton
    if (isLoading) {
      return (
        <div ref={ref} className={cn('w-full space-y-4', className)}>
          <div className="animate-pulse space-y-2">
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
            <div className="space-y-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          </div>
        </div>
      )
    }

    // Empty state
    if (transactions.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            'w-full flex flex-col items-center justify-center py-12 px-4',
            className
          )}
          style={{ backgroundColor: 'var(--surface)' }}
        >
          <div
            className="text-center space-y-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            <p className="text-sm font-medium">No transactions for this period</p>
            <p className="text-xs">
              Adjust your date range or filters to see more results
            </p>
          </div>
        </div>
      )
    }

    // Filtered empty state
    if (filteredTransactions.length === 0) {
      return (
        <div
          ref={ref}
          className={cn('w-full space-y-4', className)}
          style={{ backgroundColor: 'var(--surface)' }}
        >
          {/* Filters Section */}
          <div className="space-y-4 p-4 border rounded-lg" style={{ borderColor: 'var(--border)' }}>
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer, booking ID, or vehicle..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10"
              />
            </div>

            {/* Filter Dropdowns Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="Booking">Booking</SelectItem>
                  <SelectItem value="Expense">Expense</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
              >
                Reset Filters
              </Button>
            </div>
          </div>

          {/* No Results Message */}
          <div
            className="flex flex-col items-center justify-center py-12 px-4 rounded-lg"
            style={{ backgroundColor: 'var(--surface-hover)' }}
          >
            <div
              className="text-center space-y-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              <p className="text-sm font-medium">No transactions found</p>
              <p className="text-xs">
                Try adjusting your search query or filters
              </p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn('w-full space-y-4', className)}
        style={{ backgroundColor: 'var(--surface)' }}
      >
        {/* Filters Section */}
        <div className="space-y-4 p-4 border rounded-lg" style={{ borderColor: 'var(--border)' }}>
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer, booking ID, or vehicle..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-10"
            />
          </div>

          {/* Filter Dropdowns Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                <SelectItem value="Booking">Booking</SelectItem>
                <SelectItem value="Expense">Expense</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
            >
              Reset Filters
            </Button>
          </div>
        </div>

        {/* Results Count */}
        <div
          className="text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          Showing {paginatedTransactions.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to{' '}
          {Math.min(currentPage * rowsPerPage, sortedTransactions.length)} of{' '}
          {sortedTransactions.length} transactions
        </div>

        {/* Table Container - Responsive with horizontal scroll on mobile */}
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          <Table>
            <TableHeader style={{ backgroundColor: 'var(--surface-hover)' }}>
              <TableRow style={{ borderColor: 'var(--border)' }}>
                <TableHead
                  className="cursor-pointer hover:bg-muted select-none whitespace-nowrap"
                  onClick={() => handleSort('date')}
                  style={{ color: 'var(--text-primary)' }}
                >
                  Date {getSortIndicator('date')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted select-none whitespace-nowrap"
                  onClick={() => handleSort('bookingId')}
                  style={{ color: 'var(--text-primary)' }}
                >
                  Booking ID {getSortIndicator('bookingId')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted select-none whitespace-nowrap"
                  onClick={() => handleSort('customerName')}
                  style={{ color: 'var(--text-primary)' }}
                >
                  Customer {getSortIndicator('customerName')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted select-none whitespace-nowrap"
                  onClick={() => handleSort('vehicleName')}
                  style={{ color: 'var(--text-primary)' }}
                >
                  Vehicle {getSortIndicator('vehicleName')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted select-none whitespace-nowrap"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Type
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted select-none text-right whitespace-nowrap"
                  onClick={() => handleSort('revenue')}
                  style={{ color: 'var(--text-primary)' }}
                >
                  Revenue {getSortIndicator('revenue')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted select-none text-right whitespace-nowrap"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Expense
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted select-none text-right whitespace-nowrap"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Collected
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted select-none text-right whitespace-nowrap"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Pending
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted select-none text-right whitespace-nowrap"
                  onClick={() => handleSort('net')}
                  style={{ color: 'var(--text-primary)' }}
                >
                  Net {getSortIndicator('net')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted select-none whitespace-nowrap"
                  onClick={() => handleSort('status')}
                  style={{ color: 'var(--text-primary)' }}
                >
                  Status {getSortIndicator('status')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransactions.map((transaction, index) => (
                <TableRow
                  key={transaction.id}
                  onClick={() => handleRowClick(transaction)}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  style={{
                    backgroundColor:
                      index % 2 === 0 ? 'var(--surface)' : 'var(--surface-hover)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <TableCell
                    className="whitespace-nowrap"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {formatDate(transaction.date)}
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {transaction.bookingId}
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {transaction.customerName}
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {transaction.vehicleName}
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {transaction.type}
                  </TableCell>
                  <TableCell
                    className="text-right whitespace-nowrap"
                    style={{
                      color: transaction.revenue > 0 ? 'var(--success)' : 'var(--text-primary)',
                      fontWeight: transaction.revenue > 0 ? '600' : 'normal',
                    }}
                  >
                    {formatCurrency(transaction.revenue)}
                  </TableCell>
                  <TableCell
                    className="text-right whitespace-nowrap"
                    style={{
                      color: transaction.expense > 0 ? 'var(--danger)' : 'var(--text-primary)',
                      fontWeight: transaction.expense > 0 ? '600' : 'normal',
                    }}
                  >
                    {formatCurrency(transaction.expense)}
                  </TableCell>
                  <TableCell
                    className="text-right whitespace-nowrap"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {formatCurrency(transaction.collected)}
                  </TableCell>
                  <TableCell
                    className="text-right whitespace-nowrap"
                    style={{
                      color: transaction.pending > 0 ? 'var(--warning)' : 'var(--text-primary)',
                    }}
                  >
                    {formatCurrency(transaction.pending)}
                  </TableCell>
                  <TableCell
                    className="text-right whitespace-nowrap font-semibold"
                    style={{
                      color: transaction.net > 0 ? 'var(--success)' : 'var(--danger)',
                    }}
                  >
                    {formatCurrency(transaction.net)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={getStatusVariant(transaction.status)}>
                      {transaction.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
          {/* Rows per page selector */}
          <div className="flex items-center gap-2">
            <span
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              Rows per page:
            </span>
            <Select value={String(rowsPerPage)} onValueChange={handleRowsPerPageChange}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pagination Info */}
          <div
            className="text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            Page {currentPage} of {totalPages}
          </div>

          {/* Pagination Navigation */}
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage > 1) setCurrentPage(currentPage - 1)
                  }}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>

              {/* Page numbers */}
              {totalPages <= 5 ? (
                [...Array(totalPages)].map((_, i) => (
                  <PaginationItem key={i + 1}>
                    <PaginationLink
                      href="#"
                      isActive={currentPage === i + 1}
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(i + 1)
                      }}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))
              ) : (
                <>
                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      isActive={currentPage === 1}
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(1)
                      }}
                    >
                      1
                    </PaginationLink>
                  </PaginationItem>

                  {currentPage > 3 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  {currentPage > 2 && (
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        isActive={false}
                        onClick={(e) => {
                          e.preventDefault()
                          setCurrentPage(currentPage - 1)
                        }}
                      >
                        {currentPage - 1}
                      </PaginationLink>
                    </PaginationItem>
                  )}

                  {currentPage !== 1 && currentPage !== totalPages && (
                    <PaginationItem>
                      <PaginationLink href="#" isActive>
                        {currentPage}
                      </PaginationLink>
                    </PaginationItem>
                  )}

                  {currentPage < totalPages - 1 && (
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        isActive={false}
                        onClick={(e) => {
                          e.preventDefault()
                          setCurrentPage(currentPage + 1)
                        }}
                      >
                        {currentPage + 1}
                      </PaginationLink>
                    </PaginationItem>
                  )}

                  {currentPage < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      isActive={currentPage === totalPages}
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(totalPages)
                      }}
                    >
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                </>
              )}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                  }}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>

        {/* Drawer for transaction details */}
        {selectedTransaction && (
          <AnalyticsDrilldownDrawer
            isOpen={isDrawerOpen}
            onClose={handleDrawerClose}
            title={`Transaction Details - ${selectedTransaction.bookingId}`}
            summary={[
              {
                label: 'Date',
                value: formatDate(selectedTransaction.date),
              },
              {
                label: 'Customer',
                value: selectedTransaction.customerName,
              },
              {
                label: 'Vehicle',
                value: selectedTransaction.vehicleName,
              },
              {
                label: 'Net Amount',
                value: formatCurrency(selectedTransaction.net),
              },
            ]}
          >
            <div className="space-y-4">
              {/* Transaction Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Revenue
                  </p>
                  <p
                    className="text-lg font-semibold mt-1"
                    style={{ color: 'var(--success)' }}
                  >
                    {formatCurrency(selectedTransaction.revenue)}
                  </p>
                </div>
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Expense
                  </p>
                  <p
                    className="text-lg font-semibold mt-1"
                    style={{ color: 'var(--danger)' }}
                  >
                    {formatCurrency(selectedTransaction.expense)}
                  </p>
                </div>
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Collected
                  </p>
                  <p
                    className="text-lg font-semibold mt-1"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {formatCurrency(selectedTransaction.collected)}
                  </p>
                </div>
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Pending
                  </p>
                  <p
                    className="text-lg font-semibold mt-1"
                    style={{ color: 'var(--warning)' }}
                  >
                    {formatCurrency(selectedTransaction.pending)}
                  </p>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="pt-4 space-y-3">
                  <div className="flex justify-between">
                    <span
                      className="text-sm"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Type
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {selectedTransaction.type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span
                      className="text-sm"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Status
                    </span>
                    <Badge variant={getStatusVariant(selectedTransaction.status)}>
                      {selectedTransaction.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </AnalyticsDrilldownDrawer>
        )}
      </div>
    )
  }
)

FinancialTransactionsTable.displayName = 'FinancialTransactionsTable'

export default FinancialTransactionsTable
