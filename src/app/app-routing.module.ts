import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  // We'll have a simple setup with just one route for the chat interface
  { path: '', redirectTo: '/chat', pathMatch: 'full' },
  { path: 'chat', loadChildren: () => import('./components/chat/chat.module').then(m => m.ChatModule) },
  { path: '**', redirectTo: '/chat' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }