import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService, Cell, GameState } from '../services/game.service';
import { Subject, takeUntil } from 'rxjs';



@Component({
  selector: 'app-word-search',
  standalone: true,
  imports: [CommonModule],
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

    this.startNewGame();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  startNewGame(): void {
    this.isLoading = true;
    this.error = null;
    this.dateDebut = Date.now();

    this.gameService.loadGame(5, 'fr', 12, 12)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.error = 'Erreur lors du chargement du jeu. Vérifiez que le serveur backend est démarré.';
          console.error(err);
        }
      });
  }

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

  formatTimeElapsed(time:number): string {
    const minutes = Math.floor(time);
    const seconds = Math.floor((time - minutes) * 60);
    return `${minutes}m ${seconds}s`;
  }
}
