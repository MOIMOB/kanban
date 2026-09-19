import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharingService } from '../sharing.service';

@Component({
  selector: 'app-share-dialog',
  standalone: true,
  imports: [FormsModule],
  providers: [SharingService],
  templateUrl: './share-dialog.html',
})
export class ShareDialog implements OnInit {
  @Input({ required: true }) boardId!: string;
  @Output() closed = new EventEmitter<void>();

  protected readonly sharing = inject(SharingService);

  email = '';
  role: 'editor' | 'viewer' = 'editor';
  error = signal<string | null>(null);
  busy = signal(false);

  ngOnInit(): void {
    this.sharing.load(this.boardId);
  }

  async addMember(): Promise<void> {
    const email = this.email.trim();
    if (!email) return;
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.sharing.addMember(this.boardId, email, this.role);
      this.email = '';
    } catch (e) {
      const message = (e as { message?: string })?.message;
      this.error.set(message ?? 'Could not add collaborator');
    } finally {
      this.busy.set(false);
    }
  }
}
