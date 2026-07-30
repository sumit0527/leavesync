import { useMemo, useState } from 'react';
import { HelpCircle, Plus, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import StaffLayout from '@/components/layouts/StaffLayout';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';

const faqItems = [
  { category: 'leaves', q: 'How do I apply for leave?', a: 'Open Apply Leave, select the leave type and dates, provide a clear reason, attach a document when required, and submit.' },
  { category: 'leaves', q: 'Can I apply for leave on the same day?', a: 'Yes, except between 10:00 AM and 5:00 PM. During that period, today is unavailable in the date picker.' },
  { category: 'leaves', q: 'What are Duty Leave and C-Off?', a: 'These leave types have no fixed yearly allocation. A reason and supporting document are mandatory for every request.' },
  { category: 'leaves', q: 'What happens when my allocated leave balance is insufficient?', a: 'The portal shows an extra-leave request option. Staff requests go to their unit Principal/UH, while Principal/UH requests go to Directors.' },
  { category: 'calendar', q: 'Is Saturday a working day?', a: 'Yes. Saturday is treated as a working day. Sunday and configured public holidays are non-working days.' },
  { category: 'calendar', q: 'What do calendar colours mean?', a: 'Highlighted dates show approved leave, holidays, or Sunday. Select a date to view the available details.' },
  { category: 'applications', q: 'How can I check my leave status?', a: 'Open Leave History. Every request is shown as Pending, Approved, or Rejected with its dates and leave type.' },
  { category: 'applications', q: 'Who reviews a leave request?', a: 'Staff leave is reviewed by their unit Principal/UH. Principal/UH leave is reviewed by a Director. Staff requests pending for 24 hours can also become available for Director review.' },
  { category: 'documents', q: 'Which document formats are supported?', a: 'PDF, JPG, JPEG, and PNG files up to 5 MB are supported.' },
  { category: 'account', q: 'Why can I not log in after registration?', a: 'Your registration may still be pending, rejected, or duplicated. Contact the concerned authority if the status is unclear.' },
  { category: 'reports', q: 'What information is available in reports and analytics?', a: 'Authorised management users can view unit-wise, department-wise, status-wise, leave-type and date-based summaries according to their role.' },
  { category: 'privacy', q: 'Can Viewer users change portal data?', a: 'No. Viewer access is read-only and is intended for monitoring and report downloads.' },
];

export default function FAQ() {
  const { profile, isStaff } = useAuth();
  const [category, setCategory] = useState('all');
  const [questionCategory, setQuestionCategory] = useState('leaves');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const filtered = useMemo(() => category === 'all' ? faqItems : faqItems.filter((item) => item.category === category), [category]);

  const submitQuestion = async () => {
    if (!question.trim() || question.trim().length < 10) { toast.error('Please enter a clear question of at least 10 characters'); return; }
    setSubmitting(true);
    try {
      const { data: saved, error } = await supabase.from('faq_questions').insert({
        submitted_by: profile?.id, category: questionCategory, question: question.trim(), status: 'new'
      }).select('id').single();
      if (error) throw error;
      const { error: emailError } = await supabase.functions.invoke('send-faq-question-email', { body: { questionId: saved.id } });
      if (emailError) console.error('FAQ email notification failed:', emailError);
      toast.success('Your question was submitted to the Director');
      setQuestion('');
    } catch (error) {
      console.error(error); toast.error('Failed to submit your question');
    } finally { setSubmitting(false); }
  };

  const content = <div className="mx-auto max-w-4xl space-y-6">
    <div><h1 className="flex items-center gap-2 text-3xl font-playfair-display font-bold gradient-text"><HelpCircle className="h-8 w-8" />Frequently Asked Questions</h1><p className="mt-2 text-muted-foreground">Find clear answers about using the leaveSYNC portal.</p></div>
    <Card><CardHeader><CardTitle>Browse FAQs</CardTitle><CardDescription>Select a category to keep the information organised.</CardDescription></CardHeader><CardContent className="space-y-4">
      <Select value={category} onValueChange={setCategory}><SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="all">All Categories</SelectItem><SelectItem value="leaves">Leaves</SelectItem><SelectItem value="calendar">Calendar</SelectItem><SelectItem value="applications">Applications & Approvals</SelectItem><SelectItem value="documents">Documents</SelectItem><SelectItem value="account">Account & Login</SelectItem><SelectItem value="reports">Reports & Analytics</SelectItem><SelectItem value="privacy">Access & Privacy</SelectItem>
      </SelectContent></Select>
      <Accordion type="single" collapsible className="w-full">{filtered.map((item, index) => <AccordionItem key={`${item.category}-${index}`} value={`faq-${index}`}><AccordionTrigger className="text-left"><span className="flex items-start gap-2"><Plus className="mt-0.5 h-4 w-4 shrink-0" />{item.q}</span></AccordionTrigger><AccordionContent className="pl-6 text-muted-foreground">{item.a}</AccordionContent></AccordionItem>)}</Accordion>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Still have a question?</CardTitle><CardDescription>Submit it here. The question will be recorded and emailed to the Directors.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="space-y-2"><Label>Question category</Label><Select value={questionCategory} onValueChange={setQuestionCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="leaves">Leaves</SelectItem><SelectItem value="calendar">Calendar</SelectItem><SelectItem value="applications">Applications</SelectItem><SelectItem value="documents">Documents</SelectItem><SelectItem value="account">Account</SelectItem><SelectItem value="reports">Reports</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label>Your question</Label><Textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Write your portal-related question..." rows={4} maxLength={1000} /></div>
      <Button onClick={submitQuestion} disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Submit Question</Button>
    </CardContent></Card>
  </div>;
  return isStaff ? <StaffLayout>{content}</StaffLayout> : <AdminLayout>{content}</AdminLayout>;
}
