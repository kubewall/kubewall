import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoonIcon, SunIcon, LaptopIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { useTheme } from "../../ThemeProvider";

export function ThemeModeSelector() {
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button className="ml-1 h-8 w-8 shadow-none" variant="outline" size="icon">
                {
                  theme === 'dark' ? <MoonIcon className="h-4 w-4 " /> : <SunIcon className="h-4 w-4" />
                }
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Toggle theme
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => { setTheme("light"); location.reload(); }}>
          <SunIcon className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setTheme("dark"); location.reload(); }}>
          <MoonIcon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setTheme("system"); location.reload(); }}>
          <LaptopIcon className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
