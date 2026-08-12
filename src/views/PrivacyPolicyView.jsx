export function PrivacyPolicyView() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem", fontFamily: "system-ui, sans-serif", lineHeight: 1.6, color: "#1a1a2e" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Privacy Policy</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>Last updated: 12 August 2026</p>

      <p>
        Flexachem Workshop (&quot;the App&quot;) is an internal workshop management tool
        operated by Pádraig Brosnan (&quot;we&quot;, &quot;us&quot;). This policy explains what
        data we collect, why, and how we protect it.
      </p>

      <h2>1. Data We Collect</h2>
      <ul>
        <li><strong>Account information:</strong> email address, name, and password (hashed; we never store or see your plaintext password).</li>
        <li><strong>Usage data:</strong> job records, schedule entries, and notes you create within the App as part of normal workshop operations.</li>
        <li><strong>Device tokens:</strong> if you opt in to push notifications on Android, we store a Firebase Cloud Messaging token linked to your account so we can deliver notifications.</li>
        <li><strong>Crash reports:</strong> if the App encounters an error, we send diagnostic data (error message, stack trace, your user ID and email) to Sentry for debugging. No performance traces or session replays are collected.</li>
        <li><strong>Theme preference:</strong> your chosen light/dark theme setting.</li>
      </ul>

      <h2>2. Data We Do Not Collect</h2>
      <p>
        We do not collect location data, contacts, photos, files, financial information, health
        data, browsing history, search history, advertising identifiers, or any analytics beyond
        crash reporting. The App contains no advertisements.
      </p>

      <h2>3. How We Use Your Data</h2>
      <ul>
        <li><strong>Authentication:</strong> your email and password let you sign in securely.</li>
        <li><strong>App functionality:</strong> your name is shown in the UI for job assignment and team coordination.</li>
        <li><strong>Push notifications:</strong> device tokens are used solely to deliver in-app notifications you have opted in to receive.</li>
        <li><strong>Error monitoring:</strong> crash data helps us find and fix bugs.</li>
      </ul>

      <h2>4. Third-Party Services</h2>
      <p>Your data is processed by these services, each under their own privacy policies:</p>
      <ul>
        <li><strong>Supabase</strong> (supabase.com) &mdash; authentication and database hosting.</li>
        <li><strong>Sentry</strong> (sentry.io) &mdash; crash reporting and error monitoring.</li>
        <li><strong>Firebase Cloud Messaging</strong> (firebase.google.com) &mdash; push notification delivery (Android only).</li>
        <li><strong>Vercel</strong> (vercel.com) &mdash; web hosting.</li>
      </ul>
      <p>We do not sell, rent, or share your personal data with any other third parties.</p>

      <h2>5. Data Storage and Security</h2>
      <p>
        All data is transmitted over HTTPS. Passwords are hashed by Supabase Auth before
        storage. Database access is governed by row-level security policies that restrict
        each user to their authorised data.
      </p>

      <h2>6. Data Retention and Deletion</h2>
      <p>
        Your account data is retained for as long as your account is active. Push notification
        tokens are deleted when you sign out. To request deletion of your account and all
        associated data, contact us at the email below.
      </p>

      <h2>7. Children</h2>
      <p>
        The App is not directed at children under 13 and we do not knowingly collect data from
        children.
      </p>

      <h2>8. Changes to This Policy</h2>
      <p>
        We may update this policy from time to time. The &quot;Last updated&quot; date at the
        top reflects the most recent revision.
      </p>

      <h2>9. Contact</h2>
      <p>
        If you have questions about this policy or your data, contact:<br />
        <strong>Pádraig Brosnan</strong><br />
        <a href="mailto:padraigbrosnan@gmail.com">padraigbrosnan@gmail.com</a>
      </p>
    </div>
  );
}
