import {Component, EventEmitter, Output, Input, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl, Validators, ValidatorFn, AbstractControl} from '@angular/forms';

export interface GameConfig {
  rows: number;
  cols: number;
  nombre: number;
  longueurMin: number;
  longueurMax: number;
  langue: string;
}

// Validator personnalisé pour vérifier la taille de la grille (validation croisée)
const gridSizeValidator: ValidatorFn = (control: AbstractControl): { [key: string]: any } | null => {
  const rows = control.get('rows')?.value;
  const cols = control.get('cols')?.value;
  const nombre = control.get('nombre')?.value;
  const longueurMin = control.get('longueurMin')?.value;

  if (rows && cols && nombre && longueurMin) {
    const gridSize = rows * cols;
    const minGridSize = nombre * longueurMin;
    if (gridSize < minGridSize) {
      // Renvoie un objet d'erreur si la validation échoue
      return {'gridTooSmall': true};
    }
  }
  // Renvoie null si la validation réussit
  return null;
};


@Component({
  selector: 'app-game-config-dialog',
  standalone: true,
  // Remplacer FormsModule par ReactiveFormsModule
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './game-config-dialog.component.html',
  styleUrl: './game-config-dialog.component.scss'
})
export class GameConfigDialogComponent implements OnInit {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<GameConfig>();

  // Valeurs par défaut
  private readonly defaultValues: GameConfig = {
    rows: 12,
    cols: 12,
    nombre: 5,
    longueurMin: 3,
    longueurMax: 10,
    langue: 'fr'
  };

  // Définition du FormGroup pour le formulaire
  configForm = new FormGroup({
    rows: new FormControl(this.defaultValues.rows, [
      Validators.required,
      Validators.min(5),
      Validators.max(30),
    ]),
    cols: new FormControl(this.defaultValues.cols, [
      Validators.required,
      Validators.min(5),
      Validators.max(30),
    ]),
    nombre: new FormControl(this.defaultValues.nombre, [
      Validators.required,
      Validators.min(1),
      Validators.max(20),
    ]),
    longueurMin: new FormControl(this.defaultValues.longueurMin, [
      Validators.required,
      Validators.min(2),
      Validators.max(15),
    ]),
    longueurMax: new FormControl(this.defaultValues.longueurMax, [
      Validators.required,
      Validators.min(2),
      Validators.max(20),
      // Validation pour s'assurer que longueurMax >= longueurMin (validation croisée légère)
      // La validation complète est gérée par le `gridSizeValidator` au niveau du FormGroup
    ]),
    langue: new FormControl(this.defaultValues.langue, [
      Validators.required,
    ]),
  }, {validators: gridSizeValidator}); // Ajout du validator de taille de grille au niveau du FormGroup

  // Conserver pour afficher l'erreur de validation croisée spécifique si nécessaire
  validationErrors: string[] = [];


  ngOnInit() {
    // Ajout d'une validation dynamique pour s'assurer que longueurMax est >= longueurMin
    this.configForm.get('longueurMax')?.addValidators([
      (control: AbstractControl) => {
        const longueurMin = this.configForm.get('longueurMin')?.value;
        if (longueurMin !== null && control.value < (longueurMin ?? 1)) {
          return {'minMaxMismatch': true};
        }
        return null;
      }
    ]);
    this.configForm.get('longueurMax')?.updateValueAndValidity(); // Appliquer la validation immédiatement

    // Ajout d'une validation dynamique pour s'assurer que longueurMin est <= longueurMax
    this.configForm.get('longueurMin')?.addValidators([
      (control: AbstractControl) => {
        const longueurMax = this.configForm.get('longueurMax')?.value;
        if (longueurMax !== null && control.value > (longueurMax ?? 20)) {
          return {'maxMinMismatch': true};
        }
        return null;
      }
    ]);
    this.configForm.get('longueurMin')?.updateValueAndValidity(); // Appliquer
  }


  onClose(): void {
    // Réinitialiser le formulaire à ses valeurs par défaut
    this.configForm.reset(this.defaultValues);
    this.validationErrors = []; // Effacer les erreurs spécifiques
    this.close.emit();
  }

  onConfirm(): void {
    // Mettre à jour manuellement la validité pour afficher les erreurs
    this.configForm.markAllAsTouched();
    this.validationErrors = [];

    // Vérification de la validation croisée spécifique (taille de grille)
    if (this.configForm.errors?.['gridTooSmall']) {
      const {rows, cols, nombre, longueurMin} = this.configForm.value;
      this.validationErrors.push(`La grille (${rows}x${cols}) est trop petite pour ${nombre} mots de ${longueurMin} lettres minimum`);
    }

    if (this.configForm.valid) {
      // Émettre la configuration du formulaire
      this.confirm.emit(this.configForm.value as GameConfig);
      this.configForm.markAsPristine(); // Marquer comme pristine après confirmation réussie
    } else if (this.validationErrors.length === 0) {
      this.validationErrors.push("Veuillez corriger les erreurs dans le formulaire.");
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('dialog-backdrop')) {
      this.onClose();
    }
  }

  // Fonction utilitaire pour vérifier si un champ est invalide et "touché"
  isInvalid(controlName: string): boolean {
    const control = this.configForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  // Fonction pour obtenir le message d'erreur spécifique pour un champ
  getFieldError(controlName: string): string | null {
    const control = this.configForm.get(controlName);
    if (!control?.errors || !this.isInvalid(controlName)) {
      return null;
    }

    if (controlName === 'longueurMax' && control.errors['minMaxMismatch']) {
      return 'Doit être supérieure ou égale à la longueur min.';
    }

    if (controlName === 'longueurMin' && control.errors['maxMinMismatch']) {
      return 'Doit être inférieure ou égale à la longueur max.';
    }

    if (control.errors['required']) {
      return 'Ce champ est requis.';
    }
    if (control.errors['min']) {
      return `Valeur minimale: ${control.errors['min'].min}.`;
    }
    if (control.errors['max']) {
      return `Valeur maximale: ${control.errors['max'].max}.`;
    }

    return 'Valeur invalide.';
  }
}
