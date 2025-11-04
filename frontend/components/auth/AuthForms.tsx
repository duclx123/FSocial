'use client';

import { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordForm from './ForgotPasswordForm';

type AuthView = 'login' | 'register' | 'forgotPassword';

export default function AuthForms() {
  const [view, setView] = useState<AuthView>('login');

  return (
    <div className="w-full">
      {view === 'login' && (
        <LoginForm
          onSwitchToRegister={() => setView('register')}
          onSwitchToForgotPassword={() => setView('forgotPassword')}
        />
      )}
      {view === 'register' && (
        <RegisterForm
          onSwitchToLogin={() => setView('login')}
        />
      )}
      {view === 'forgotPassword' && (
        <ForgotPasswordForm
          onSwitchToLogin={() => setView('login')}
        />
      )}
    </div>
  );
}
