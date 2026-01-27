import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Phone, Mail, MapPin, ExternalLink, Award, FileCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface ServiceProviderInfoWidgetProps {
  providerId: string;
  providerType: 'title' | 'escrow';
  leadId: string;
}

export function ServiceProviderInfoWidget({
  providerId,
  providerType,
  leadId,
}: ServiceProviderInfoWidgetProps) {
  const navigate = useNavigate();

  const { data: provider, isLoading } = useQuery({
    queryKey: ["service-provider", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_providers")
        .select("*")
        .eq("id", providerId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });

  const { data: metrics } = useQuery({
    queryKey: ["service-provider-metrics", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_entities")
        .select("id")
        .or(`title_company_id.eq.${providerId},escrow_company_id.eq.${providerId}`);

      if (error) throw error;
      
      return {
        activeLeads: data.length,
      };
    },
    enabled: !!providerId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!provider) return null;

  const serviceAreas = Array.isArray(provider.service_areas) 
    ? provider.service_areas 
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {provider.logo_url && (
            <img 
              src={provider.logo_url} 
              alt={provider.name}
              className="h-8 w-8 object-contain"
            />
          )}
          <div>
            <CardTitle className="text-lg">{provider.name}</CardTitle>
            <Badge variant="secondary" className="mt-1">
              {provider.provider_type === 'both' ? 'Title & Escrow' : 
               provider.provider_type === 'title' ? 'Title Company' : 'Escrow Company'}
            </Badge>
          </div>
        </div>
        <Building2 className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {provider.contact_person && (
          <div className="text-sm">
            <span className="font-medium">Contact: </span>
            {provider.contact_person}
          </div>
        )}

        <div className="space-y-2">
          {provider.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${provider.phone}`} className="hover:underline">
                {provider.phone}
              </a>
            </div>
          )}
          
          {provider.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${provider.email}`} className="hover:underline">
                {provider.email}
              </a>
            </div>
          )}
          
          {provider.address && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>
                {provider.address}
                {provider.city && `, ${provider.city}`}
                {provider.state && `, ${provider.state}`}
              </span>
            </div>
          )}
        </div>

        {serviceAreas.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Award className="h-4 w-4" />
              Service Areas
            </div>
            <div className="flex flex-wrap gap-1">
              {serviceAreas.map((area: string) => (
                <Badge key={area} variant="outline" className="text-xs">
                  {area}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <div className="text-xs text-muted-foreground">Avg Closing</div>
            <div className="text-lg font-semibold">
              {provider.average_closing_days || 'N/A'} days
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Success Rate</div>
            <div className="text-lg font-semibold">
              {provider.success_rate ? `${provider.success_rate}%` : 'N/A'}
            </div>
          </div>
        </div>

        {metrics && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-sm">
              <FileCheck className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{metrics.activeLeads}</span>
              <span className="text-muted-foreground">active leads</span>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/service-providers/${provider.id}`)}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Full Profile
          </Button>
          {provider.phone && (
            <Button
              variant="default"
              size="sm"
              onClick={() => window.location.href = `tel:${provider.phone}`}
            >
              <Phone className="h-4 w-4 mr-2" />
              Call
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
