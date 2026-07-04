import React, { useMemo, useState } from 'react';
import { submitFounderMessage } from '../../lib/api';
import { parseApiError } from '../../lib/apiErrorParsing';
import '../../styles/MessageTheFounder.css';

const SCOUT_IMG = '/assets/perk-machine/savvy-scout-alive.png';

export const FOUNDER_MESSAGE_SUBJECTS = Object.freeze([
  { value: 'general_feedback', label: 'General Feedback' },
  { value: 'investment_inquiry', label: 'Investment Inquiry' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'retailer', label: 'Retailer' },
  { value: 'media', label: 'Media' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'other', label: 'Other' },
]);

const INITIAL = {
  subject: 'general_feedback',
  name: '',
  email: '',
  company: '',
  message: '',
  screenshot: null,
};

function validateForm(fields) {
  const errors = {};
  if (!fields.subject) errors.subject = 'Choose a subject.';
  if (String(fields.name || '').trim().length < 2) errors.name = 'Name is required.';
  const email = String(fields.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Valid email is required.';
  const msg = String(fields.message || '').trim();
  if (msg.length < 20) errors.message = 'Message must be at least 20 characters.';
  if (msg.length > 5000) errors.message = 'Message is too long.';
  if (fields.screenshot && fields.screenshot.size > 2 * 1024 * 1024) {
    errors.screenshot = 'Screenshot must be under 2 MB.';
  }
  return errors;
}

export default function MessageTheFounderSection() {
  const [fields, setFields] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [pulse, setPulse] = useState(false);

  const screenshotLabel = useMemo(() => {
    if (!fields.screenshot) return 'No file chosen';
    return fields.screenshot.name;
  }, [fields.screenshot]);

  const updateField = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validateForm(fields);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setFormError('');

    const body = new FormData();
    body.append('subject', fields.subject);
    body.append('name', fields.name.trim());
    body.append('email', fields.email.trim());
    body.append('company', fields.company.trim());
    body.append('message', fields.message.trim());
    if (fields.screenshot) body.append('screenshot', fields.screenshot);

    try {
      const result = await submitFounderMessage(body);
      setConfirmation({
        referenceId: result.referenceId,
        submittedAt: result.submittedAt,
      });
      setFields(INITIAL);
      setPulse(true);
      window.setTimeout(() => setPulse(false), 2400);
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.message || 'Could not send your message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmation) {
    return (
      <section
        className="home-card founder-scout founder-scout--success"
        aria-labelledby="founder-scout-success-title"
      >
        <div className={`founder-scout__transmit${pulse ? ' founder-scout__transmit--pulse' : ''}`}>
          <div className="founder-scout__rings" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <img src={SCOUT_IMG} alt="" className="founder-scout__avatar" />
        </div>
        <h2 id="founder-scout-success-title" className="founder-scout__title">
          Transmission complete
        </h2>
        <p className="founder-scout__success-line">
          Your message has been delivered to the Final10 team.
        </p>
        <div className="founder-scout__ref" role="status">
          <span className="founder-scout__ref-label">Message reference</span>
          <code className="founder-scout__ref-id">{confirmation.referenceId}</code>
        </div>
        <p className="founder-scout__thank-you">
          Thank you for reaching out through the Savvy Universe relay. Our team reviews every
          transmission — expect a reply if follow-up is needed.
        </p>
        <button
          type="button"
          className="founder-scout__submit"
          onClick={() => setConfirmation(null)}
        >
          Send another message
        </button>
      </section>
    );
  }

  return (
    <section className="home-card founder-scout" aria-labelledby="founder-scout-title">
      <div className="founder-scout__header">
        <img src={SCOUT_IMG} alt="" className="founder-scout__avatar founder-scout__avatar--idle" />
        <div>
          <h2 id="founder-scout-title" className="founder-scout__title">
            🤖 Send a Message Through Savvy Scout
          </h2>
          <p className="founder-scout__subtitle">
            Whether you have feedback, partnership ideas, or investment inquiries, Savvy Scout will
            securely deliver your message to the Final10 team.
          </p>
        </div>
      </div>

      <form className="founder-scout__form" onSubmit={handleSubmit} noValidate>
        <div className="founder-scout__field">
          <label htmlFor="founder-scout-subject">Subject</label>
          <select
            id="founder-scout-subject"
            value={fields.subject}
            onChange={(e) => updateField('subject', e.target.value)}
            required
          >
            {FOUNDER_MESSAGE_SUBJECTS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.subject ? <p className="founder-scout__error">{errors.subject}</p> : null}
        </div>

        <div className="founder-scout__row">
          <div className="founder-scout__field">
            <label htmlFor="founder-scout-name">Name</label>
            <input
              id="founder-scout-name"
              type="text"
              autoComplete="name"
              value={fields.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              maxLength={120}
            />
            {errors.name ? <p className="founder-scout__error">{errors.name}</p> : null}
          </div>
          <div className="founder-scout__field">
            <label htmlFor="founder-scout-email">Email</label>
            <input
              id="founder-scout-email"
              type="email"
              autoComplete="email"
              value={fields.email}
              onChange={(e) => updateField('email', e.target.value)}
              required
              maxLength={254}
            />
            {errors.email ? <p className="founder-scout__error">{errors.email}</p> : null}
          </div>
        </div>

        <div className="founder-scout__field">
          <label htmlFor="founder-scout-company">
            Company <span className="founder-scout__optional">(optional)</span>
          </label>
          <input
            id="founder-scout-company"
            type="text"
            autoComplete="organization"
            value={fields.company}
            onChange={(e) => updateField('company', e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="founder-scout__field">
          <label htmlFor="founder-scout-message">Message</label>
          <textarea
            id="founder-scout-message"
            rows={5}
            value={fields.message}
            onChange={(e) => updateField('message', e.target.value)}
            required
            minLength={20}
            maxLength={5000}
            placeholder="Tell the Final10 team what's on your mind…"
          />
          {errors.message ? <p className="founder-scout__error">{errors.message}</p> : null}
        </div>

        <div className="founder-scout__field">
          <label htmlFor="founder-scout-screenshot">
            Screenshot <span className="founder-scout__optional">(optional)</span>
          </label>
          <div className="founder-scout__file">
            <input
              id="founder-scout-screenshot"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => updateField('screenshot', e.target.files?.[0] || null)}
            />
            <span className="founder-scout__file-name">{screenshotLabel}</span>
          </div>
          {errors.screenshot ? <p className="founder-scout__error">{errors.screenshot}</p> : null}
        </div>

        {formError ? (
          <p className="founder-scout__error founder-scout__error--banner" role="alert">
            {formError}
          </p>
        ) : null}

        <button type="submit" className="founder-scout__submit" disabled={submitting}>
          {submitting ? 'Transmitting…' : 'Transmit via Savvy Scout'}
        </button>
        <p className="founder-scout__secure-note">
          Encrypted relay · No personal founder email exposed · Reference ID on delivery
        </p>
      </form>
    </section>
  );
}
