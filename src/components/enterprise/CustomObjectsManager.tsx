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
import { Plus, Edit, Trash2, Database, Settings } from "lucide-react";

interface CustomObject {
  id: string;
  name: string;
  api_name: string;
  description: string;
  icon: string;
  is_active: boolean;
  created_at: string;
}

interface CustomField {
  id: string;
  object_id: string;
  name: string;
  api_name: string;
  field_type: string;
  is_required: boolean;
  default_value: string;
  picklist_values: any;
}

export function CustomObjectsManager() {
  const [objects, setObjects] = useState<CustomObject[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showObjectDialog, setShowObjectDialog] = useState(false);
  const [showFieldDialog, setShowFieldDialog] = useState(false);
  const [editingObject, setEditingObject] = useState<CustomObject | null>(null);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const { toast } = useToast();

  const [objectForm, setObjectForm] = useState({
    name: "",
    api_name: "",
    description: "",
    icon: "Database"
  });

  const [fieldForm, setFieldForm] = useState({
    name: "",
    api_name: "",
    field_type: "text",
    is_required: false,
    default_value: "",
    picklist_values: ""
  });

  const fieldTypes = [
    { value: "text", label: "Text" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "boolean", label: "Checkbox" },
    { value: "picklist", label: "Picklist" },
    { value: "textarea", label: "Long Text" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
    { value: "url", label: "URL" }
  ];

  useEffect(() => {
    fetchObjects();
  }, []);

  useEffect(() => {
    if (selectedObject) {
      fetchFields(selectedObject);
    }
  }, [selectedObject]);

  const fetchObjects = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_objects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setObjects(data || []);
    } catch (error) {
      console.error('Error fetching objects:', error);
      toast({
        title: "Error",
        description: "Failed to fetch custom objects",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async (objectId: string) => {
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('object_id', objectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      console.error('Error fetching fields:', error);
      toast({
        title: "Error",
        description: "Failed to fetch custom fields",
        variant: "destructive"
      });
    }
  };

  const handleCreateObject = async () => {
    try {
      const user = await getAuthUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('custom_objects')
        .insert({
          ...objectForm,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Custom object created successfully"
      });

      setShowObjectDialog(false);
      setObjectForm({ name: "", api_name: "", description: "", icon: "Database" });
      fetchObjects();
    } catch (error) {
      console.error('Error creating object:', error);
      toast({
        title: "Error",
        description: "Failed to create custom object",
        variant: "destructive"
      });
    }
  };

  const handleCreateField = async () => {
    if (!selectedObject) return;

    try {
      const user = await getAuthUser();
      if (!user) throw new Error('Not authenticated');

      const picklistValues = fieldForm.field_type === 'picklist' 
        ? fieldForm.picklist_values.split('\n').filter(v => v.trim())
        : null;

      const { error } = await supabase
        .from('custom_fields')
        .insert({
          object_id: selectedObject,
          name: fieldForm.name,
          api_name: fieldForm.api_name,
          field_type: fieldForm.field_type,
          is_required: fieldForm.is_required,
          default_value: fieldForm.default_value || null,
          picklist_values: picklistValues,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Custom field created successfully"
      });

      setShowFieldDialog(false);
      setFieldForm({
        name: "",
        api_name: "",
        field_type: "text",
        is_required: false,
        default_value: "",
        picklist_values: ""
      });
      fetchFields(selectedObject);
    } catch (error) {
      console.error('Error creating field:', error);
      toast({
        title: "Error",
        description: "Failed to create custom field",
        variant: "destructive"
      });
    }
  };

  const generateApiName = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Custom Objects & Fields</h2>
          <p className="text-muted-foreground">
            Create custom data models beyond leads and clients
          </p>
        </div>
        <Dialog open={showObjectDialog} onOpenChange={setShowObjectDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Object
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Custom Object</DialogTitle>
              <DialogDescription>
                Define a new custom data model for your CRM
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="object-name">Object Name</Label>
                <Input
                  id="object-name"
                  value={objectForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setObjectForm({
                      ...objectForm,
                      name,
                      api_name: generateApiName(name)
                    });
                  }}
                  placeholder="e.g., Product, Contract, Invoice"
                />
              </div>
              <div>
                <Label htmlFor="api-name">API Name</Label>
                <Input
                  id="api-name"
                  value={objectForm.api_name}
                  onChange={(e) => setObjectForm({ ...objectForm, api_name: e.target.value })}
                  placeholder="Auto-generated from name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={objectForm.description}
                  onChange={(e) => setObjectForm({ ...objectForm, description: e.target.value })}
                  placeholder="Describe what this object represents..."
                />
              </div>
              <Button onClick={handleCreateObject} className="w-full">
                Create Object
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Objects List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Custom Objects
            </CardTitle>
            <CardDescription>
              Manage your custom data models
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {objects.map((object) => (
                <div
                  key={object.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedObject === object.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedObject(object.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{object.name}</h4>
                      <p className="text-sm text-muted-foreground">{object.api_name}</p>
                      {object.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {object.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={object.is_active ? "default" : "secondary"}>
                        {object.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Fields Management */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Fields</CardTitle>
                <CardDescription>
                  {selectedObject 
                    ? `Manage fields for ${objects.find(o => o.id === selectedObject)?.name}`
                    : "Select an object to manage its fields"
                  }
                </CardDescription>
              </div>
              {selectedObject && (
                <Dialog open={showFieldDialog} onOpenChange={setShowFieldDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Custom Field</DialogTitle>
                      <DialogDescription>
                        Create a new field for this object
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="field-name">Field Name</Label>
                        <Input
                          id="field-name"
                          value={fieldForm.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setFieldForm({
                              ...fieldForm,
                              name,
                              api_name: generateApiName(name)
                            });
                          }}
                          placeholder="e.g., Price, Category, Status"
                        />
                      </div>
                      <div>
                        <Label htmlFor="field-type">Field Type</Label>
                        <Select
                          value={fieldForm.field_type}
                          onValueChange={(value) => setFieldForm({ ...fieldForm, field_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {fieldForm.field_type === 'picklist' && (
                        <div>
                          <Label htmlFor="picklist-values">Picklist Values</Label>
                          <Textarea
                            id="picklist-values"
                            value={fieldForm.picklist_values}
                            onChange={(e) => setFieldForm({ ...fieldForm, picklist_values: e.target.value })}
                            placeholder="One value per line"
                          />
                        </div>
                      )}
                      <Button onClick={handleCreateField} className="w-full">
                        Add Field
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedObject ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{field.name}</div>
                          <div className="text-sm text-muted-foreground">{field.api_name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {fieldTypes.find(t => t.value === field.field_type)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={field.is_required ? "destructive" : "secondary"}>
                          {field.is_required ? "Required" : "Optional"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Select a custom object to view and manage its fields
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}