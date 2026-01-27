import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Globe, 
  Award, 
  FileCheck,
  ArrowLeft,
  TrendingUp,
  Calendar,
  Users
} from "lucide-react";
import { RelatedLeadsTable } from "@/components/RelatedLeadsTable";
import { Skeleton } from "@/components/ui/skeleton";

export default function ServiceProviderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: provider, isLoading } = useQuery({
    queryKey: ["service-provider", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_providers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: leads } = useQuery({
    queryKey: ["service-provider-leads", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_entities")
        .select(`
          *,
          leads!inner(*)
        `)
        .or(`title_company_id.eq.${id},escrow_company_id.eq.${id}`);

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Provider not found</h2>
          <Button onClick={() => navigate(-1)} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const serviceAreas = Array.isArray(provider.service_areas) ? provider.service_areas : [];
  const certifications = Array.isArray(provider.certifications) ? provider.certifications : [];

  const getProviderTypeLabel = () => {
    if (provider.provider_type === 'both') return 'Title & Escrow Services';
    if (provider.provider_type === 'title') return 'Title Company';
    return 'Escrow Company';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {provider.logo_url && (
              <img 
                src={provider.logo_url} 
                alt={provider.name}
                className="h-12 w-12 object-contain"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold">{provider.name}</h1>
              <Badge variant="secondary" className="mt-1">
                {getProviderTypeLabel()}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {provider.contact_person && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Contact Person</div>
                <div className="text-base">{provider.contact_person}</div>
              </div>
            )}

            {provider.phone && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Phone</div>
                  <a href={`tel:${provider.phone}`} className="hover:underline">
                    {provider.phone}
                  </a>
                </div>
              </div>
            )}

            {provider.email && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Email</div>
                  <a href={`mailto:${provider.email}`} className="hover:underline">
                    {provider.email}
                  </a>
                </div>
              </div>
            )}

            {provider.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Address</div>
                  <div>
                    {provider.address}<br />
                    {provider.city && `${provider.city}, `}
                    {provider.state} {provider.zip_code}
                  </div>
                </div>
              </div>
            )}

            {provider.website && (
              <div className="flex items-start gap-2">
                <Globe className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Website</div>
                  <a 
                    href={provider.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {provider.website}
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Avg Closing Time
                </div>
                <div className="text-2xl font-bold">
                  {provider.average_closing_days || 'N/A'} days
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileCheck className="h-4 w-4" />
                  Success Rate
                </div>
                <div className="text-2xl font-bold">
                  {provider.success_rate ? `${provider.success_rate}%` : 'N/A'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Total Closings
                </div>
                <div className="text-2xl font-bold">
                  {provider.total_closings || 0}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  Active Leads
                </div>
                <div className="text-2xl font-bold">
                  {leads?.length || 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Areas */}
        {serviceAreas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Service Areas
              </CardTitle>
              <CardDescription>States and regions covered</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {serviceAreas.map((area: string) => (
                  <Badge key={area} variant="outline">
                    {area}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Certifications & Licenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {certifications.map((cert: string, index: number) => (
                  <Badge key={index} variant="secondary">
                    {cert}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {provider.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{provider.notes}</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Related Leads */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Related Leads</h2>
        <Card>
          <CardContent className="p-6">
            {leads && leads.length > 0 ? (
              <div className="space-y-4">
                {leads.map((contact) => (
                  <div 
                    key={contact.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => {
                      const leadData = Array.isArray(contact.leads) ? contact.leads[0] : contact.leads;
                      if (leadData?.id) {
                        navigate(`/leads/${leadData.id}`);
                      }
                    }}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{contact.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {contact.business_name || contact.email}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {contact.loan_amount && (
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Loan Amount</div>
                          <div className="font-medium">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 0
                            }).format(contact.loan_amount)}
                          </div>
                        </div>
                      )}
                      {contact.stage && (
                        <Badge variant="secondary">{contact.stage}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                No leads associated with this provider yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
