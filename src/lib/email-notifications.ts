import { supabase } from '@/db/supabase';

export type RegistrationRole = 'staff' | 'principal';
export type RegistrationDecisionStatus = 'approved' | 'rejected';

export async function sendRegistrationReviewEmail(params: {
  applicantUsername: string;
  applicantRole: RegistrationRole;
}) {
  const { data, error } = await supabase.functions.invoke('send-registration-review-email', {
    body: params,
  });

  if (error) {
    throw error;
  }

  if (data?.warning) {
    throw new Error(data.warning);
  }

  if (data?.success === false) {
    throw new Error('Registration review email was not sent. Please check approved reviewer email setup.');
  }

  return data;
}

export async function sendRegistrationDecisionEmail(params: {
  applicantProfileId: string;
  status: RegistrationDecisionStatus;
  reviewerRoleLabel: 'Principal' | 'Principal / UH' | 'Director';
  reviewerName?: string | null;
}) {
  const { error } = await supabase.functions.invoke('send-registration-decision-email', {
    body: params,
  });

  if (error) {
    throw error;
  }
}
