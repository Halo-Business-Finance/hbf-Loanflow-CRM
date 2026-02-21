import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ibmDb } from "@/lib/ibm";
import { StandardPageLayout } from "@/components/StandardPageLayout";
import { IBMPageHeader } from "@/components/ui/IBMPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building, Plus, Users, BarChart3, Settings, ChevronRight, Layers } from "lucide-react";

interface BusinessEntity {
  id: string;
  name: string;
  entity_type: string;
  parent_entity_id: string | null;
  is_active: boolean;
  settings: any;
}

interface EntityMembership {
  id: string;
  entity_id: string;
  user_id: string;
  role: string;
  is_primary: boolean;
}

export default function MultiEntityManagement() {
  const { user } = useAuth();
  const [entities, setEntities] = useState<BusinessEntity[]>([]);
  const [memberships, setMemberships] = useState<EntityMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEntity, setNewEntity] = useState({
    name: "",
    entity_type: "branch",
    parent_entity_id: "",
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    const [entitiesRes, membershipsRes] = await Promise.all([
      ibmDb.from("business_entities").select("*").order("name"),
      ibmDb.from("entity_memberships").select("*"),
    ]);

    if (entitiesRes.data) setEntities(entitiesRes.data as unknown as BusinessEntity[]);
    if (membershipsRes.data) setMemberships(membershipsRes.data as unknown as EntityMembership[]);
    setIsLoading(false);
  };

  const createEntity = async () => {
    const { error } = await ibmDb.from("business_entities").insert([{
      name: newEntity.name,
      entity_type: newEntity.entity_type,
      parent_entity_id: newEntity.parent_entity_id || null,
    }]);

    if (error) {
      toast.error("Failed to create business entity");
    } else {
      toast.success("Business entity created");
      setDialogOpen(false);
      setNewEntity({ name: "", entity_type: "branch", parent_entity_id: "" });
      fetchData();
    }
  };

  const getEntityTree = (parentId: string | null = null, level = 0): BusinessEntity[] => {
    const children = entities.filter(e => e.parent_entity_id === parentId);
    let result: BusinessEntity[] = [];
    children.forEach(child => {
      result.push({ ...child, settings: { ...child.settings, level } });
      result = [...result, ...getEntityTree(child.id, level + 1)];
    });
    return result;
  };

  const getEntityTypeColor = (type: string) => {
    switch (type) {
      case "headquarters": return "bg-purple-500/20 text-purple-400";
      case "region": return "bg-blue-500/20 text-blue-400";
      case "branch": return "bg-green-500/20 text-green-400";
      case "department": return "bg-yellow-500/20 text-yellow-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const stats = {
    totalEntities: entities.length,
    headquarters: entities.filter(e => e.entity_type === "headquarters").length,
    regions: entities.filter(e => e.entity_type === "region").length,
    branches: entities.filter(e => e.entity_type === "branch").length,
  };

  // Mock consolidated data
  const consolidatedData = [
    { entity: "West Region", pipeline: 4500000, closed: 1200000, leads: 45 },
    { entity: "East Region", pipeline: 3800000, closed: 980000, leads: 38 },
    { entity: "Central Region", pipeline: 2900000, closed: 750000, leads: 29 },
    { entity: "South Region", pipeline: 2100000, closed: 620000, leads: 21 },
  ];

  if (isLoading) {
    return (
      <StandardPageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </StandardPageLayout>
    );
  }

  return (
    <StandardPageLayout>
      <IBMPageHeader
        title="Multi-Entity Management"
        subtitle="Manage multiple business units with consolidated reporting"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/20">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Entities</p>
                <p className="text-2xl font-bold">{stats.totalEntities}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-500/20">
                <Building className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Headquarters</p>
                <p className="text-2xl font-bold">{stats.headquarters}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Building className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Regions</p>
                <p className="text-2xl font-bold">{stats.regions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-500/20">
                <Building className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Branches</p>
                <p className="text-2xl font-bold">{stats.branches}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="structure" className="space-y-4">
        <TabsList>
          <TabsTrigger value="structure">Organization Structure</TabsTrigger>
          <TabsTrigger value="consolidated">Consolidated Reports</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="structure">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Business Entities</CardTitle>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Add Entity</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Business Entity</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label>Entity Name</Label>
                      <Input
                        value={newEntity.name}
                        onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                        placeholder="e.g., West Coast Region"
                      />
                    </div>
                    <div>
                      <Label>Entity Type</Label>
                      <Select
                        value={newEntity.entity_type}
                        onValueChange={(v) => setNewEntity({ ...newEntity, entity_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="headquarters">Headquarters</SelectItem>
                          <SelectItem value="region">Region</SelectItem>
                          <SelectItem value="branch">Branch</SelectItem>
                          <SelectItem value="department">Department</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Parent Entity (Optional)</Label>
                      <Select
                        value={newEntity.parent_entity_id}
                        onValueChange={(v) => setNewEntity({ ...newEntity, parent_entity_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent entity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None (Top Level)</SelectItem>
                          {entities.map((entity) => (
                            <SelectItem key={entity.id} value={entity.id}>{entity.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={createEntity} className="w-full">Create Entity</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {entities.length === 0 ? (
                <div className="text-center py-8">
                  <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No business entities defined yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Create your first entity to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {getEntityTree().map((entity) => {
                    const level = entity.settings?.level || 0;
                    const memberCount = memberships.filter(m => m.entity_id === entity.id).length;
                    return (
                      <div 
                        key={entity.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                        style={{ marginLeft: `${level * 24}px` }}
                      >
                        <div className="flex items-center gap-3">
                          {level > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <div className={`p-2 rounded-lg ${getEntityTypeColor(entity.entity_type)}`}>
                            <Building className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{entity.name}</p>
                            <p className="text-sm text-muted-foreground capitalize">{entity.entity_type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{memberCount}</span>
                          </div>
                          <Badge variant={entity.is_active ? "default" : "secondary"}>
                            {entity.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consolidated">
          <Card>
            <CardHeader>
              <CardTitle>Consolidated Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {consolidatedData.map((data, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/20">
                        <Building className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{data.entity}</p>
                        <p className="text-sm text-muted-foreground">{data.leads} active leads</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="font-medium">${(data.pipeline / 1000000).toFixed(1)}M</p>
                        <p className="text-xs text-muted-foreground">Pipeline</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-400">${(data.closed / 1000000).toFixed(1)}M</p>
                        <p className="text-xs text-muted-foreground">Closed</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <BarChart3 className="h-4 w-4 mr-1" />Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Total Consolidated</p>
                    <p className="text-sm text-muted-foreground">All entities combined</p>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xl font-bold">${(consolidatedData.reduce((a, b) => a + b.pipeline, 0) / 1000000).toFixed(1)}M</p>
                      <p className="text-xs text-muted-foreground">Total Pipeline</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-400">${(consolidatedData.reduce((a, b) => a + b.closed, 0) / 1000000).toFixed(1)}M</p>
                      <p className="text-xs text-muted-foreground">Total Closed</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Entity Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Configure user permissions for each business entity here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </StandardPageLayout>
  );
}
