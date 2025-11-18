import { Component, signal, computed, ViewChild, ElementRef, OnInit, effect, DestroyRef, inject } from '@angular/core';
import { ComercioService } from '../shared/services/comercio.service';
import { Comercio, FilterState, LoadingState, BrandCategory } from '../shared/models/comercio.model';
import { setupInfiniteScroll, setupSearchDebounce, scrollToTop, scrollContainer } from '../shared/utils/scroll.utils';
@Component({
    selector: 'app-cfe',
    imports: [],
    templateUrl: './cfe.html',
    styleUrl: './cfe.css'
})
export class Cfe implements OnInit {
    private readonly destroyRef = inject(DestroyRef);

    // Señales para el estado reactivo
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
        estado: '',
        municipio: '',
        sort: 'top',
        includeAddress: false,
        partialMatch: false
    });

    // Configuración de paginación virtual
    protected readonly currentPage = signal(0);
    protected readonly hasMoreItems = signal(true);

    // Signal para el botón de scroll to top
    protected readonly showScrollToTop = signal(false);

    // Signal para el estado de expansión de marcas
    protected readonly brandsExpanded = signal(false);

    // Signals para el slider infinito de comercios principales
    protected readonly infiniteSliderIndex = signal(0);
    protected readonly sliderIsTransitioning = signal(false);

    // ViewChild para acceder al contenedor de tops y marcas
    @ViewChild('topsContainer') topsContainer?: ElementRef<HTMLElement>;
    @ViewChild('brandsContainer') brandsContainer?: ElementRef<HTMLElement>;
    @ViewChild('principalesContainer') principalesContainer?: ElementRef<HTMLElement>;

    // Computed signals para datos derivados
    protected readonly estados = computed(() => {
        const estadosSet = new Set(this.comercios().map(c => c.estado));
        return Array.from(estadosSet).filter(Boolean).sort();
    });

    protected readonly municipios = computed(() => {
        const municipiosSet = new Set(this.comercios().map(c => c.municipio));
        return Array.from(municipiosSet).filter(Boolean).sort();
    });

    protected readonly topComercios = computed(() => {
        return this.comercios().filter(c => c.top).slice(0, 10); // Limitar a 10 elementos
    });

    protected readonly filteredComercios = computed(() => {
        return this.displayedComercios();
    });

    protected readonly loading = computed(() => this.loadingState().isLoading);
    protected readonly loadingProgress = computed(() => this.loadingState().progress);
    protected readonly loadingMessage = computed(() => this.loadingState().message);
    protected readonly loadingError = computed(() => this.loadingState().error);

    protected readonly currentYear = computed(() => new Date().getFullYear());

    // Marcas de calzado organizadas por categorías
    protected readonly brandCategories = signal<BrandCategory[]>([
        {
            title: 'Botas / Piel Premium',
            icon: '🥾',
            brands: ['BUCKHOUSE', 'CUADRA', 'TIMBERLAND']
        },
        {
            title: 'Calzado (Marcas)',
            icon: '👞',
            brands: [
                'ALDO', 'ALEJANDRA', 'ARANTZA', 'BRANTANO', 'CANDY',
                'COQUETA', 'DIONE', 'DOMIT', 'FLEXI',
                'GOSH', 'INCOGNITA', 'JESSICA',
                'JOYA', 'KARELE', 'KELDER', 'MARCELA',
                'MICHEL', 'MUZZA', 'NINE WEST', 'PARUNO', 'RIBERA', 'ROCKPORT', 'STYLO',
                'VAZZA', 'VEROCHI', 'VIA UNO', 'ZOE'
            ]
        },
        {
            title: 'Catálogo / Mayorista',
            icon: '📦',
            brands: ['ANDREA', 'CKLASS', 'IMPULS', 'MUNDO TERRA', 'PAKAR', 'PRICE SHOES']
        },
        {
            title: 'Deportivo (Marcas)',
            icon: '👟',
            brands: [
                'CHARLY', 'CONVERSE', 'CROCS', 'NIKE',
                'PANAM', 'PIRMA', 'PUMA', 'SKECHERS', 'VANS'
            ]
        },
        {
            title: 'Industrial / Seguridad',
            icon: '🦺',
            brands: ['BERRENDO', 'CATERPILLAR', 'DESTROYER']
        },
        {
            title: 'Moda / Fast Fashion',
            icon: '👕',
            brands: [
                'GUESS', 'H&M', 'HUGO', 'LEE', 'LOB',
                'MASSIMO DUTTI',
                'STRADIVARIUS', 'ZARA'
            ]
        },
        {
            title: 'Retail Multimarca',
            icon: '🏪',
            brands: [
                'CALZAPATO', 'DOROTHY GAYNOR', 'DPORTENIS',
                'TAF', '3 HERMANOS'
            ]
        },
        {
            title: 'Departamental',
            icon: '🏬',
            brands: ['LIVERPOOL', 'PALACIO DE HIERRO', 'SEARS', 'COPPEL']
        },
    ]);

    // Todas las marcas en un array plano para búsquedas
    protected readonly allBrands = computed(() => {
        return this.brandCategories().flatMap(category => category.brands);
    });

    // Marcas destacadas para la vista compacta (primeras de cada categoría)
    protected readonly getFeaturedBrands = computed(() => {
        const featured: string[] = [];
        this.brandCategories().forEach(category => {
            // Tomar las primeras 2-3 marcas de cada categoría
            const limit = category.brands.length >= 3 ? 3 : category.brands.length;
            featured.push(...category.brands.slice(0, limit));
        });
        return featured.slice(0, 20); // Limitar a 20 marcas destacadas
    });

    constructor(
        private comercioService: ComercioService
    ) {
        // Effect para debug
        effect(() => {
            console.log('Comercios cargados:', this.comercios().length);
            console.log('Comercios mostrados:', this.displayedComercios().length);
        });

        // Effect para aplicar filtros cuando cambia el estado
        effect(() => {
            const filterState = this.filterState();
            this.applyFiltersAsync(filterState);
        });
    }

    async ngOnInit() {
        await this.cargarComercios();
        this.setupInfiniteScroll();
        this.setupSearchDebounce();
    }

    // Métodos públicos para el template (usando el servicio)
    protected getNombreComercio(comercio: Comercio): string {
        return this.comercioService.getNombreComercio(comercio);
    }

    protected getUbicacionTexto(comercio: Comercio): string {
        return this.comercioService.getUbicacionCompleta(comercio);
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

    protected onSearchChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        // La búsqueda con debounce se maneja en setupSearchDebounce
        // Este método se mantiene para compatibilidad
        this.updateFilterState({ q: target.value });
    }

    protected onSearchInput(event: Event): void {
        // Método alternativo que podría usarse para debounce manual
        this.onSearchChange(event);
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
        this.filterState.set({
            q: '',
            estado: '',
            municipio: '',
            sort: 'top',
            includeAddress: false,
            partialMatch: false
        });
        this.currentPage.set(0);
    }

    protected loadMoreItems(): void {
        if (this.hasMoreItems() && !this.loading()) {
            this.currentPage.update(page => page + 1);
            this.applyFiltersAsync(this.filterState());
        }
    }

    protected scrollTops(direction: number): void {
        scrollContainer(this.topsContainer?.nativeElement, direction, 320);
    }

    protected scrollToTop(): void {
        scrollToTop();
    }

    protected toggleBrandsExpanded(): void {
        this.brandsExpanded.update(current => !current);
    }

    protected scrollBrands(direction: number): void {
        scrollContainer(this.brandsContainer?.nativeElement, direction, 300);
    }

    protected searchByBrand(brand: string): void {
        // Actualizar el valor del input de búsqueda
        const searchInput = document.querySelector('#search') as HTMLInputElement;
        if (searchInput) {
            searchInput.value = brand;
            searchInput.focus();
        }

        // Actualizar el estado del filtro
        this.updateFilterState({ q: brand });
    }

    // Métodos privados optimizados (usando el servicio)
    protected async cargarComercios(): Promise<void> {
        try {
            const excludeFilter = (c: Comercio) => {
                const nombreComercio = this.comercioService.getNombreComercio(c).toUpperCase();
                const razonSocial = c.razon_social.toUpperCase();
                return !nombreComercio.includes('CHEDRAUI') && !razonSocial.includes('CHEDRAUI');
            };

            const data = await this.comercioService.loadComercios(
                './cfe/cfe.json',
                (state) => this.updateLoadingState(state),
                excludeFilter
            );

            this.comercios.set(data);

            // Aplicar filtros iniciales
            await this.applyFiltersAsync(this.filterState());
        } catch (error) {
            // El error ya se maneja en el servicio
            console.error('Error en cargarComercios:', error);
        }
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

    private setupInfiniteScroll(): void {
        setupInfiniteScroll(
            this.destroyRef,
            (scrollTop) => this.showScrollToTop.set(scrollTop > 300),
            () => this.loadMoreItems()
        );
    }

    private setupSearchDebounce(): void {
        setupSearchDebounce(
            this.destroyRef,
            'search',
            (value) => this.updateFilterState({ q: value }),
            300,  // debounce 300ms
            0     // sin mínimo de caracteres
        );
    }

    private updateLoadingState(update: Partial<LoadingState>): void {
        this.loadingState.update(current => ({ ...current, ...update }));
    }

    private updateFilterState(update: Partial<FilterState>): void {
        this.filterState.update(current => ({ ...current, ...update }));
        this.currentPage.set(0); // Reset pagination when filters change
    }
}
