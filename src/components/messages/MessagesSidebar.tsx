import { Inbox, Send, FileText, Trash2, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface MessagesSidebarProps {
  activeFolder: string;
  onFolderChange: (folder: string) => void;
  unreadCount: number;
}

export function MessagesSidebar({ activeFolder, onFolderChange, unreadCount }: MessagesSidebarProps) {
  const folders = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: unreadCount },
    { id: 'sent', label: 'Sent Items', icon: Send, count: 0 },
    { id: 'drafts', label: 'Drafts', icon: FileText, count: 0 },
    { id: 'archive', label: 'Archive', icon: Archive, count: 0 },
    { id: 'trash', label: 'Deleted Items', icon: Trash2, count: 0 },
  ];

  return (
    <div className="w-64 border-r bg-background flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-sm text-foreground">Folders</h2>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {folders.map((folder) => {
            const Icon = folder.icon;
            const isActive = activeFolder === folder.id;
            
            return (
              <Button
                key={folder.id}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2 h-9",
                  isActive && "bg-accent text-accent-foreground font-medium"
                )}
                onClick={() => onFolderChange(folder.id)}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left truncate text-sm">{folder.label}</span>
                {folder.count > 0 && (
                  <Badge 
                    variant="default" 
                    className="ml-auto px-1.5 py-0 text-xs h-5 min-w-5 rounded-full"
                  >
                    {folder.count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
