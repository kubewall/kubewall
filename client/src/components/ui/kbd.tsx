import React from "react";
import { cn } from "@/lib/utils";

type KbdProps = {
	children: React.ReactNode;
	className?: string;
	square?: boolean;
	inline?: boolean; // default true: used inline with text/buttons
};

const Kbd: React.FC<KbdProps> = ({
	children,
	className,
	square = false,
	inline = true,
}) => {
	return (
		<kbd
			className={cn(
				"pointer-events-none select-none font-mono border rounded bg-muted text-muted-foreground",
				inline
					? "flex h-5 items-center justify-center px-1 text-[0.7rem] font-sans"
					: "absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs",
				"[&_svg:not([class*='size-'])]:size-3",
				square && inline && "aspect-square",
				className
			)}
		>
			{children}
		</kbd>
	);
};

export { Kbd };
