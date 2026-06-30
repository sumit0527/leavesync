import { supabase } from '@/db/supabase';

export type RegistrationRole = 'staff' | 'principal';
export type RegistrationDecisionStatus = 'approved' | 'rejected';

export async function sendRegistrationReviewEmail(params: {
  applicantUsername: string;
  applicantRole: RegistrationRole;
}) {
  const { error } = await supabase.functions.invoke('send-registration-review-email', {
    body: params,
  });

  if (error) {
    throw error;
  }
}

export async function sendRegistrationDecisionEmail(params: {
  applicantProfileId: string;
  status: RegistrationDecisionStatus;
  reviewerRoleLabel: 'Principal' | 'Director';
}) {
  const { error } = await supabase.functions.invoke('send-registration-decision-email', {
    body: params,
  });

  if (error) {
    throw error;
  }
}
