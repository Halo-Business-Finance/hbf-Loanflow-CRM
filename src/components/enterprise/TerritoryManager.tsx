import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from '@/lib/auth-utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Map, Users, Building, MapPin } from "lucide-react";

interface Territory {
  id: string;
  name: string;
  description: string;
  parent_id: string;
  territory_type: string;
  rules: any;
  manager_id: string;
  is_active: boolean;
  created_at: string;
}

interface TerritoryAssignment {
  id: string;
  territory_id: string;
  user_id: string;
  role: string;
  assigned_at: string;
  is_active: boolean;
}

export function TerritoryManager() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [assignments, setAssignments] = useState<TerritoryAssignment[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTerritoryDialog, setShowTerritoryDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const { toast } = useToast();

  const [territoryForm, setTerritoryForm] = useState({
    name: "",
    description: "",
    parent_id: "",
    territory_type: "geographic",
    rules: JSON.stringify({
      criteria: [
        {
          field: "location",
          operator: "contains",
          value: "New York"
        }
      ]
    }, null, 2)
  });

  const [assignmentForm, setAssignmentForm] = useState({
    user_id: "",
    role: "member"
  });

  const territoryTypes = [
    { value: "geographic", label: "Geographic" },
    { value: "industry", label: "Industry" },
    { value: "account_size", label: "Account Size" },
    { value: "product", label: "Product" }
  ];

  const assignmentRoles = [
    { value: "owner", label: "Owner" },
    { value: "member", label: "Member" },
    { value: "collaborator", label: "Collaborator" }
  ];

  useEffect(() => {
    fetchTerritories();
  }, []);

  useEffect(() => {
    if (selectedTerritory) {
      fetchAssignments(selectedTerritory);
    }
  }, [selectedTerritory]);

  const fetchTerritories = async () => {
    try {
      const { data, error } = await supabase
        .from('territories')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTerritories(data || []);
    } catch (error) {
      console.error('Error fetching territories:', error);
      toast({
        title: "Error",
        description: "Failed to fetch territories",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async (territoryId: string) => {
    try {
      const { data, error } = await supabase
        .from('territory_assignments')
        .select('*')
        .eq('territory_id', territoryId)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch territory assignments",
        variant: "destructive"
      });
    }
  };

  const handleCreateTerritory = async () => {
    try {
      const user = await getAuthUser();
      if (!user) throw new Error('Not authenticated');

      let rules;
      try {
        rules = JSON.parse(territoryForm.rules);
      } catch (e) {
        throw new Error('Invalid JSON in rules');
      }

      const { error } = await supabase
        .from('territories')
        .insert({
          name: territoryForm.name,
          description: territoryForm.description,
          parent_id: territoryForm.parent_id || null,
          territory_type: territoryForm.territory_type,
          rules: rules,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Territory created successfully"
      });

      setShowTerritoryDialog(false);
      resetTerritoryForm();
      fetchTerritories();
    } catch (error) {
      console.error('Error creating territory:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create territory",
        variant: "destructive"
      });
    }
  };

  const handleCreateAssignment = async () => {
    if (!selectedTerritory) return;

    try {
      const user = await getAuthUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('territory_assignments')
        .insert({
          territory_id: selectedTerritory,
          user_id: assignmentForm.user_id,
          role: assignmentForm.role,
          assigned_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Territory assignment created successfully"
      });

      setShowAssignmentDialog(false);
      resetAssignmentForm();
      fetchAssignments(selectedTerritory);
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast({
        title: "Error",
        description: "Failed to create territory assignment",
        variant: "destructive"
      });
    }
  };

  const resetTerritoryForm = () => {
    setTerritoryForm({
      name: "",
      description: "",
      parent_id: "",
      territory_type: "geographic",
      rules: JSON.stringify({
        criteria: [
          {
            field: "location",
            operator: "contains",
            value: "New York"
          }
        ]
      }, null, 2)
    });
  };

  const resetAssignmentForm = () => {
    setAssignmentForm({
      user_id: "",
      role: "member"
    });
  };

  const getTerritoryIcon = (type: string) => {
    switch (type) {
      case 'geographic':
        return <MapPin className="h-4 w-4" />;
      case 'industry':
        return <Building className="h-4 w-4" />;
      case 'account_size':
        return <Users className="h-4 w-4" />;
      case 'product':
        return <Map className="h-4 w-4" />;
      default:
        return <Map className="h-4 w-4" />;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Territory Management</h2>
          <p className="text-muted-foreground">
            Geographic and hierarchical territory assignment and management
          </p>
        </div>
        <Dialog open={showTerritoryDialog} onOpenChange={setShowTerritoryDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Territory
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Territory</DialogTitle>
              <DialogDescription>
                Define a new territory with assignment rules
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="territory-name">Territory Name</Label>
                  <Input
                    id="territory-name"
                    value={territoryForm.name}
                    onChange={(e) => setTerritoryForm({ ...territoryForm, name: e.target.value })}
                    placeholder="e.g., Northeast Region"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={territoryForm.description}
                    onChange={(e) => setTerritoryForm({ ...territoryForm, description: e.target.value })}
                    placeholder="Describe this territory..."
                  />
                </div>
                <div>
                  <Label htmlFor="territory-type">Territory Type</Label>
                  <Select
                    value={territoryForm.territory_type}
                    onValueChange={(value) => setTerritoryForm({ ...territoryForm, territory_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {territoryTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="parent-territory">Parent Territory</Label>
                  <Select
                    value={territoryForm.parent_id}
                    onValueChange={(value) => setTerritoryForm({ ...territoryForm, parent_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Parent</SelectItem>
                      {territories.map((territory) => (
                        <SelectItem key={territory.id} value={territory.id}>
                          {territory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="rules">Assignment Rules (JSON)</Label>
                  <Textarea
                    id="rules"
                    value={territoryForm.rules}
                    onChange={(e) => setTerritoryForm({ ...territoryForm, rules: e.target.value })}
                    className="font-mono text-sm min-h-[200px]"
                  />
                </div>
                <Button onClick={handleCreateTerritory} className="w-full">
                  Create Territory
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Territories List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Territories
            </CardTitle>
            <CardDescription>
              Manage your territory structure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {territories.map((territory) => (
                <div
                  key={territory.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedTerritory === territory.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedTerritory(territory.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getTerritoryIcon(territory.territory_type)}
                      <div>
                        <h4 className="font-medium">{territory.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {territoryTypes.find(t => t.value === territory.territory_type)?.label}
                        </p>
                        {territory.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {territory.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={territory.is_active ? "default" : "secondary"}>
                      {territory.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Territory Assignments */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>
                  Assignments
                </CardTitle>
                <CardDescription>
                  {selectedTerritory 
                    ? `User assignments for ${territories.find(t => t.id === selectedTerritory)?.name}`
                    : "Select a territory to manage assignments"
                  }
                </CardDescription>
              </div>
              {selectedTerritory && (
                <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Assign User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign User to Territory</DialogTitle>
                      <DialogDescription>
                        Add a user to this territory with a specific role
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="user-id">User ID</Label>
                        <Input
                          id="user-id"
                          value={assignmentForm.user_id}
                          onChange={(e) => setAssignmentForm({ ...assignmentForm, user_id: e.target.value })}
                          placeholder="Enter user ID"
                        />
                      </div>
                      <div>
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={assignmentForm.role}
                          onValueChange={(value) => setAssignmentForm({ ...assignmentForm, role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {assignmentRoles.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleCreateAssignment} className="w-full">
                        Assign User
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedTerritory ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-mono text-sm">
                        {assignment.user_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {assignmentRoles.find(r => r.value === assignment.role)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(assignment.assigned_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={assignment.is_active ? "default" : "secondary"}>
                          {assignment.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Select a territory to view and manage user assignments
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}