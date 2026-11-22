export function CategoryPills({
  categories = [],
  activeCategory,
  onSelectCategory,
}) {
  return (
    <div
      role="tablist"
      aria-label="Vehicle categories"
      className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeCategory === 'all'}
        onClick={() => onSelectCategory('all')}
        data-testid="category-pill-all"
        className={`shrink-0 rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
          activeCategory === 'all'
            ? 'btn-gold'
            : 'pill-gold-outline text-[var(--text-secondary)]'
        }`}
      >
        All Fleet
      </button>

      {categories.map((cat) => {
        const isActive = activeCategory === cat.slug;
        return (
          <button
            key={cat._id || cat.slug}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectCategory(cat.slug)}
            data-testid={`category-pill-${cat.slug}`}
            className={`shrink-0 rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              isActive
                ? 'btn-gold'
                : 'pill-gold-outline text-[var(--text-secondary)]'
            }`}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
