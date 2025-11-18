import { fromEvent } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * Configura infinite scroll para detectar cuando el usuario está cerca del final
 */
export function setupInfiniteScroll(
    destroyRef: DestroyRef,
    onScroll: (scrollTop: number) => void,
    onLoadMore: () => void
) {
    fromEvent(window, 'scroll')
        .pipe(
            debounceTime(100),
            distinctUntilChanged(),
            takeUntilDestroyed(destroyRef)
        )
        .subscribe(() => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;

            onScroll(scrollTop);

            // Cargar más cuando estemos cerca del final (80% del scroll)
            if (scrollTop + windowHeight >= documentHeight * 0.8) {
                onLoadMore();
            }
        });
}

/**
 * Configura debounce para el campo de búsqueda
 */
export function setupSearchDebounce(
    destroyRef: DestroyRef,
    searchInputId: string,
    onSearch: (value: string) => void,
    debounceMs: number = 300,
    minChars: number = 0
) {
    const searchInput = document.querySelector(`#${searchInputId}`) as HTMLInputElement;
    if (searchInput) {
        fromEvent(searchInput, 'input')
            .pipe(
                debounceTime(debounceMs),
                distinctUntilChanged(),
                takeUntilDestroyed(destroyRef)
            )
            .subscribe((event: any) => {
                const value = event.target.value;

                // Solo buscar si cumple con el mínimo de caracteres
                if (value.length === 0 || value.length >= minChars) {
                    onSearch(value);
                }
            });
    }
}

/**
 * Scroll suave hacia arriba
 */
export function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

/**
 * Scroll horizontal en un contenedor
 */
export function scrollContainer(
    container: HTMLElement | undefined,
    direction: number,
    amount: number = 300
) {
    if (container) {
        container.scrollBy({
            left: direction * amount,
            behavior: 'smooth'
        });
    }
}
