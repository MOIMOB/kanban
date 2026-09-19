import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  mode = signal<'signin' | 'signup'>('signin');
  error = signal<string | null>(null);
  busy = signal(false);

  toggleMode(): void {
    this.mode.update((m) => (m === 'signin' ? 'signup' : 'signin'));
    this.error.set(null);
  }

  async submit(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      if (this.mode() === 'signup') {
        await this.auth.signUp(this.email, this.password);
      } else {
        await this.auth.signIn(this.email, this.password);
      }
      this.router.navigateByUrl('/boards');
    } catch (e) {
      const message = (e as { message?: string })?.message;
      this.error.set(message ?? 'Something went wrong');
    } finally {
      this.busy.set(false);
    }
  }
}
