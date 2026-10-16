'use client'

import { useState } from 'react'
import Image from 'next/image'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LogIn, ShieldAlert, Eye, EyeOff } from 'lucide-react'

export default function LoginClient() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await signIn('credentials', {
      redirect: false,
      email,
      password
    })

    if (res?.error) {
      setError('Email atau kata sandi salah.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh() // Refresh to update server components with session
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <Image src="/brand/prohaba-logo.png" alt="Prohaba Jaya Mandiri" width={92} height={88} priority />
        </div>
        <h1 className="login-title">ERP Prohaba</h1>
        <p className="login-desc">Masuk untuk melanjutkan</p>

        {error && (
          <div role="alert" className="alert alert-danger" style={{ marginBottom: 18 }}>
            <ShieldAlert aria-hidden />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="nama@prohaba.co.id"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Kata sandi</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{ paddingRight: 48 }}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                style={{ position: 'absolute', right: 3, top: 3 }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <><span className="spinner" aria-hidden /> Memeriksa…</> : <><LogIn aria-hidden /> Masuk</>}
          </button>
        </form>

        <p className="login-foot">© {new Date().getFullYear()} PT. Prohaba Jaya Mandiri</p>
      </div>
    </main>
  )
}
