import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface Cell {
  letter: string;
  row: number;
  col: number;
  isSelected: boolean;
  isFound: boolean;
}

export interface WordSolution {
  mot: string;
  start: [number, number];
  direction: [number, number];
}

export interface GridResponse {
  grille: string[][];
  solution: WordSolution[];
}

export interface GameState {
  grid: Cell[][];
  words: string[];
  foundWords: Set<string>;
  selectedCells: Cell[];
  isSelecting: boolean;
  lockedDirection?: [number, number]; // Direction verrouillée
}

export enum DirectionsEnum{
  H = "H",
  V = "V",
  D1 = "D1",
  D2 = "D2"
}

export const directionCoordinates: Record<DirectionsEnum, [number, number]> = {
  [DirectionsEnum.H]: [0, 1],  // Horizontal
  [DirectionsEnum.V]: [1, 0],  // Vertical
  [DirectionsEnum.D1]: [-1, 1],  // Diagonale bas
  [DirectionsEnum.D2]: [1, 1]  // Diagonale haut
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private readonly apiUrl = '/api';

  private readonly gameStateSubject = new BehaviorSubject<GameState>({
    grid: [],
    words: [],
    foundWords: new Set(),
    selectedCells: [],
    isSelecting: false
  });

  public gameState$ = this.gameStateSubject.asObservable();
  private solution: WordSolution[] = [];

  constructor(private readonly http: HttpClient) {}

  loadGame(
    nombre: number = 8,
    langue: string = 'fr',
    rows: number = 12,
    cols: number = 12,
    longueurMin: number = 3,
    longueurMax: number = 10
  ): Observable<GridResponse> {
    const params = {
      nombre: nombre.toString(),
      langue,
      longueur_min: longueurMin.toString(),
      longueur_max: longueurMax.toString(),
      n_top: '10000',
      rows: rows.toString(),
      cols: cols.toString()
    };

    return this.http.get<GridResponse>(`${this.apiUrl}/mots_mele`, { params }).pipe(
      tap(response => this.initializeGame(response))
    );
  }

  private initializeGame(response: GridResponse): void {
    const grid: Cell[][] = response.grille.map((row, rowIndex) =>
      row.map((letter, colIndex) => ({
        letter,
        row: rowIndex,
        col: colIndex,
        isSelected: false,
        isFound: false
      }))
    );

    const words = response.solution.map(sol => sol.mot.toUpperCase());
    this.solution = response.solution;

    this.gameStateSubject.next({
      grid,
      words,
      foundWords: new Set(),
      selectedCells: [],
      isSelecting: false
    });
  }

  startSelection(cell: Cell): void {
    const state = this.gameStateSubject.value;
    cell.isSelected = true;

    this.gameStateSubject.next({
      ...state,
      selectedCells: [cell],
      isSelecting: true,
      lockedDirection: undefined // Pas de direction verrouillée au début
    });
  }

  continueSelection(cell: Cell): void {
    const state = this.gameStateSubject.value;
    if (!state.isSelecting) return;

    const lastCell = state.selectedCells[state.selectedCells.length - 1];

    // Ne pas sélectionner deux fois la même cellule
    if (state.selectedCells.some(c => c.row === cell.row && c.col === cell.col)) return;

    // Vérifier que c'est une cellule adjacente
    const rowDiff = Math.abs(cell.row - lastCell.row);
    const colDiff = Math.abs(cell.col - lastCell.col);
    const isAdjacent = (rowDiff <= 1 && colDiff <= 1) && (rowDiff + colDiff > 0);

    if (!isAdjacent) return;

    // Calculer la direction actuelle
    const dr = Math.sign(cell.row - lastCell.row);
    const dc = Math.sign(cell.col - lastCell.col);
    const currentDirection: [number, number] = [dr, dc];

    // Si on a déjà une direction verrouillée (2+ cellules), vérifier qu'on reste dans cette direction
    if (state.lockedDirection) {
      const [lockedDr, lockedDc] = state.lockedDirection;
      if (dr !== lockedDr || dc !== lockedDc) {
        return; // Direction différente, on refuse
      }
    }

    // Définir la direction verrouillée si c'est la deuxième cellule
    const newLockedDirection = state.selectedCells.length === 1 ? currentDirection : state.lockedDirection;

    cell.isSelected = true;
    this.gameStateSubject.next({
      ...state,
      selectedCells: [...state.selectedCells, cell],
      lockedDirection: newLockedDirection
    });
  }

  endSelection(): void {
    const state = this.gameStateSubject.value;
    if (!state.isSelecting || state.selectedCells.length < 2) {
      this.clearSelection();
      return;
    }

    const selectedWord = state.selectedCells.map(c => c.letter).join('');
    const foundWord = this.checkWord(selectedWord, state.selectedCells);

    if (foundWord) {
      state.selectedCells.forEach(cell => {
        cell.isFound = true;
        cell.isSelected = false;
      });

      const newFoundWords = new Set(state.foundWords);
      newFoundWords.add(foundWord.toUpperCase());

      this.gameStateSubject.next({
        ...state,
        foundWords: newFoundWords,
        selectedCells: [],
        isSelecting: false,
        lockedDirection: undefined
      });
    } else {
      this.clearSelection();
    }
  }

  private checkWord(word: string, cells: Cell[]): string | null {
    // Vérifier le mot dans le sens normal et inversé
    const normalWord = word.toUpperCase();
    const reversedWord = word.split('').reverse().join('').toUpperCase();

    for (const sol of this.solution) {
      const solWord = sol.mot.toUpperCase();

      if (solWord === normalWord || solWord === reversedWord) {
        // Vérifier que les cellules correspondent à la solution
        const firstCell = cells[0];
        const [startRow, startCol] = sol.start;
        const [dr, dc] = sol.direction;

        let matches = firstCell.row === startRow && firstCell.col === startCol;

        // Vérifier aussi le sens inverse
        const lastCell = cells[cells.length - 1];
        const endRow = startRow + dr * (sol.mot.length - 1);
        const endCol = startCol + dc * (sol.mot.length - 1);
        const matchesReverse = lastCell.row === startRow && lastCell.col === startCol &&
          firstCell.row === endRow && firstCell.col === endCol;

        if (matches || matchesReverse) {
          return solWord;
        }
      }
    }

    return null;
  }

  private clearSelection(): void {
    const state = this.gameStateSubject.value;
    state.selectedCells.forEach(cell => {
      cell.isSelected = false;
    });

    this.gameStateSubject.next({
      ...state,
      selectedCells: [],
      isSelecting: false,
      lockedDirection: undefined
    });
  }

  isGameComplete(): boolean {
    const state = this.gameStateSubject.value;
    return state.foundWords.size === state.words.length;
  }

  resetGame(): void {
    this.gameStateSubject.next({
      grid: [],
      words: [],
      foundWords: new Set(),
      selectedCells: [],
      isSelecting: false
    });
  }
}
