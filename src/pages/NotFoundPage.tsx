import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <section className="study-done">
      <span className="eyebrow">404</span>
      <h1 className="page-title">Nothing here</h1>
      <p className="lead">This page does not exist.</p>
      <Link className="btn btn--secondary" to="/">
        Back to today
      </Link>
    </section>
  );
}
