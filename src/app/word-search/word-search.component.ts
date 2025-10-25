import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService, Cell, GameState } from '../services/game.service';
import { GameConfigDialogComponent, GameConfig } from '../game-config-dialog/game-config-dialog.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-word-search',
  standalone: true,
  imports: [CommonModule, GameConfigDialogComponent],
  templateUrl: './word-search.component.html',
  styleUrl: './word-search.component.scss'
})
export class WordSearchComponent implements OnInit, OnDestroy {
  gameState: GameState = {
    grid: [],
    words: [],
    foundWords: new Set(),
    selectedCells: [],
    isSelecting: false
  };

  isLoading = false;
  error: string | null = null;
  isDialogOpen = false;

  dateDebut: number = Date.now();
  timeElapsed: string = '0m 0s';

  private readonly destroy$ = new Subject<void>();

  constructor(private readonly gameService: GameService) {}

  ngOnInit(): void {
    this.gameService.gameState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.gameState = state;
      });

    // Charger une partie par défaut au démarrage
    this.loadGame({
      rows: 12,
      cols: 12,
      nombre: 5,
      longueurMin: 3,
      longueurMax: 10,
      langue: 'fr'
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openNewGameDialog(): void {
    this.isDialogOpen = true;
  }

  closeDialog(): void {
    this.isDialogOpen = false;
  }

  onConfigConfirm(config: GameConfig): void {
    this.isDialogOpen = false;
    this.loadGame(config);
  }

  private loadGame(config: GameConfig): void {
    this.isLoading = true;
    this.error = null;
    this.dateDebut = Date.now();

    this.gameService.loadGame(
      config.nombre,
      config.langue,
      config.rows,
      config.cols,
      config.longueurMin,
      config.longueurMax
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;

          // Gestion des erreurs spécifiques du backend
          if (err.error?.detail) {
            this.error = err.error.detail;
          } else if (err.status === 0) {
            this.error = 'Impossible de se connecter au serveur. Vérifiez que le backend est démarré.';
          } else if (err.status >= 500) {
            this.error = 'Erreur serveur. La grille n\'a pas pu être générée avec ces paramètres.';
          } else {
            this.error = 'Une erreur est survenue lors de la génération de la grille. Essayez avec d\'autres paramètres.';
          }

          console.error('Erreur lors du chargement:', err);
        }
      });
  }

  // Gestion de la souris
  onCellMouseDown(cell: Cell): void {
    if (cell.isFound) return;
    this.gameService.startSelection(cell);
  }

  onCellMouseEnter(cell: Cell): void {
    if (cell.isFound) return;
    if (this.gameState.isSelecting) {
      this.gameService.continueSelection(cell);
    }
  }

  onCellMouseUp(): void {
    this.gameService.endSelection();
  }

  // Gestion tactile
  onCellTouchStart(event: TouchEvent, cell: Cell): void {
    event.preventDefault(); // Empêcher le comportement par défaut (scroll, zoom)
    if (cell.isFound) return;
    this.gameService.startSelection(cell);
  }

  onCellTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (!this.gameState.isSelecting) return;

    // Récupérer la position du doigt
    const touch = event.touches[0];

    // Trouver l'élément sous le doigt
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    if (element?.classList.contains('cell')) {
      // Récupérer les coordonnées de la cellule depuis les attributs data
      const row = parseInt(element.getAttribute('data-row') || '-1');
      const col = parseInt(element.getAttribute('data-col') || '-1');

      if (row >= 0 && col >= 0) {
        const cell = this.gameState.grid[row]?.[col];
        if (cell && !cell.isFound) {
          this.gameService.continueSelection(cell);
        }
      }
    }
  }

  onCellTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    this.gameService.endSelection();
  }

  onGridTouchMove(event: TouchEvent): void {
    // Déléguer au gestionnaire de cellule
    this.onCellTouchMove(event);
  }

  onGridTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    this.gameService.endSelection();
  }

  isWordFound(word: string): boolean {
    return this.gameState.foundWords.has(word.toUpperCase());
  }

  getCellClass(cell: Cell): string {
    const classes = ['cell'];
    if (cell.isFound) classes.push('found');
    if (cell.isSelected) classes.push('selected');
    return classes.join(' ');
  }

  getProgress(): number {
    if (this.gameState.words.length === 0) return 0;
    return (this.gameState.foundWords.size / this.gameState.words.length) * 100;
  }

  isGameComplete(): boolean {
    this.timeElapsed = this.formatTimeElapsed((Date.now() - this.dateDebut)/60000);
    return this.gameService.isGameComplete();
  }

  formatTimeElapsed(time: number): string {
    const minutes = Math.floor(time);
    const seconds = Math.floor((time - minutes) * 60);
    return `${minutes}m ${seconds}s`;
  }
}
