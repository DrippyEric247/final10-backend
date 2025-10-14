// client/src/pages/Login.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Final10Logo from '../components/Final10Logo';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    try {
      await login(form);
      nav('/'); // go to dashboard
    } catch (e) {
      setErr(e?.response?.data?.message || 'Login failed');
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      {/* FINAL10 APP Logo */}
      <div className="text-center mb-12 mt-4">
        <Final10Logo size="large" showTaglines={true} />
      </div>
      
      <h1 className="text-3xl font-bold mb-4 text-center">Welcome Back</h1>
      {err && <div className="mb-3 text-red-400">{err}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full p-3 rounded bg-gray-900" placeholder="Email" name="email" id="email"
               value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
        <input className="w-full p-3 rounded bg-gray-900" placeholder="Password" type="password" name="password" id="password"
               value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
        <button className="w-full p-3 rounded bg-purple-500 font-semibold">Sign in</button>
      </form>
      <p className="mt-3 text-sm text-gray-400">No account? <Link className="underline" to="/register">Sign up</Link></p>
    </div>
  );
}


