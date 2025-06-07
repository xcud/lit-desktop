import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// Import Material modules
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { MatSliderModule } from '@angular/material/slider';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

// Import Angular Split for the split layout
import { AngularSplitModule } from 'angular-split';

// Import Markdown module
import { MarkdownModule } from 'ngx-markdown';

// Import Chat components
import { ChatPageComponent } from './chat-page/chat-page.component';
import { ChatScreenComponent } from './chat-screen/chat-screen.component';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { TitleGeneratorService } from '../../utils/title-generator.service';

const routes: Routes = [
  { path: '', component: ChatPageComponent }
];

@NgModule({
  declarations: [
    ChatPageComponent,
    ChatScreenComponent,
    SafeHtmlPipe
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    
    // Material modules
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatMenuModule,
    MatCheckboxModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatSliderModule,
    
    // Optional modules
    AngularSplitModule,
    MarkdownModule.forChild(),
  ],
  providers: [
    TitleGeneratorService
  ]
})
export class ChatModule { }