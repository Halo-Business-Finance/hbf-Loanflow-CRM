import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, TestTube, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  lastTriggered?: Date;
  status: 'active' | 'inactive' | 'error';
}

export const WebhookManager: React.FC = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: ''
  });
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  const availableEvents = [
    'lead.created',
    'lead.updated',
    'lead.deleted',
    'client.created',
    'client.updated',
    'document.uploaded',
    'loan.approved',
    'loan.rejected'
  ];

  // Generate a secure webhook URL for the current environment
  const generateWebhookUrl = (eventType: string) => {
    const baseUrl = window.location.origin;
    const webhookId = crypto.randomUUID();
    return `${baseUrl}/api/webhooks/${eventType}/${webhookId}`;
  };

  // Load existing webhooks
  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      // Real webhook data would come from a webhooks table
      // For now, show empty state until webhooks are implemented
      setWebhooks([])
    } catch (error) {
      toast({
        title: "Error Loading Webhooks",
        description: "Failed to load webhook configurations",
        variant: "destructive"
      })
    }
  };

  const addWebhook = async () => {
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) {
      toast({
        title: "Invalid Webhook",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsAdding(true);
    try {
      const webhook: Webhook = {
        id: crypto.randomUUID(),
        name: newWebhook.name,
        url: newWebhook.url,
        events: newWebhook.events,
        isActive: true,
        secret: newWebhook.secret || crypto.randomUUID(),
        status: 'active'
      };

      setWebhooks(prev => [...prev, webhook]);
      setNewWebhook({ name: '', url: '', events: [], secret: '' });
      
      toast({
        title: "Webhook Added",
        description: "New webhook has been configured successfully",
      });
    } catch (error) {
      toast({
        title: "Error Adding Webhook",
        description: "Failed to add new webhook",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      setWebhooks(prev => prev.filter(w => w.id !== id));
      toast({
        title: "Webhook Deleted",
        description: "Webhook has been removed successfully",
      });
    } catch (error) {
      toast({
        title: "Error Deleting Webhook",
        description: "Failed to delete webhook",
        variant: "destructive"
      });
    }
  };

  const testWebhook = async (webhook: Webhook) => {
    try {
      const testPayload = {
        event: webhook.events[0],
        timestamp: new Date().toISOString(),
        data: {
          id: "test-123",
          type: "test",
          message: "This is a test webhook delivery"
        }
      };

      // In a real implementation, this would trigger the actual webhook
      await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': webhook.secret || ''
        },
        body: JSON.stringify(testPayload)
      });

      toast({
        title: "Test Sent",
        description: "Test webhook has been sent successfully",
      });
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Failed to send test webhook",
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Webhook Management</CardTitle>
          <CardDescription>
            Configure webhooks to integrate with external systems and automate workflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Add New Webhook Form */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-medium">Add New Webhook</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="webhook-name">Webhook Name</Label>
                  <Input
                    id="webhook-name"
                    placeholder="e.g., Lead Processing"
                    value={newWebhook.name}
                    onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    placeholder="https://your-service.com/webhook"
                    value={newWebhook.url}
                    onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Events to Subscribe</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  {availableEvents.map(event => (
                    <label key={event} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewWebhook(prev => ({ 
                              ...prev, 
                              events: [...prev.events, event] 
                            }));
                          } else {
                            setNewWebhook(prev => ({ 
                              ...prev, 
                              events: prev.events.filter(e => e !== event) 
                            }));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="webhook-secret">Secret (Optional)</Label>
                <Input
                  id="webhook-secret"
                  placeholder="Webhook secret for validation"
                  value={newWebhook.secret}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, secret: e.target.value }))}
                />
              </div>

              <Button onClick={addWebhook} disabled={isAdding}>
                <Plus className="h-4 w-4 mr-2" />
                Add Webhook
              </Button>
            </div>

            {/* Existing Webhooks */}
            <div className="space-y-4">
              <h3 className="font-medium">Configured Webhooks</h3>
              
              {webhooks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No webhooks configured yet. Add one above to get started.
                </div>
              ) : (
                webhooks.map(webhook => (
                  <div key={webhook.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{webhook.name}</h4>
                          <Badge variant={webhook.status === 'active' ? 'default' : 'secondary'}>
                            {webhook.status}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono bg-muted px-2 py-1 rounded text-xs">
                              {webhook.url}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(webhook.url)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-1 mb-2">
                          {webhook.events.map(event => (
                            <Badge key={event} variant="outline" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                        </div>
                        
                        {webhook.lastTriggered && (
                          <div className="text-xs text-muted-foreground">
                            Last triggered: {webhook.lastTriggered.toLocaleString()}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testWebhook(webhook)}
                        >
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteWebhook(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
