// client/src/pages/Register.js
import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Final10Logo from '../components/Final10Logo';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [qs] = useSearchParams();
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    username: '', firstName: '', lastName: '',
    email: '', password: '', referralCode: ''
  });

  // auto-fill ref code if coming from ?ref=XYZ
  useEffect(() => {
    const ref = qs.get('ref');
    if (ref) setForm(f => ({ ...f, referralCode: ref }));
  }, [qs]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    try {
      await register(form);
      nav('/'); // go to dashboard
    } catch (e) {
      setErr(e?.response?.data?.message || 'Registration failed');
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      {/* FINAL10 APP Logo */}
      <div className="text-center mb-8">
        <Final10Logo size="large" showTaglines={true} />
      </div>
      
      <h1 className="text-3xl font-bold mb-4 text-center">Join FINAL10</h1>
      {err && <div className="mb-3 text-red-400">{err}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full p-3 rounded bg-gray-900" placeholder="Username" name="username" id="username"
               value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/>
        <div className="grid grid-cols-2 gap-3">
          <input className="p-3 rounded bg-gray-900" placeholder="First name" name="firstName" id="firstName"
                 value={form.firstName} onChange={e=>setForm({...form, firstName:e.target.value})}/>
          <input className="p-3 rounded bg-gray-900" placeholder="Last name" name="lastName" id="lastName"
                 value={form.lastName} onChange={e=>setForm({...form, lastName:e.target.value})}/>
        </div>
        <input className="w-full p-3 rounded bg-gray-900" placeholder="Email" name="email" id="email"
               value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
        <input className="w-full p-3 rounded bg-gray-900" placeholder="Password" type="password" name="password" id="password"
               value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
        <input className="w-full p-3 rounded bg-gray-900" placeholder="Referral code (optional)" name="referralCode" id="referralCode"
               value={form.referralCode} onChange={e=>setForm({...form, referralCode:e.target.value})}/>
        <button className="w-full p-3 rounded bg-yellow-400 text-black font-semibold">Sign up</button>
      </form>
      <p className="mt-3 text-sm text-gray-400">Already have an account? <Link className="underline" to="/login">Login</Link></p>
    </div>
  );
}


