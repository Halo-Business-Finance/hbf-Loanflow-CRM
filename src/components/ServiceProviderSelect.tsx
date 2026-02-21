import { useQuery } from "@tanstack/react-query";
import { ibmDb } from "@/lib/ibm";
const supabase = ibmDb; // IBM migration shim
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ServiceProviderSelectProps {
  value: string | null;
  onChange: (providerId: string) => void;
  providerType: 'title' | 'escrow' | 'both';
  placeholder?: string;
  disabled?: boolean;
}

export function ServiceProviderSelect({
  value,
  onChange,
  providerType,
  placeholder = "Select provider...",
  disabled = false,
}: ServiceProviderSelectProps) {
  const { data: providers, isLoading } = useQuery({
    queryKey: ["service-providers", providerType],
    queryFn: async () => {
      const query = supabase
        .from("service_providers")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (providerType !== 'both') {
        query.in('provider_type', [providerType, 'both']);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-background">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {providers?.map((provider) => (
          <SelectItem key={provider.id} value={provider.id}>
            <div className="flex items-center gap-2">
              {provider.logo_url && (
                <img 
                  src={provider.logo_url} 
                  alt={provider.name}
                  className="h-4 w-4 object-contain"
                />
              )}
              <span>{provider.name}</span>
              <span className="text-xs text-muted-foreground">
                ({provider.provider_type})
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
