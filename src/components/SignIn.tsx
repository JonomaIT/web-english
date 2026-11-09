import { useState, type FormEvent } from "react";
import { useStudy } from "../app/studyContext";

const PROBLEM = {
  wrong: "Wrong user or password.",
  unavailable: "Sync is not available here (offline, or the local dev server, which has no API).",
} as const;

/** Signs in to sync progress between devices; signed in, says as whom and offers to sign out. */
export function SignIn() {
  const { sync, signIn, signOut } = useStudy();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (sync.kind === "checking") return null;

  if (sync.kind !== "signed-out") {
    const leave = async () => {
      setBusy(true);
      await signOut();
      setBusy(false);
    };
    return (
      <div className="signin signin--in">
        <p className="hint">
          Signed in as <strong>{sync.user}</strong>: every answer is saved in this browser and synced, so any
          device picks up where you left off.
        </p>
        <button className="btn btn--secondary" type="button" disabled={busy} onClick={() => void leave()}>
          Sign out
        </button>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const result = await signIn(user, password);
    setBusy(false);
    if (result === "ok") setPassword("");
    else setProblem(PROBLEM[result]);
  };

  return (
    <form className="signin" onSubmit={(e) => void submit(e)}>
      <p className="hint">
        Progress is kept in this browser. Sign in once on each device to keep the computer and the phone in
        step.
      </p>
      <div className="signin__fields">
        <label className="field">
          <span>User</span>
          <input
            className="input"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            required
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
      {problem ? (
        <p className="hint signin__problem" role="alert">
          {problem}
        </p>
      ) : null}
    </form>
  );
}
