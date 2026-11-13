import {
  ArrowRightIcon,
  CheckIcon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";
export default function Landing({ go }: { go: (path: string) => void }) {
  return (
    <div className="landing">
      <header className="public-header">
        <a className="brand" href="/">
          streaxie<span>.</span>
        </a>
        <nav className="flex gap-2">
          <button className="text-button" onClick={() => go("/login")}>
            Sign in
          </button>
          <button className="primary" onClick={() => go("/register")}>
            Get started
          </button>
        </nav>
      </header>
      <main>
        <section className="hero grid gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">ONE DAY AT A TIME</p>
            <h1>A simpler way to track your daily habits.</h1>
            <p className="hero-copy">
              A clear place for the things you want to keep doing. Check in, see
              your progress, and leave a little room for real life.
            </p>
            <button
              className="primary hero-cta"
              onClick={() => go("/register")}
            >
              Start your first habit <ArrowRightIcon />
            </button>
            <p className="fine-print">
              Free to get started. No payment details.
            </p>
          </div>
          <div
            className="sample-board"
            aria-label="Illustrative habit tracker preview"
          >
            <div className="flex justify-between items-center">
              <span className="eyebrow">YOUR DAILY SPACE</span>
              <span className="sample-label">Example</span>
            </div>
            <h2>A good day starts small.</h2>
            <p className="muted mb-6">A few things, just for you.</p>
            {[
              ["Read a little", "A simple check-in", "12"],
              ["Drink water", "1,800 / 2,000 ml", "8"],
              ["Wind down", "Aim for 21:00", "14"],
            ].map(([name, description, n], i) => (
              <div className="sample-habit" key={name}>
                <span className="habit-icon">
                  <CheckIcon />
                </span>
                <div>
                  <strong>{name}</strong>
                  <p>{description}</p>
                </div>
                <span className="streak">
                  <LightningBoltIcon />
                  {n}
                  <small>days</small>
                </span>
                {i < 2 && (
                  <div className="sample-progress">
                    <span style={{ width: i === 0 ? "100%" : "90%" }} />
                  </div>
                )}
              </div>
            ))}
            <p className="sample-note">Your habits. Your own rhythm.</p>
          </div>
        </section>
        <section className="feature-section">
          <p className="eyebrow">LESS FRICTION, MORE FOLLOW-THROUGH</p>
          <h2>Keep it simple. Make it yours.</h2>
          <div className="grid md:grid-cols-3 gap-8 mt-8">
            {[
              [
                "A check, an amount, a time.",
                "Track your habits in the way that makes sense for them.",
              ],
              [
                "Consistency you can see.",
                "Every habit has its own streak, visible right where you check in.",
              ],
              [
                "Room for real life.",
                "Set optional flexibility, and keep checking in when your connection drops.",
              ],
            ].map(([title, copy], i) => (
              <article key={title}>
                <span className="feature-number">0{i + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-end">
          <h2>Make a little space for what matters.</h2>
          <button className="primary" onClick={() => go("/register")}>
            Create your free account <ArrowRightIcon />
          </button>
        </section>
      </main>
      <footer className="public-footer">
        <span className="brand">
          streaxie<span>.</span>
        </span>
        <span>One day at a time.</span>
      </footer>
    </div>
  );
}
