import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Smartphone } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSecureRoleManagement } from '@/hooks/useSecureRoleManagement';
import { UserRole } from '@/hooks/useRoleBasedAccess';
import { MicrosoftAuthenticatorSetup } from '@/components/auth/MicrosoftAuthenticatorSetup';

interface SecureRoleManagerProps {
  targetUserId: string;
  targetUserName: string;
  currentRole?: UserRole;
  onRoleChanged?: () => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string; level: number }[] = [
  { value: 'super_admin', label: 'Super Admin', level: 4 },
  { value: 'admin', label: 'Admin', level: 3 },
  { value: 'manager', label: 'Manager', level: 2 },
  { value: 'loan_originator', label: 'Loan Originator', level: 1 },
  { value: 'loan_processor', label: 'Loan Processor', level: 1 },
  { value: 'funder', label: 'Funder', level: 1 },
  { value: 'underwriter', label: 'Underwriter', level: 1 },
  { value: 'closer', label: 'Closer', level: 1 },
  { value: 'tech', label: 'Tech', level: 0 },
];

export const SecureRoleManager: React.FC<SecureRoleManagerProps> = ({
  targetUserId,
  targetUserName,
  currentRole,
  onRoleChanged
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('');
  const [reason, setReason] = useState('');
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  
  const {
    isLoading,
    assignUserRole,
  } = useSecureRoleManagement();

  const handleAssignRole = async () => {
    if (!selectedRole || !reason.trim()) {
      return;
    }

    const result = await assignUserRole(targetUserId, selectedRole, reason, false);
    
    if (result.success) {
      setSelectedRole('');
      setReason('');
      onRoleChanged?.();
    }
  };


  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Secure Role Management
        </CardTitle>
        <CardDescription>
          Manage user roles for {targetUserName} with enhanced security controls
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Current Role Display */}
        <div className="space-y-2">
          <Label>Current Role</Label>
          <div className="flex items-center gap-2">
            <Badge variant={currentRole === 'super_admin' ? 'destructive' : currentRole === 'admin' ? 'default' : 'secondary'}>
              {currentRole ? ROLE_OPTIONS.find(r => r.value === currentRole)?.label || currentRole : 'No Role'}
            </Badge>
          </div>
        </div>

        {/* Role Assignment Form */}
        <div className="space-y-2">
          <Label htmlFor="new-role">Assign New Role</Label>
          <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
            <SelectTrigger id="new-role">
              <SelectValue placeholder="Select a role to assign" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason for Role Change</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter the reason for this role change..."
            rows={3}
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleAssignRole}
            disabled={!selectedRole || !reason.trim() || isLoading}
            className="flex-1"
          >
            {isLoading ? 'Assigning...' : 'Assign Role'}
          </Button>
          
          {/* MFA Setup disabled to prevent unwanted authenticator entries */}
        </div>

        {/* Security Notice */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            All role changes are logged for security audit. Role assignments follow strict hierarchy rules and cannot be bypassed.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};