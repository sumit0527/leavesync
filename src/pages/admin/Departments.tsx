import { useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDepartments } from '@/hooks/use-departments';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { Building2, Plus, Edit, Trash2, Loader2, Users } from 'lucide-react';
import type { Department } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { COLLEGE_UNITS, formatCollegeUnit, type CollegeUnit } from '@/lib/college-units';

export default function Departments() {
  const { isViewer, isPrincipal } = useAuth();
  const isConfigReadOnly = isViewer || isPrincipal;
  const { departments, loading, refetch } = useDepartments();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [processing, setProcessing] = useState(false);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState<CollegeUnit>('senior');
  const [filterUnit, setFilterUnit] = useState<'all' | CollegeUnit>('all');

  const handleCreate = () => {
    if (isConfigReadOnly) return;
    setEditingDept(null);
    setName('');
    setDescription('');
    setUnit('senior');
    setDialogOpen(true);
  };

  const handleEdit = (dept: Department) => {
    if (isConfigReadOnly) return;
    setEditingDept(dept);
    setName(dept.name);
    setDescription(dept.description || '');
    setUnit(((dept as any).college_unit as CollegeUnit) || 'senior');
    setDialogOpen(true);
  };

  const handleDelete = (dept: Department) => {
    if (isConfigReadOnly) return;
    setDeletingDept(dept);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (isConfigReadOnly) {
      toast.error('Only Director can modify departments');
      return;
    }
    if (!name.trim()) {
      toast.error('Department name is required');
      return;
    }

    setProcessing(true);
    try {
      if (editingDept) {
        const { error } = await supabase
          .from('departments')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            college_unit: unit
          })
          .eq('id', editingDept.id);

        if (error) throw error;
        toast.success('Department updated successfully');
      } else {
        const { error } = await supabase
          .from('departments')
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            college_unit: unit
          });

        if (error) throw error;
        toast.success('Department created successfully');
      }

      setDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to save department');
    } finally {
      setProcessing(false);
    }
  };

  const confirmDelete = async () => {
    if (isConfigReadOnly) {
      toast.error('Only Director can delete departments');
      return;
    }
    if (!deletingDept) return;

    setProcessing(true);
    try {
      // Check if department has employees
      const { data: employees } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('department_id', deletingDept.id);

      if (employees && employees.length > 0) {
        toast.error('Cannot delete department with assigned employees');
        setDeleteDialogOpen(false);
        setProcessing(false);
        return;
      }

      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', deletingDept.id);

      if (error) throw error;

      toast.success('Department deleted successfully');
      setDeleteDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete department');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-playfair-display font-bold gradient-text">Departments</h1>
            <p className="mt-2 text-muted-foreground">{isConfigReadOnly ? 'View college departments' : 'Manage college departments'}</p>
          </div>
          {!isConfigReadOnly && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Department
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
              <div className="space-y-2">
                <Label>College Unit Filter</Label>
                <Select value={filterUnit} onValueChange={(value) => setFilterUnit(value as 'all' | CollegeUnit)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All units" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Units</SelectItem>
                    {COLLEGE_UNITS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="self-end text-sm text-muted-foreground">Create departments under the correct unit so staff registration and reports stay clean.</p>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Loading departments...</p>
            </CardContent>
          </Card>
        ) : departments.filter((dept) => filterUnit === 'all' || (dept as any).college_unit === filterUnit).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No departments found</p>
              {!isConfigReadOnly && (
                <Button onClick={handleCreate} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Department
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {departments.filter((dept) => filterUnit === 'all' || (dept as any).college_unit === filterUnit).map((dept) => (
              <Card key={dept.id} className="h-full flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Building2 className="h-8 w-8 text-primary" />
                    {!isConfigReadOnly && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(dept)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(dept)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <CardTitle className="font-playfair-display">{dept.name}</CardTitle>
                  <p className="text-xs font-medium text-primary">{formatCollegeUnit((dept as any).college_unit)}</p>
                  {dept.description && (
                    <CardDescription className="text-pretty">{dept.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="mt-auto">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Department ID: {dept.id.slice(0, 8)}...</span>
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
                {editingDept ? 'Edit Department' : 'Create Department'}
              </DialogTitle>
              <DialogDescription>
                {editingDept ? 'Update department information' : 'Add a new department to the system'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>College Unit *</Label>
                <Select value={unit} onValueChange={(value) => setUnit(value as CollegeUnit)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select college unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {COLLEGE_UNITS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Department Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Computer Science"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the department..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="resize-none px-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={processing}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={processing}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingDept ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-playfair-display">Delete Department</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingDept?.name}"? This action cannot be undone.
                Departments with assigned employees cannot be deleted.
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
