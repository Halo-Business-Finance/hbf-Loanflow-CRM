import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 text-white hover:bg-transparent border border-transparent hover:border-blue-500 hover:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      type="button"
    >
      {theme === "dark" ? (
        <Sun className="h-6 w-6" strokeWidth={1.75} />
      ) : (
        <Moon className="h-6 w-6" strokeWidth={1.75} />
      )}
    </Button>
  );
}
