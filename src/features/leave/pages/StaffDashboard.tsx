import { useAuth } from '@/contexts/AuthContext';
import StaffLayout from '@/components/layouts/StaffLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle, Clock } from 'lucide-react';
import { useLeaveStats } from '@/hooks/use-leave-applications';
import { Link } from 'react-router-dom';

export default function StaffDashboard() {
  const { profile } = useAuth();
  const { stats } = useLeaveStats(profile?.id);



  return (
    <StaffLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-playfair-display font-bold gradient-text">Welcome, {profile?.full_name}</h1>
          <p className="mt-2 text-muted-foreground">Manage your leave applications and track your leave balance</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <p className="text-xs text-muted-foreground">Applications</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="h-full md:col-span-2">
            <CardHeader>
              <CardTitle className="font-playfair-display">Quick Actions</CardTitle>
              <CardDescription>Manage your leave applications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/staff/apply-leave">
                <Button className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  Apply for Leave
                </Button>
              </Link>
              <Link to="/staff/history">
                <Button variant="secondary" className="w-full">
                  View Leave History
                </Button>
              </Link>
              <Link to="/staff/calendar">
                <Button variant="secondary" className="w-full">
                  View Leave Calendar
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-playfair-display">College Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full overflow-hidden rounded-md">
              <img
                src="https://miaoda-site-img.s3cdn.medo.dev/images/KLing_63c069cd-dba3-4aaa-9410-edf897cf6890.jpg"
                alt="G.D Sawant College Campus"
                className="h-full w-full object-cover"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  );
}
