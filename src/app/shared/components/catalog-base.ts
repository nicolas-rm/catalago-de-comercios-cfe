import { DestroyRef, Directive, ElementRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { BrandCategory, Comercio, FilterState, LoadingState } from '../models/comercio.model';
import { ComercioService } from '../services/comercio.service';
import { scrollContainer, scrollToTop, setupInfiniteScroll, setupSearchDebounce } from '../utils/scroll.utils';

interface CatalogConfig {
    jsonPath: string;
    excludedComercios: string[];
    initialFilterState: FilterState;
    brandCategories: BrandCategory[];
    searchInputId?: string;
}

const BRAND_SCROLL_AMOUNT = 300;
const MAX_FEATURED_BRANDS = 20;
const FEATURED_BRANDS_PER_CATEGORY = 3;
const SCROLL_TO_TOP_THRESHOLD = 300;

@Directive({
    standalone: true
})
export abstract class CatalogBase implements OnInit {
    private readonly destroyRef = inject(DestroyRef);
    private readonly jsonPath: string;
    private readonly excludedComercios: string[];
    private readonly initialFilterState: FilterState;
    private readonly searchInputId: string;

    protected brandsContainer?: ElementRef<HTMLElement>;

    protected readonly comercios = signal<Comercio[]>([]);
    protected readonly displayedComercios = signal<Comercio[]>([]);
    protected readonly loadingState = signal<LoadingState>({
        isLoading: false,
        progress: 0,
        message: '',
        error: undefined
    });
    protected readonly filterState = signal<FilterState>({
        q: '',
        municipio: '',
        sort: 'top',
        includeAddress: false,
        partialMatch: false
    });
    protected readonly currentPage = signal(0);
    protected readonly hasMoreItems = signal(true);
    protected readonly showScrollToTop = signal(false);
    protected readonly brandsExpanded = signal(false);

    protected readonly brandCategories = signal<BrandCategory[]>([]);

    protected readonly estados = computed(() => {
        const estadosSet = new Set(this.comercios().map((c: Comercio) => c.estado));
        return Array.from(estadosSet).filter(Boolean).sort();
    });

    protected readonly municipios = computed(() => {
        const municipiosSet = new Set(this.comercios().map((c: Comercio) => c.municipio));
        return Array.from(municipiosSet).filter(Boolean).sort();
    });

    protected readonly filteredComercios = computed(() => this.displayedComercios());

    protected readonly loading = computed(() => this.loadingState().isLoading);
    protected readonly loadingProgress = computed(() => this.loadingState().progress);
    protected readonly loadingMessage = computed(() => this.loadingState().message);
    protected readonly loadingError = computed(() => this.loadingState().error);

    protected readonly currentYear = computed(() => new Date().getFullYear());

    protected readonly allBrands = computed(() =>
        this.brandCategories().flatMap((category: BrandCategory) => category.brands)
    );

    protected readonly getFeaturedBrands = computed(() => {
        const featured: string[] = [];

        for (const category of this.brandCategories()) {
            featured.push(...category.brands.slice(0, FEATURED_BRANDS_PER_CATEGORY));
        }

        return featured.slice(0, MAX_FEATURED_BRANDS);
    });

    protected constructor(
        protected readonly comercioService: ComercioService,
        config: CatalogConfig
    ) {
        this.jsonPath = config.jsonPath;
        this.excludedComercios = config.excludedComercios.map(name => name.toUpperCase());
        this.initialFilterState = { ...config.initialFilterState };
        this.searchInputId = config.searchInputId ?? 'search';

        this.filterState.set({ ...this.initialFilterState });
        this.brandCategories.set(config.brandCategories);

        effect(() => {
            void this.applyFiltersAsync(this.filterState());
        });
    }

    protected beforeInitialLoad(): void {}

    async ngOnInit(): Promise<void> {
        this.beforeInitialLoad();
        await this.cargarComercios();
        this.configureInfiniteScroll();
        this.configureSearchDebounce();
    }

    protected getNombreComercio(comercio: Comercio): string {
        return this.comercioService.getNombreComercio(comercio);
    }

    protected getDireccionCompleta(comercio: Comercio): string {
        return this.comercioService.getDireccionCompleta(comercio);
    }

    protected getUbicacionCompleta(comercio: Comercio): string {
        return this.comercioService.getUbicacionCompleta(comercio);
    }

    protected verEnMapa(comercio: Comercio): void {
        const url = this.comercioService.getMapUrl(comercio);
        window.open(url, '_blank');
    }

    protected onEstadoChange(event: Event): void {
        const target = event.target as HTMLSelectElement;
        this.updateFilterState({ estado: target.value });
    }

    protected onMunicipioChange(event: Event): void {
        const target = event.target as HTMLSelectElement;
        this.updateFilterState({ municipio: target.value });
    }

    protected onSortChange(event: Event): void {
        const target = event.target as HTMLSelectElement;
        this.updateFilterState({ sort: target.value as FilterState['sort'] });
    }

    protected onIncludeAddressChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.updateFilterState({ includeAddress: target.checked });
    }

    protected onPartialMatchChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.updateFilterState({ partialMatch: target.checked });
    }

    protected resetFilters(): void {
        this.filterState.set({ ...this.initialFilterState });
        this.currentPage.set(0);
    }

    protected loadMoreItems(): void {
        if (this.hasMoreItems() && !this.loading()) {
            this.currentPage.update((page: number) => page + 1);
            void this.applyFiltersAsync(this.filterState());
        }
    }

    protected scrollToTop(): void {
        scrollToTop();
    }

    protected toggleBrandsExpanded(): void {
        this.brandsExpanded.update((current: boolean) => !current);
    }

    protected scrollBrands(direction: number): void {
        scrollContainer(this.brandsContainer?.nativeElement, direction, BRAND_SCROLL_AMOUNT);
    }

    protected searchByBrand(brand: string): void {
        const searchInput = document.querySelector(`#${this.searchInputId}`) as HTMLInputElement | null;
        if (searchInput) {
            searchInput.value = brand;
            searchInput.focus();
        }

        this.updateFilterState({ q: brand });
    }

    protected async cargarComercios(): Promise<void> {
        try {
            const data = await this.comercioService.loadComercios(
                this.jsonPath,
                (state) => this.updateLoadingState(state),
                this.createExcludeFilter()
            );

            this.comercios.set(data);
            await this.applyFiltersAsync(this.filterState());
        } catch (error) {
            console.error('Error en cargarComercios:', error);
        }
    }

    private createExcludeFilter(): ((comercio: Comercio) => boolean) | undefined {
        if (this.excludedComercios.length === 0) {
            return undefined;
        }

        return (comercio: Comercio) => {
            const nombreComercio = this.comercioService.getNombreComercio(comercio).toUpperCase();
            const razonSocial = comercio.razon_social.toUpperCase();
            return !this.excludedComercios.some(
                excluded => nombreComercio.includes(excluded) || razonSocial.includes(excluded)
            );
        };
    }

    private async applyFiltersAsync(state: FilterState): Promise<void> {
        const result = await this.comercioService.applyFilters(
            this.comercios(),
            state,
            this.currentPage()
        );

        this.displayedComercios.set(result.filtered);
        this.hasMoreItems.set(result.hasMore);
    }

    private configureInfiniteScroll(): void {
        setupInfiniteScroll(
            this.destroyRef,
            (scrollTop) => this.showScrollToTop.set(scrollTop > SCROLL_TO_TOP_THRESHOLD),
            () => this.loadMoreItems()
        );
    }

    private configureSearchDebounce(): void {
        setupSearchDebounce(
            this.destroyRef,
            this.searchInputId,
            (value) => this.updateFilterState({ q: value }),
            300,
            0
        );
    }

    private updateLoadingState(update: Partial<LoadingState>): void {
        this.loadingState.update((current: LoadingState) => ({ ...current, ...update }));
    }

    private updateFilterState(update: Partial<FilterState>): void {
        this.filterState.update((current: FilterState) => ({ ...current, ...update }));
        this.currentPage.set(0);
    }
}
