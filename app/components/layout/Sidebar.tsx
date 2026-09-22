// // components/layout/Sidebar.tsx
// "use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { LogOut, X } from "lucide-react";
// import { translate, type Dictionary } from "@/lib/i18n";
// import type { NavItem } from "./nav-items";

// interface SidebarProps {
//   items: NavItem[];
//   dictionary: Dictionary;
//   businessName: string;
//   onNavigate?: () => void;
//   onRequestClose?: () => void;
//   onLogout: () => void;
//   isLoggingOut: boolean;
// }

// function isItemActive(pathname: string, href: string): boolean {
//   return pathname === href || pathname.startsWith(`${href}/`);
// }

// export function Sidebar({
//   items,
//   dictionary,
//   businessName,
//   onNavigate,
//   onRequestClose,
//   onLogout,
//   isLoggingOut,
// }: SidebarProps) {
//   const pathname = usePathname();

//   return (
//     <nav
//       aria-label={translate(dictionary, "nav.primaryLabel")}
//       className="flex h-full w-full flex-col"
//     >
//       {/* Business name — kept truncate because names can be long. The
//           global RTL .truncate padding gives Nastaliq its vertical room. */}
//       <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
//         <p
//           className="min-w-0 truncate text-base font-semibold text-foreground"
//           title={businessName}
//         >
//           {businessName}
//         </p>
//         {onRequestClose && (
//           <button
//             type="button"
//             onClick={onRequestClose}
//             aria-label={translate(dictionary, "nav.closeMenu")}
//             className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
//           >
//             <X className="h-5 w-5" aria-hidden="true" />
//           </button>
//         )}
//       </div>

//       <ul className="flex-1 space-y-1 overflow-y-auto p-3">
//         {items.map((item) => {
//           const isActive = isItemActive(pathname, item.href);
//           const Icon = item.icon;
//           const label = translate(dictionary, item.translationKey);

//           return (
//             <li key={item.key}>
//               <Link
//                 href={item.href}
//                 onClick={onNavigate}
//                 aria-current={isActive ? "page" : undefined}
//                 className={[
//                   // Extra vertical padding in RTL keeps the label's
//                   // ascenders/descenders away from the pill's edge.
//                   // Nav labels are known short strings, so no truncate is
//                   // used here — the label wraps naturally if ever needed.
//                   "flex items-center gap-3 rounded-lg px-3 py-2.5 rtl:py-3.5",
//                   "text-sm font-medium transition-colors",
//                   "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
//                   isActive
//                     ? "bg-primary/10 text-primary"
//                     : "text-text-muted hover:bg-surface-muted hover:text-foreground",
//                 ].join(" ")}
//               >
//                 <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
//                 <span className="min-w-0 flex-1">{label}</span>
//               </Link>
//             </li>
//           );
//         })}
//       </ul>

//       <div className="shrink-0 border-t border-border p-3">
//         <button
//           type="button"
//           onClick={onLogout}
//           disabled={isLoggingOut}
//           className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 rtl:py-3.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
//         >
//           <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
//           <span className="min-w-0 flex-1 text-start">
//             {translate(dictionary, "nav.logout")}
//           </span>
//         </button>
//       </div>
//     </nav>
//   );
// }
// components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { translate, type Dictionary } from "@/lib/i18n";
import type { NavItem } from "./nav-items";

interface SidebarProps {
  items: NavItem[];
  dictionary: Dictionary;
  businessName: string;
  onNavigate?: () => void;
  onRequestClose?: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  // When true, only /billing remains clickable. Every other item renders
  // as a disabled placeholder so a lapsed customer isn't bounced to the
  // blocked screen on every nav tap.
  restrictedToBilling?: boolean;
}

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  items,
  dictionary,
  businessName,
  onNavigate,
  onRequestClose,
  onLogout,
  isLoggingOut,
  restrictedToBilling = false,
}: SidebarProps) {
  const pathname = usePathname();
  const disabledTooltip = translate(dictionary, "nav.disabledTooltip");

  return (
    <nav
      aria-label={translate(dictionary, "nav.primaryLabel")}
      className="flex h-full w-full flex-col"
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <p
          className="min-w-0 truncate text-base font-semibold text-foreground"
          title={businessName}
        >
          {businessName}
        </p>
        {onRequestClose && (
          <button
            type="button"
            onClick={onRequestClose}
            aria-label={translate(dictionary, "nav.closeMenu")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <ul className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const isActive = isItemActive(pathname, item.href);
          const Icon = item.icon;
          const label = translate(dictionary, item.translationKey);
          const isDisabled = restrictedToBilling && item.key !== "billing";

          // Disabled placeholder — same shape as a link, but not focusable
          // or clickable, and slightly muted so it reads as unavailable.
          if (isDisabled) {
            return (
              <li key={item.key}>
                <div
                  aria-disabled="true"
                  title={disabledTooltip}
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 opacity-40 rtl:py-3.5 text-sm font-medium text-text-muted"
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{label}</span>
                </div>
              </li>
            );
          }

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 rtl:py-3.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-text-muted hover:bg-surface-muted hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="shrink-0 border-t border-border p-3">
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 rtl:py-3.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-start">
            {translate(dictionary, "nav.logout")}
          </span>
        </button>
      </div>
    </nav>
  );
}