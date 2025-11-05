'use client';

import { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import VerifyEmailForm from './VerifyEmailForm';

type AuthView = 'login' | 'register' | 'forgotPassword' | 'verify';

export default function AuthForms() {
  const [view, setView] = useState<AuthView>('login');
  const [emailToVerify, setEmailToVerify] = useState('');

  const handleRegistrationSuccess = (email: string) => {
    setEmailToVerify(email);
    setView('verify');
  };

  const handleVerified = () => {
    setView('login');
    setEmailToVerify('');
  };

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
          onRegistrationSuccess={handleRegistrationSuccess}
        />
      )}
      {view === 'verify' && (
        <VerifyEmailForm
          email={emailToVerify}
          onVerified={handleVerified}
          onBack={() => setView('register')}
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
