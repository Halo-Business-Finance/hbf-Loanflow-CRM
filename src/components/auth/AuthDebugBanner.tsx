import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAuthSession } from '@/lib/auth-utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

export function AuthDebugBanner() {
  const location = useLocation();
  const [debugInfo, setDebugInfo] = useState<{
    userId: string;
    email: string;
    tokenExpiry: string;
  } | null>(null);

  const isDebugMode = new URLSearchParams(location.search).get('debug-auth') === '1';

  useEffect(() => {
    if (!isDebugMode) {
      setDebugInfo(null);
      return;
    }

    const loadDebugInfo = async () => {
      const session = await getAuthSession();
      if (session) {
        setDebugInfo({
          userId: session.user.id,
          email: session.user.email || 'N/A',
          tokenExpiry: new Date(session.expiresAt).toLocaleString()
        });
      } else {
        setDebugInfo(null);
      }
    };

    loadDebugInfo();
  }, [isDebugMode, location]);

  if (!isDebugMode || !debugInfo) {
    return null;
  }

  return (
    <Alert className="mb-4 bg-blue-50 border-blue-200">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertDescription>
        <div className="flex items-center gap-4 text-sm">
          <span className="font-semibold text-blue-900">Auth Debug:</span>
          <Badge variant="outline" className="font-mono text-xs">
            {debugInfo.userId.slice(0, 8)}...
          </Badge>
          <span className="text-blue-700">{debugInfo.email}</span>
          <span className="text-blue-600 text-xs">
            Token expires: {debugInfo.tokenExpiry}
          </span>
        </div>
      </AlertDescription>
    </Alert>
  );
}
