import { useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useLeaveTypes } from '@/hooks/use-leave-types';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { Calendar, Plus, Edit, Trash2, Loader2, FileText, CheckCircle, XCircle } from 'lucide-react';
import type { LeaveType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export default function LeaveTypes() {
  const { isViewer } = useAuth();
  const { leaveTypes, loading, refetch } = useLeaveTypes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [deletingType, setDeletingType] = useState<LeaveType | null>(null);
  const [processing, setProcessing] = useState(false);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [annualAllocation, setAnnualAllocation] = useState('');
  const [requiresDocument, setRequiresDocument] = useState(false);

  const handleCreate = () => {
    setEditingType(null);
    setName('');
    setDescription('');
    setAnnualAllocation('');
    setRequiresDocument(false);
    setDialogOpen(true);
  };

  const handleEdit = (type: LeaveType) => {
    setEditingType(type);
    setName(type.name);
    setDescription(type.description || '');
    setAnnualAllocation(type.annual_allocation.toString());
    setRequiresDocument(type.requires_document);
    setDialogOpen(true);
  };

  const handleDelete = (type: LeaveType) => {
    setDeletingType(type);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Leave type name is required');
      return;
    }

    const allocation = parseInt(annualAllocation);
    if (isNaN(allocation) || allocation < 1 || allocation > 365) {
      toast.error('Annual allocation must be between 1 and 365 days');
      return;
    }

    setProcessing(true);
    try {
      if (editingType) {
        const { error } = await supabase
          .from('leave_types')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            annual_allocation: allocation,
            requires_document: requiresDocument
          })
          .eq('id', editingType.id);

        if (error) throw error;
        toast.success('Leave type updated successfully');
      } else {
        const { error } = await supabase
          .from('leave_types')
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            annual_allocation: allocation,
            requires_document: requiresDocument
          });

        if (error) throw error;
        toast.success('Leave type created successfully');
      }

      setDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to save leave type');
    } finally {
      setProcessing(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingType) return;

    setProcessing(true);
    try {
      // Check if leave type has applications
      const { data: applications } = await supabase
        .from('leave_applications')
        .select('id', { count: 'exact', head: true })
        .eq('leave_type_id', deletingType.id);

      if (applications && applications.length > 0) {
        toast.error('Cannot delete leave type with existing applications');
        setDeleteDialogOpen(false);
        setProcessing(false);
        return;
      }

      const { error } = await supabase
        .from('leave_types')
        .delete()
        .eq('id', deletingType.id);

      if (error) throw error;

      toast.success('Leave type deleted successfully');
      setDeleteDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete leave type');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-playfair-display font-bold gradient-text">Leave Types</h1>
            <p className="mt-2 text-muted-foreground">{isViewer ? 'View leave type configurations' : 'Manage leave type configurations'}</p>
          </div>
          {!isViewer && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Leave Type
            </Button>
          )}
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Loading leave types...</p>
            </CardContent>
          </Card>
        ) : leaveTypes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No leave types found</p>
              {!isViewer && (
                <Button onClick={handleCreate} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Leave Type
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {leaveTypes.map((type) => (
              <Card key={type.id} className="h-full flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Calendar className="h-8 w-8 text-primary" />
                    {!isViewer && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(type)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(type)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <CardTitle className="font-playfair-display">{type.name}</CardTitle>
                  {type.description && (
                    <CardDescription className="text-pretty">{type.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <span className="text-sm font-medium">Annual Allocation</span>
                    <span className="text-lg font-bold text-primary">{type.annual_allocation} days</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {type.requires_document ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-green-600">Document Required</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Document Optional</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-playfair-display">
                {editingType ? 'Edit Leave Type' : 'Create Leave Type'}
              </DialogTitle>
              <DialogDescription>
                {editingType ? 'Update leave type configuration' : 'Add a new leave type to the system'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Leave Type Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Casual Leave"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this leave type..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="resize-none px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allocation">Annual Allocation (Days) *</Label>
                <Input
                  id="allocation"
                  type="number"
                  min="1"
                  max="365"
                  placeholder="e.g., 12"
                  value={annualAllocation}
                  onChange={(e) => setAnnualAllocation(e.target.value)}
                  className="px-3"
                />
                <p className="text-xs text-muted-foreground">
                  Number of days allocated per year for this leave type
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="requiresDocument"
                  checked={requiresDocument}
                  onCheckedChange={(checked) => setRequiresDocument(checked as boolean)}
                />
                <div className="space-y-1">
                  <label htmlFor="requiresDocument" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Require supporting document
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Staff must upload a document when applying for this leave type
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={processing}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={processing}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingType ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-playfair-display">Delete Leave Type</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingType?.name}"? This action cannot be undone.
                Leave types with existing applications cannot be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={processing} className="bg-destructive hover:bg-destructive/90">
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
