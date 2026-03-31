<template>
  <main class="page-shell">
    <header class="content-header">
      <NuxtLink class="btn-back" to="/" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m9.55 12l7.35 7.35q.375.375.363.875t-.388.875t-.875.375t-.875-.375l-7.7-7.675q-.3-.3-.45-.675t-.15-.75t.15-.75t.45-.675l7.7-7.7q.375-.375.888-.363t.887.388t.375.875t-.375.875z"/></svg>
      </NuxtLink>
      <h2>About</h2>
    </header>

    <section class="about-hero">
      <p class="eyebrow">Queens Puzzle Clone</p>
      <p class="about-lead">
        Inspired by the LinkedIn Queens game, this is a clean, mobile-friendly logic puzzle where you place one queen per row, per column, and per region
        without letting queens touch each other.
      </p>
      <p class="about-purpose">
        This is a hobby project. I created this clone because many friends told me they wanted more puzzles to practice.
      </p>

      <ul class="about-highlights" aria-label="highlights">
        <li>Tap to cycle marks and drag to paint X marks quickly.</li>
        <li>Create custom puzzles in Designer and solve them in Play.</li>
        <li>Use timer, undo, and reset while solving.</li>
      </ul>

      <a
        class="about-link"
        href="https://github.com/ali4zimi/linkedin-queen-clone"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="about-link-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.59 2 12.25c0 4.52 2.87 8.35 6.84 9.7c.5.1.68-.22.68-.49c0-.24-.01-1.03-.01-1.87c-2.78.62-3.37-1.21-3.37-1.21c-.45-1.19-1.11-1.5-1.11-1.5c-.91-.64.07-.63.07-.63c1 .07 1.53 1.06 1.53 1.06c.9 1.57 2.35 1.12 2.92.86c.09-.67.35-1.12.64-1.38c-2.22-.26-4.55-1.14-4.55-5.08c0-1.12.39-2.03 1.03-2.75c-.11-.26-.45-1.31.1-2.73c0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 7.85c.85 0 1.7.12 2.5.36c1.9-1.33 2.74-1.05 2.74-1.05c.56 1.42.22 2.47.11 2.73c.64.72 1.03 1.63 1.03 2.75c0 3.95-2.33 4.82-4.56 5.07c.36.32.68.95.68 1.92c0 1.39-.01 2.5-.01 2.84c0 .27.18.6.69.49A10.3 10.3 0 0 0 22 12.25C22 6.59 17.52 2 12 2"
            />
          </svg>
        </span>
        View source on GitHub
      </a>
    </section>
  </main>
</template>

<style scoped>
.about-hero {
  margin-bottom: 0.75rem;
  padding: 1.1rem;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 1rem;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(255, 249, 230, 0.88));
}

.about-lead {
  margin: 0;
  color: #374151;
}

.about-purpose {
  margin: 0.55rem 0 0;
  color: #4b5563;
}

.about-highlights {
  margin-top: 1rem;
  margin-bottom: 0;
  padding-left: 1.1rem;
  color: #4b5563;
  font-size: 0.92rem;
}

.about-highlights li + li {
  margin-top: 0.35rem;
}

.about-link {
  margin-top: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  width: fit-content;
  padding: 0.45rem 0.7rem;
  border-radius: 0.55rem;
  border: 1px solid rgba(17, 24, 39, 0.12);
  color: #111827;
  text-decoration: none;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.9);
}

.about-link:hover {
  background: #ffffff;
}

.about-link-icon {
  width: 1rem;
  height: 1rem;
  display: inline-grid;
  place-items: center;
}

.about-link-icon svg {
  width: 100%;
  height: 100%;
}
</style>
