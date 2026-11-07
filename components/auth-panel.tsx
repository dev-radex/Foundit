'use client';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';
import { supabaseBrowser } from '../lib/supabase/client';
export default function AuthPanel({ path }: { path: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [show, setShow] = useState(false);
  const register = path === '/register',
    forgot = path === '/forgot-password',
    reset = path === '/reset-password';
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const f = new FormData(e.currentTarget),
      email = String(f.get('email') || ''),
      password = String(f.get('password') || '');
    try {
      const client = supabaseBrowser();
      if (reset) {
        if (password !== f.get('confirm')) throw new Error('Passwords do not match.');
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setMessage('Your password has been updated.');
        window.location.assign('/dashboard');
      } else if (forgot) {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/auth/callback?next=/reset-password',
        });
        if (error) throw error;
        setMessage('If an account exists for that email, you will receive a password reset link.');
      } else if (register) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: String(f.get('name') || '') },
            emailRedirectTo: window.location.origin + '/auth/callback?next=/onboarding',
          },
        });
        if (error) throw error;
        if (data.session) window.location.assign('/onboarding');
        else setMessage('Check your email to confirm your account, then return to sign in.');
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign('/dashboard');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    setError('');
    try {
      const { error } = await supabaseBrowser().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/auth/callback?next=/dashboard' },
      });
      if (error) throw error;
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <div className="auth-wrap">
      <a className="logo" href="/">
        <img src="/favicon.svg" alt="" />
        Found<span>It</span>
      </a>
      <section className="auth-card panel">
        <h1>
          {register
            ? 'Create your account'
            : forgot
              ? 'Forgot your password?'
              : reset
                ? 'Set a new password'
                : 'Welcome back'}
        </h1>
        <p>
          {register
            ? 'Join the University of Ilorin community.'
            : forgot
              ? 'We’ll email you a secure reset link.'
              : reset
                ? 'Choose a strong password for your account.'
                : 'Log in to your account'}
        </p>
        {!forgot && !reset && (
          <>
            <button type="button" className="btn full" disabled={busy} onClick={google}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.7 2.9-4.2 2.9-7.4Z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 5-1 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.6A10 10 0 0 0 12 22Z"
                />
                <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9l3.4-2.6Z" />
                <path
                  fill="#EA4335"
                  d="M12 5.9c1.5 0 2.8.5 3.8 1.5L18.6 4A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9 5.5l3.4 2.6C7.2 7.7 9.4 5.9 12 5.9Z"
                />
              </svg>
              Continue with Google
            </button>
            <div className="auth-divider">
              <span>or</span>
            </div>
          </>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="inline-success" role="status">
            {message}
          </p>
        )}
        <form onSubmit={submit}>
          {register && (
            <label className="field">
              <span>Full name</span>
              <input name="name" required autoComplete="name" maxLength={100} />
            </label>
          )}
          {!reset && (
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
          )}
          {!forgot && (
            <>
              <label className="field">
                <span className="row between">
                  Password
                  {!register && !reset && (
                    <a href="/forgot-password" className="text-link">
                      Forgot password?
                    </a>
                  )}
                </span>
                <div className="password-input">
                  <input
                    name="password"
                    type={show ? 'text' : 'password'}
                    required
                    minLength={register || reset ? 10 : 1}
                    autoComplete={register || reset ? 'new-password' : 'current-password'}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    aria-label={show ? 'Hide password' : 'Show password'}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {(register || reset) && <small>Use at least 10 characters.</small>}
              </label>
              {reset && (
                <label className="field">
                  <span>Confirm password</span>
                  <input
                    type="password"
                    name="confirm"
                    required
                    minLength={10}
                    autoComplete="new-password"
                  />
                </label>
              )}
            </>
          )}
          <button className="btn primary full" disabled={busy}>
            {busy
              ? 'Please wait…'
              : register
                ? 'Create account'
                : forgot
                  ? 'Send reset link'
                  : reset
                    ? 'Update password'
                    : 'Log in'}
            <ArrowRight size={16} />
          </button>
        </form>
        <p className="auth-bottom">
          {forgot || reset ? (
            <a className="text-link" href="/login">
              Back to sign in
            </a>
          ) : register ? (
            <>
              Already have an account?{' '}
              <a className="text-link" href="/login">
                Sign in
              </a>
            </>
          ) : (
            <>
              Don’t have an account?{' '}
              <a className="text-link" href="/register">
                Create one
              </a>
            </>
          )}
        </p>
        {register && (
          <small>
            By creating an account, you agree to our <a href="/legal/terms">terms</a> and{' '}
            <a href="/legal/privacy">privacy policy</a>.
          </small>
        )}
        <p className="auth-note">
          <Lock size={13} />
          Your contact details are never displayed to other members.
        </p>
      </section>
    </div>
  );
}
