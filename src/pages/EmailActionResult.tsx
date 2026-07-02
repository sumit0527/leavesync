import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';

type Tone = 'success' | 'danger' | 'warning';

const toneStyles: Record<Tone, {
  icon: string;
  iconBg: string;
  title: string;
  border: string;
}> = {
  success: {
    icon: '✓',
    iconBg: 'bg-green-100 text-green-700',
    title: 'text-green-700',
    border: 'border-green-200',
  },
  danger: {
    icon: '×',
    iconBg: 'bg-red-100 text-red-700',
    title: 'text-red-700',
    border: 'border-red-200',
  },
  warning: {
    icon: 'i',
    iconBg: 'bg-amber-100 text-amber-700',
    title: 'text-amber-700',
    border: 'border-amber-200',
  },
};

const fallbackTitle: Record<string, string> = {
  success: 'Request Handled Successfully',
  'already-handled': 'Request Already Handled',
  expired: 'Link Expired',
  invalid: 'Invalid Action Link',
  error: 'Action Failed',
};

const fallbackMessage: Record<string, string> = {
  success: 'The request was handled successfully.',
  'already-handled': 'This request has already been handled. No further action is needed.',
  expired: 'This email action link has expired. Please open the portal and review the request from there.',
  invalid: 'This email action link is invalid. Please open the portal and review the request from there.',
  error: 'Something went wrong while handling this request. Please open the portal and review the request from there.',
};

const EmailActionResult: React.FC = () => {
  const [searchParams] = useSearchParams();

  const result = searchParams.get('result') || 'success';
  const tone = (searchParams.get('tone') as Tone) || (result === 'success' ? 'success' : result === 'already-handled' || result === 'expired' ? 'warning' : 'danger');
  const style = toneStyles[tone] ?? toneStyles.success;

  const title = searchParams.get('title') || fallbackTitle[result] || 'Request Status';
  const message = searchParams.get('message') || fallbackMessage[result] || 'Please open the portal to check the latest status.';

  const details = [
    ['Action', searchParams.get('action')],
    ['Request Type', searchParams.get('type')],
    ['Applicant', searchParams.get('applicant')],
    ['Current Status', searchParams.get('currentStatus')],
    ['Handled On', searchParams.get('handledOn')],
    ['Applicant Email', searchParams.get('applicantEmail')],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="min-h-screen bg-[#f8f4ea] px-4 py-10 flex items-center justify-center">
      <div className={`w-full max-w-2xl rounded-3xl border ${style.border} bg-white p-7 sm:p-9 shadow-xl shadow-amber-950/10 text-center`}>
        <div className="text-xs sm:text-sm font-bold uppercase tracking-[0.28em] text-amber-700 mb-4">
          leaveSYNC
        </div>

        <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ${style.iconBg}`}>
          <span className="text-4xl font-bold leading-none">{style.icon}</span>
        </div>

        <h1 className={`text-2xl sm:text-3xl font-bold leading-tight ${style.title}`}>
          {title}
        </h1>

        <p className="mt-4 text-base leading-7 text-slate-700">
          {message}
        </p>

        {details.length > 0 && (
          <div className="mt-7 overflow-hidden rounded-2xl border border-amber-100 text-left">
            {details.map(([label, value]) => (
              <div key={label} className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1 sm:gap-4 border-b border-amber-100 px-4 py-3 last:border-b-0">
                <div className="text-sm font-bold text-amber-800">{label}</div>
                <div className="text-sm text-slate-700">{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/admin/login"
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-amber-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-800"
          >
            Open Admin Login
          </Link>
          <Link
            to="/"
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-amber-200 px-6 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-50"
          >
            Back to Home
          </Link>
        </div>

        <div className="mt-8 border-t border-amber-100 pt-5 text-xs leading-6 text-slate-400">
          G.D. Sawant College Leave Management Portal
          <br />
          You can safely close this page after reviewing the message.
        </div>
      </div>
    </div>
  );
};

export default EmailActionResult;
