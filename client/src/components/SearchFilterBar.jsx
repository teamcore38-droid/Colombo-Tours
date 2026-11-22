import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';

export function SearchFilterBar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  onResetAll,
  activeFilterCount,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/* Unified search & filter pill bar matching mobile reference */}
      <div className="flex items-center rounded-xl border border-[var(--border-gold)] bg-[var(--bg-input)] px-3.5 py-1.5 transition-colors focus-within:border-[var(--border-gold-strong)]">
        <Search
          className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search vehicle or model..."
          aria-label="Search vehicles by name or model"
          data-testid="fleet-search-input"
          className="w-full bg-transparent px-2.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="mr-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--gold-soft-bg)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}

        <span
          aria-hidden="true"
          className="mx-1.5 h-5 w-px bg-[var(--border-subtle)]"
        />

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls="fleet-filter-panel"
          data-testid="fleet-filter-toggle"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
            open || activeFilterCount > 0
              ? 'bg-[var(--gold-soft-bg)] text-[var(--gold-accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span>Filter</span>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {activeFilterCount > 0 ? (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--gold-bright)] px-1 text-[10px] font-bold text-[#12100A]">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Expandable filter drawer */}
      {open ? (
        <div
          id="fleet-filter-panel"
          className="rounded-xl border border-[var(--border-gold)] bg-[var(--bg-card)] p-4 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="filter-transmission"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
              >
                Transmission
              </label>
              <select
                id="filter-transmission"
                value={filters.transmission}
                onChange={(e) =>
                  onFilterChange({ ...filters, transmission: e.target.value })
                }
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
              >
                <option value="all">All Transmissions</option>
                <option value="Automatic">Automatic</option>
                <option value="Manual">Manual</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-chauffeur"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
              >
                Chauffeur Option
              </label>
              <select
                id="filter-chauffeur"
                value={filters.chauffeur}
                onChange={(e) =>
                  onFilterChange({ ...filters, chauffeur: e.target.value })
                }
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
              >
                <option value="all">Any Option</option>
                <option value="Chauffeur Included">Chauffeur Included</option>
                <option value="Chauffeur Available">Chauffeur Available</option>
                <option value="Self-Drive">Self-Drive</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-seats"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
              >
                Seating Capacity
              </label>
              <select
                id="filter-seats"
                value={filters.minSeats}
                onChange={(e) =>
                  onFilterChange({ ...filters, minSeats: e.target.value })
                }
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
              >
                <option value="">Any Capacity</option>
                <option value="4">4+ Seats</option>
                <option value="5">5+ Seats</option>
                <option value="6">6+ Seats</option>
                <option value="7">7+ Seats</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] pt-3">
            <button
              type="button"
              onClick={onResetAll}
              className="text-xs font-medium text-[var(--gold-accent)] hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-[var(--border-gold)] px-3.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--gold-soft-bg)] cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
