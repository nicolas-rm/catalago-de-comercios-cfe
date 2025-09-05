import { Component, signal, computed, ViewChild, ElementRef, OnInit, effect, DestroyRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, fromEvent, startWith } from 'rxjs';

// Interfaces para tipos de datos
interface Comercio {
    id?: string;
    razon_social: string;
    marca_tienda?: string;
    ubicacion: string;
    colonia?: string;
    municipio: string;
    estado: string;
    cp?: string;
    rfc?: string;
    tienda_ubicacion?: string;
    top?: boolean;
}

interface FilterState {
    q: string;
    estado: string;
    municipio: string;
    sort: 'top' | 'az' | 'estado';
}

interface LoadingState {
    isLoading: boolean;
    progress: number;
    message: string;
    error?: string;
}

interface BrandCategory {
    title: string;
    brands: string[];
    icon: string;
}

@Component({
    selector: 'app-root',
    imports: [],
    templateUrl: './app.html',
    styleUrl: './app.css'
})
export class App implements OnInit {
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
        sort: 'top'
    });

    // Configuración de paginación virtual
    private readonly ITEMS_PER_PAGE = 50;
    private readonly CHUNK_SIZE = 1000; // Procesar en chunks de 1000 elementos
    protected readonly currentPage = signal(0);
    protected readonly hasMoreItems = signal(true);
    
    // Signal para el botón de scroll to top
    protected readonly showScrollToTop = signal(false);
    
    // Signal para el estado de expansión de marcas
    protected readonly brandsExpanded = signal(false);
    
    // Signal para controlar la visibilidad del modal de alerta
    protected readonly showLocationAlert = signal(true);
    
    // ViewChild para acceder al contenedor de tops y marcas
    @ViewChild('topsContainer') topsContainer?: ElementRef<HTMLElement>;
    @ViewChild('brandsContainer') brandsContainer?: ElementRef<HTMLElement>;

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
                'ALDO', 'ALEJANDRA', 'AMARA', 'ARANTZA', 'BRANTANO', 'CANDY',
                'COQUETA', 'DIONE', 'DOMIT', 'FLEXI',
                'GOSH', 'INCOGNITA', 'JEANNE', 'JESSICA', 'JIMENA',
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
                'BERSHKA', 'GUESS', 'H&M', 'HUGO', 'LEE', 'LOB',
                'MASSIMO DUTTI', 'OLD NAVY',
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

    constructor(private http: HttpClient) {
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

    // Métodos públicos para el template
    protected getNombreComercio(comercio: Comercio): string {
        return comercio.marca_tienda || comercio.razon_social;
    }

    protected getUbicacionTexto(comercio: Comercio): string {
        return `${comercio.municipio}, ${comercio.estado}`;
    }

    protected getDireccionCompleta(comercio: Comercio): string {
        return `${comercio.ubicacion}${comercio.colonia ? ', ' + comercio.colonia : ''}`;
    }

    protected getUbicacionCompleta(comercio: Comercio): string {
        return `${comercio.municipio}, ${comercio.estado}`;
    }

    protected verEnMapa(comercio: Comercio): void {
        const nombre = this.getNombreComercio(comercio);
        const direccion = this.getDireccionCompleta(comercio);
        const ubicacion = this.getUbicacionCompleta(comercio);
        const query = encodeURIComponent(`${nombre} ${direccion} ${ubicacion}`);
        const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
        window.open(url, '_blank');
    }

    protected downloadCSV(): void {
        // Implementar descarga de CSV
        const csvContent = this.generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'comercios_cfe.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

    protected resetFilters(): void {
        this.filterState.set({
            q: '',
            estado: '',
            municipio: '',
            sort: 'top'
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
        const container = this.topsContainer?.nativeElement;
        if (container) {
            container.scrollBy({
                left: direction * 320,
                behavior: 'smooth'
            });
        }
    }

    protected scrollToTop(): void {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    protected toggleBrandsExpanded(): void {
        this.brandsExpanded.update(current => !current);
    }

    protected scrollBrands(direction: number): void {
        const container = this.brandsContainer?.nativeElement;
        if (container) {
            container.scrollBy({
                left: direction * 300,
                behavior: 'smooth'
            });
        }
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

    protected closeLocationAlert(): void {
        this.showLocationAlert.set(false);
    }

    // Métodos privados optimizados
    protected async cargarComercios(): Promise<void> {
        try {
            this.updateLoadingState({
                isLoading: true,
                progress: 0,
                message: 'Iniciando carga de datos...'
            });

            // Cargar datos reales desde JSON
            const response = await this.http.get<Comercio[]>('./comercios.json').toPromise();
            const data = response || [];
            
            this.updateLoadingState({
                isLoading: true,
                progress: 50,
                message: `Procesando ${data.length} comercios...`
            });

            // Procesar en chunks para evitar congelar la UI
            await this.processDataInChunks(data);
            
            this.updateLoadingState({
                isLoading: true,
                progress: 100,
                message: 'Finalizando...'
            });

            // Aplicar filtros iniciales
            await this.applyFiltersAsync(this.filterState());

        } catch (error) {
            console.error('Error cargando comercios:', error);
            this.updateLoadingState({
                isLoading: false,
                progress: 0,
                message: '',
                error: 'Error al cargar los datos. Por favor, intenta de nuevo.'
            });
        } finally {
            this.updateLoadingState({
                isLoading: false,
                progress: 100,
                message: 'Datos cargados correctamente'
            });
        }
    }

    private async processDataInChunks(data: Comercio[]): Promise<void> {
        const chunks = this.chunkArray(data, this.CHUNK_SIZE);
        let processedData: Comercio[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            // Procesar chunk en el siguiente tick para no bloquear UI
            await new Promise(resolve => {
                setTimeout(() => {
                    processedData = [...processedData, ...chunk];
                    
                    const progress = ((i + 1) / chunks.length) * 50 + 50;
                    this.updateLoadingState({
                        isLoading: true,
                        progress,
                        message: `Procesando ${processedData.length} de ${data.length} comercios...`
                    });
                    
                    resolve(void 0);
                }, 0);
            });
        }

        this.comercios.set(processedData);
    }

    private async applyFiltersAsync(state: FilterState): Promise<void> {
        return new Promise(resolve => {
            setTimeout(() => {
                let filtered = this.comercios();

                // Aplicar filtros
                if (state.estado) {
                    filtered = filtered.filter(c => c.estado === state.estado);
                }

                if (state.municipio) {
                    filtered = filtered.filter(c =>
                        c.municipio.toLowerCase().includes(state.municipio.toLowerCase())
                    );
                }

                if (state.q) {
                    const query = this.normalize(state.q);
                    filtered = filtered.filter(c => {
                        const searchText = this.normalize([
                            c.razon_social,
                            c.marca_tienda,
                            c.tienda_ubicacion,
                            c.ubicacion,
                            c.colonia,
                            c.municipio,
                            c.estado,
                            c.rfc
                        ].filter(Boolean).join(' '));
                        return searchText.includes(query);
                    });
                }

                // Aplicar ordenamiento
                switch (state.sort) {
                    case 'az':
                        filtered.sort((a, b) =>
                            this.getNombreComercio(a).localeCompare(this.getNombreComercio(b))
                        );
                        break;
                    case 'estado':
                        filtered.sort((a, b) => a.estado.localeCompare(b.estado));
                        break;
                    default: // 'top'
                        filtered.sort((a, b) => {
                            if (a.top !== b.top) return b.top ? 1 : -1;
                            return this.getNombreComercio(a).localeCompare(this.getNombreComercio(b));
                        });
                }

                // Aplicar paginación
                const currentPage = this.currentPage();
                const startIndex = currentPage * this.ITEMS_PER_PAGE;
                const endIndex = startIndex + this.ITEMS_PER_PAGE;
                const paginatedResults = filtered.slice(0, endIndex);

                this.displayedComercios.set(paginatedResults);
                this.hasMoreItems.set(filtered.length > endIndex);

                resolve();
            }, 0);
        });
    }

    private setupInfiniteScroll(): void {
        // Detectar scroll para cargar más elementos y mostrar/ocultar botón
        fromEvent(window, 'scroll')
            .pipe(
                debounceTime(100),
                distinctUntilChanged(),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const windowHeight = window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight;

                // Mostrar botón cuando el scroll esté arriba de 300px
                this.showScrollToTop.set(scrollTop > 300);

                // Cargar más cuando estemos cerca del final (80% del scroll)
                if (scrollTop + windowHeight >= documentHeight * 0.8) {
                    this.loadMoreItems();
                }
            });
    }

    private setupSearchDebounce(): void {
        // Configurar debounce para la búsqueda
        const searchInput = document.querySelector('#search') as HTMLInputElement;
        if (searchInput) {
            fromEvent(searchInput, 'input')
                .pipe(
                    debounceTime(300), // Esperar 300ms después del último input
                    distinctUntilChanged(),
                    takeUntilDestroyed(this.destroyRef)
                )
                .subscribe((event: any) => {
                    const value = event.target.value;
                    this.updateFilterState({ q: value });
                });
        }
    }

    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    private updateLoadingState(update: Partial<LoadingState>): void {
        this.loadingState.update(current => ({ ...current, ...update }));
    }

    private updateFilterState(update: Partial<FilterState>): void {
        this.filterState.update(current => ({ ...current, ...update }));
        this.currentPage.set(0); // Reset pagination when filters change
    }

    private normalize(text: string): string {
        return text.toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    private generateCSV(): string {
        const headers = ['Razón Social', 'Marca/Tienda', 'Dirección', 'Colonia', 'Municipio', 'Estado', 'CP', 'RFC'];
        const rows = this.displayedComercios().map(comercio => [
            comercio.razon_social,
            comercio.marca_tienda || '',
            comercio.ubicacion,
            comercio.colonia || '',
            comercio.municipio,
            comercio.estado,
            comercio.cp || '',
            comercio.rfc || ''
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        return '\ufeff' + csvContent; // BOM para Excel
    }
}
