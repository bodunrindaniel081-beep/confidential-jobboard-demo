"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState("");
  const [jobs, setJobs] = useState([]);
  const [privateCount, setPrivateCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const db = supabase();
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
      router.replace("/");
      return;
    }
    setEmail(session.user.email);

    const { data: me, error: meErr } = await db
      .from("profiles")
      .select("role, full_name")
      .eq("id", session.user.id)
      .single();
    if (meErr) {
      setError("Couldn't load your profile. Check that this user has a row in the profiles table.");
      setLoading(false);
      return;
    }
    setProfile(me);

    // Two separate queries on purpose. RLS decides what each one returns.
    const { data: jobRows } = await db
      .from("jobs")
      .select("id, title, location, description, employer_id, created_at")
      .order("created_at", { ascending: false });
    const { data: privateRows } = await db
      .from("job_private")
      .select("job_id, company_name, contact_email");

    const byJob = Object.fromEntries((privateRows || []).map((p) => [p.job_id, p]));
    setJobs((jobRows || []).map((j) => ({ ...j, private: byJob[j.id] || null })));
    setPrivateCount((privateRows || []).length);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function signOut() {
    await supabase().auth.signOut();
    router.replace("/");
  }

  if (loading) return <main className="wrap"><p className="empty">Loading…</p></main>;
  if (error) return <main className="wrap"><p className="error">{error}</p></main>;

  const role = profile.role;

  return (
    <main className="wrap">
      <header className="topbar">
        <h1>Confidential job board</h1>
        <div className="who">
          <span>{email}</span>
          <span className={`role ${role}`}>{role}</span>
          <button className="btn ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <Proof role={role} jobs={jobs.length} privateCount={privateCount} />

      {role === "employer" && <PostJob onPosted={load} />}

      <h2>{role === "employer" ? "Your roles" : "Open roles"}</h2>
      {jobs.length === 0 ? (
        <p className="empty">
          {role === "employer"
            ? "No roles yet. Post one above."
            : "No roles posted yet. Sign in as the employer to post one."}
        </p>
      ) : (
        jobs.map((job) => <JobCard key={job.id} job={job} />)
      )}
    </main>
  );
}

function Proof({ role, jobs, privateCount }) {
  const text = {
    admin: "You see every role and every employer's contact details.",
    employer: "You see only your own roles, including your private details.",
    recruiter: "Employer details are withheld. This isn't hidden by the page: the database returned no private records to you.",
  }[role];

  return (
    <section className="proof">
      <p style={{ margin: "0 0 6px" }}><strong>{text}</strong></p>
      <p style={{ margin: 0 }}>
        Database returned <code>{jobs}</code> role{jobs === 1 ? "" : "s"} and{" "}
        <code>{privateCount}</code> private employer record{privateCount === 1 ? "" : "s"} for this account.
      </p>
    </section>
  );
}

function JobCard({ job }) {
  return (
    <article className="job">
      <h3>{job.title}</h3>
      {job.location && <p className="loc">{job.location}</p>}
      {job.description && <p className="desc">{job.description}</p>}
      <dl className="employer-row">
        <dt>Company</dt>
        <dd>{job.private ? job.private.company_name : <span className="redacted" aria-label="Withheld" />}</dd>
        <dt>Contact</dt>
        <dd>{job.private ? job.private.contact_email : <span className="redacted wide" aria-label="Withheld" />}</dd>
        {!job.private && <dd className="withheld">Withheld by database policy</dd>}
      </dl>
    </article>
  );
}

function PostJob({ onPosted }) {
  const empty = { title: "", location: "", description: "", company_name: "", contact_email: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const db = supabase();

    const { data: job, error: jobErr } = await db
      .from("jobs")
      .insert({ title: form.title, location: form.location, description: form.description })
      .select("id")
      .single();
    if (jobErr) {
      setSaving(false);
      setError("Couldn't post the role: " + jobErr.message);
      return;
    }

    const { error: privErr } = await db.from("job_private").insert({
      job_id: job.id,
      company_name: form.company_name,
      contact_email: form.contact_email,
    });
    setSaving(false);
    if (privErr) {
      setError("Role posted, but private details didn't save: " + privErr.message);
      return;
    }
    setForm(empty);
    onPosted();
  }

  return (
    <section className="post">
      <h2>Post a role</h2>
      <form onSubmit={submit}>
        <div className="grid">
          <label className="field"><span>Role title</span>
            <input value={form.title} onChange={set("title")} required />
          </label>
          <label className="field"><span>Location</span>
            <input value={form.location} onChange={set("location")} placeholder="Tampa, FL" />
          </label>
        </div>
        <label className="field"><span>Description</span>
          <textarea value={form.description} onChange={set("description")} />
        </label>
        <p className="private-note">Recruiters never see the two fields below.</p>
        <div className="grid">
          <label className="field"><span>Company name</span>
            <input value={form.company_name} onChange={set("company_name")} required />
          </label>
          <label className="field"><span>Contact email</span>
            <input type="email" value={form.contact_email} onChange={set("contact_email")} required />
          </label>
        </div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Posting…" : "Post role"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </section>
  );
}
