"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "";

const DEMO_USERS = [
  { label: "Admin", email: "admin@demo.com" },
  { label: "Employer", email: "employer@demo.com" },
  { label: "Recruiter", email: "recruiter@demo.com" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(e) {
    e?.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Sign-in failed: check the email and password, then try again.");
      return;
    }
    router.push("/dashboard");
  }

  function pick(user) {
    setEmail(user.email);
    if (DEMO_PASSWORD) setPassword(DEMO_PASSWORD);
  }

  return (
    <main className="login">
      <h1>Confidential job board</h1>
      <p className="lead">
        Sign in as each role to see how the database decides who can view employer details.
      </p>

      <form onSubmit={signIn}>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      <div className="quick">
        <p>Demo accounts</p>
        <div className="quick-row">
          {DEMO_USERS.map((u) => (
            <button key={u.email} type="button" className="chip" onClick={() => pick(u)}>
              {u.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
