import { apiFetch } from '../lib/apiClient';
import { get, set } from 'idb-keyval';

export interface EmailTemplate {
  id: string; // e.g. 'signup_success', 'payment_success', 'billing_approaching'
  name: string;
  subject: string;
  body: string; // can contain variables like {{userEmail}}, {{plan}}
  enabled: boolean;
}

const LOCAL_TEMPLATES_KEY = 'ranzco_email_templates';

const defaultTemplates: EmailTemplate[] = [
  {
    id: 'signup_success',
    name: 'Signup Successful',
    subject: 'Welcome to RANZCO Exam Prep!',
    body: 'Hi {{userEmail}},\n\nWelcome to RANZCO Exam Prep. Your account has been created successfully.\n\nReady to get started? Login and explore our question bank.\n\nCheers,\nExam Prep Team',
    enabled: true
  },
  {
    id: 'payment_success',
    name: 'Payment Successful',
    subject: 'Your Upgrade is Complete',
    body: 'Hi {{userEmail}},\n\nThank you for upgrading! Your payment was successful, and your account is now on the Premium plan.\n\nYou now have unlimited access to all features.\n\nCheers,\nExam Prep Team',
    enabled: true
  },
  {
    id: 'billing_approaching',
    name: 'Billing Period Approaching',
    subject: 'Upcoming Subscription Renewal',
    body: 'Hi {{userEmail}},\n\nThis is a friendly reminder that your Premium subscription will renew soon.\n\nManage your billing settings in your profile anytime.\n\nCheers,\nExam Prep Team',
    enabled: true
  }
];

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  if (true) {
    try {
      const data = await apiFetch('/email_templates').catch(() => null); const error = !data ? { message: 'Fetch failed' } : null;
      if (error) {
        if (!error.message.includes('Could not find the table') && !error.message.includes('relation "public.email_templates" does not exist')) {
          console.error('Supabase getEmailTemplates error:', error.message);
        }
      } else if (data && data.length > 0) {
        return data as EmailTemplate[];
      }
    } catch (e) {
      console.error(e);
    }
  }

  const localVal = await get(LOCAL_TEMPLATES_KEY);
  if (localVal) {
    return JSON.parse(localVal);
  }
  return defaultTemplates;
}

export async function updateEmailTemplate(template: EmailTemplate) {
  if (true) {
    try {
      // Upsert
      await apiFetch('/email_templates/upsert', { method: 'POST', body: JSON.stringify(template) }); const error = null;
      if (error) {
        if (error.message.includes('Could not find the table')) {
          console.warn('Supabase "email_templates" table is missing.');
        } else {
          throw error;
        }
      } else {
        return;
      }
    } catch (e: any) {
      console.error(e.message);
    }
  }

  let templates = await getEmailTemplates();
  const existingIdx = templates.findIndex(t => t.id === template.id);
  if (existingIdx !== -1) {
    templates[existingIdx] = template;
  } else {
    templates.push(template);
  }
  await set(LOCAL_TEMPLATES_KEY, JSON.stringify(templates));
}

// Helper to simulate sending an email or actually send it if backend configured
export async function sendEmailNotification(typeId: string, variables: Record<string, string>) {
  const templates = await getEmailTemplates();
  const template = templates.find(t => t.id === typeId);
  
  if (!template || !template.enabled) {
    return; // Do nothing if disabled or missing
  }
  
  let subject = template.subject;
  let body = template.body;
  
  // Replace variables
  for (const [key, value] of Object.entries(variables)) {
    const rx = new RegExp(`{{${key}}}`, 'g');
    subject = subject.replace(rx, value);
    body = body.replace(rx, value);
  }
  
  // Log it locally
  console.log(`[EMAIL DISPATCHED] To: ${variables.userEmail || 'unknown'} | Subject: ${subject}`);
  
  // Try sending it via our backend API
  try {
    if (variables.userEmail) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: variables.userEmail,
          subject,
          text: body
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));
    }
  } catch (e) {
    console.warn('Failed to dispatch email to backend', e);
  }
}
