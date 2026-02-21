import React, { useState, useEffect, useRef } from 'react';
import { Search, Headphones, ToggleLeft, ToggleRight, User, ChevronDown, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { authSignOut, getAuthSession } from '@/lib/auth-utils';
import { ibmDb } from '@/lib/ibm';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { LoanCalculator } from '@/components/LoanCalculator';
import { BrandLogo } from '@/components/BrandLogo';
import logoAsset from '@/assets/loanflow-logo.png';

interface IBMTopBarProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

interface SearchResult {
  id: string;
  leadId: string;
  name: string;
  businessName?: string;
  email?: string;
}

export function IBMTopBar({ onMenuClick, sidebarCollapsed }: IBMTopBarProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await authSignOut();
    toast({ title: "Signed out successfully" });
    navigate('/auth');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchBorrowers = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      try {
        const session = await getAuthSession();
        if (!session?.user) return;

        const { data, error } = await ibmDb
          .from('contact_entities')
          .select(`
            id, 
            first_name, 
            last_name, 
            business_name, 
            email,
            leads!contact_entity_id(id)
          `)
          .eq('user_id', session.user.id)
          .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,business_name.ilike.%${searchQuery}%`)
          .limit(10);

        if (error) throw error;

        setSearchResults((data as any[])?.filter((d: any) => d.leads && (d.leads as any[]).length > 0).map((d: any) => {
          const borrowerName = d.first_name && d.last_name 
            ? `${d.first_name} ${d.last_name}`.trim()
            : d.first_name || d.last_name || 'Unknown';
          
          return {
            id: String(d.id),
            leadId: String(d.leads[0].id),
            name: String(borrowerName),
            businessName: d.business_name ? String(d.business_name) : undefined,
            email: d.email ? String(d.email) : undefined
          };
        }) || []);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      }
    };

    const debounce = setTimeout(searchBorrowers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleResultClick = (result: SearchResult) => {
    navigate(`/leads/${result.leadId}`);
    setSearchQuery('');
    setShowResults(false);
  };

  return (
    <header className="h-16 md:h-20 lg:h-24 bg-[#0a1628] border-b border-[#1a2942] flex items-center justify-between flex-shrink-0 w-full px-2 md:px-4">
      {/* Left section with brand */}
      <div className="flex items-center h-full flex-1">
        <BrandLogo
          size={140} 
          showText={false} 
          imageSrc={logoAsset}
          className="-ml-10 md:-ml-8 mt-4"
          imageClassName="brightness-0 invert"
        />
      </div>

      {/* Center search bar */}
      <div className="flex justify-center items-center gap-2">
        <div className="relative" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search by the borrower or company name..."
            className="pl-10 h-9 bg-[#1a2942] border-[#2a3952] text-white placeholder:text-gray-400 focus:bg-[#243552] rounded-none w-[280px] md:w-[360px] lg:w-[420px]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
          />
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a2942] border border-[#2a3952] rounded-sm shadow-lg max-h-96 overflow-y-auto z-50">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="px-4 py-3 hover:bg-[#243552] cursor-pointer border-b border-[#2a3952] last:border-b-0"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="text-white font-medium">{result.name}</div>
                  {result.businessName && (
                    <div className="text-gray-400 text-sm">{result.businessName}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          {showResults && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a2942] border border-[#2a3952] rounded-sm shadow-lg z-50">
              <div className="px-4 py-3 text-gray-400 text-sm">
                No borrowers found matching "{searchQuery}"
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right section with actions */}
      <div className="flex items-center gap-0 px-2 md:px-4 flex-1 justify-end">
        <NotificationBell />
        
        <LoanCalculator />

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:h-9 md:w-9 text-white hover:bg-transparent border border-transparent hover:border-blue-500 hover:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
          onClick={() => window.open('https://outlook.office.com', '_blank')}
          title="Open Microsoft 365 Email"
        >
          <Mail className="h-5 w-5 md:h-6 md:w-6" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:h-9 md:w-9 text-white hover:bg-transparent border border-transparent hover:border-blue-500 hover:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
          onClick={() => window.open('https://app.ringcentral.com', '_blank')}
          title="Open RingCentral Dial Pad"
        >
          <Phone className="h-5 w-5 md:h-6 md:w-6" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:h-9 md:w-9 text-white hover:bg-transparent border border-transparent hover:border-blue-500 hover:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
          onClick={() => navigate('/support')}
          title="Support Center"
        >
          <Headphones className="h-5 w-5 md:h-6 md:w-6" />
        </Button>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:h-9 md:w-9 text-white hover:bg-transparent border border-transparent hover:border-blue-500 transition-colors"
            >
              <User className="h-5 w-5 md:h-6 md:w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
