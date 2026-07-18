import React from 'react';
import LegalPage from '../components/LegalPage';

export default function TermsConditions() {
  return (
    <LegalPage title="Terms & Conditions">
      <h2>1. Acceptance of Terms</h2>
      <p>By accessing or using our application, you agree to be bound by these Terms. If you do not agree, you must immediately cease using the application.</p>
      
      <h2>2. Use License</h2>
      <ul>
        <li>You may not modify, distribute, or create derivative works of our content.</li>
        <li>Your use of the Pro tier AI generation must be fair and not involve automated scraping or abusive query volumes.</li>
      </ul>

      <h2>3. Disclaimer regarding AI</h2>
      <p>The AI-generated questions and grading provided in the Pro tier are for educational purposes only. They are not intended as substitute for official medical advice or official RANZCO college feedback. We do not guarantee the 100% accuracy of the AI model's answers or gradings.</p>

      <h2>4. Termination</h2>
      <p>We reserve the right to terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
    </LegalPage>
  );
}
