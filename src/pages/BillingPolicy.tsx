import React from 'react';
import LegalPage from '../components/LegalPage';

export default function BillingPolicy() {
  return (
    <LegalPage title="Billing & Refund Policy">
      <h2>1. Subscription Terms</h2>
      <p>The Pro tier subscription is billed on a monthly basis. Payment is charged automatically at the start of each billing cycle until you cancel.</p>
      
      <h2>2. Cancellations</h2>
      <p>You can cancel your subscription at any time. If you cancel prior to the expiry of your current billing period, you will retain access to the Pro tier features until the end of your pro month. No partial refunds are provided for the remaining days of a cancelled month.</p>

      <h2>3. Refunds</h2>
      <p>Generally, payments are non-refundable. If you believe there has been a billing error, please contact support within 7 days of the transaction for review and potential dispute resolution.</p>
      
      <h2>4. Payment Processing</h2>
      <p>We use Stripe to process all transactions securely. We do not store your full credit card information on our servers.</p>
    </LegalPage>
  );
}
