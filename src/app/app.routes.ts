import { Routes } from '@angular/router';
import { WordSearchComponent } from './word-search/word-search.component';

export const routes: Routes = [
  { path: '', component: WordSearchComponent },
  { path: '**', redirectTo: '' }
];
