import React from 'react';
import LegalPage from '../components/LegalPage';

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <h2>1. Introduction</h2>
      <p>We respect your privacy and are committed to protecting it through our compliance with this policy. This policy describes the types of information we may collect from you or that you may provide when you visit the application, and our practices for collecting, using, maintaining, protecting, and disclosing that information.</p>
      
      <h2>2. Information We Collect</h2>
      <p>We may collect personal information such as your email address, name, usage data, and payment information via our third-party billing provider (Stripe).</p>

      <h2>3. How We Use Your Information</h2>
      <p>Your information is used to provide you with the application's core features, manage your account, process your subscriptions, and improve our artificial intelligence examination engine. Exam submissions may be retained securely to improve the grading algorithms.</p>
      
      <h2>4. Data Security</h2>
      <p>We have implemented measures designed to secure your personal information from accidental loss and from unauthorized access. The safety and security of your information also depends on you. We urge you to be careful about giving out information in public areas of the application.</p>
    </LegalPage>
  );
}
