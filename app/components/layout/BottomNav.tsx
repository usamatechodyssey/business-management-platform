// // components/layout/BottomNav.tsx
// "use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { Menu } from "lucide-react";
// import { translate, type Dictionary } from "@/lib/i18n";
// import type { NavItem } from "./nav-items";

// interface BottomNavProps {
//   items: NavItem[];
//   dictionary: Dictionary;
//   onOpenMenu: () => void;
//   isMobileNavOpen: boolean;
// }

// const MAX_VISIBLE_ITEMS = 4;

// function isItemActive(pathname: string, href: string): boolean {
//   return pathname === href || pathname.startsWith(`${href}/`);
// }

// export function BottomNav({
//   items,
//   dictionary,
//   onOpenMenu,
//   isMobileNavOpen,
// }: BottomNavProps) {
//   const pathname = usePathname();

//   const hasOverflow = items.length > MAX_VISIBLE_ITEMS;
//   const visibleItems = hasOverflow ? items.slice(0, MAX_VISIBLE_ITEMS) : items;
//   const overflowItems = hasOverflow ? items.slice(MAX_VISIBLE_ITEMS) : [];

//   const isMoreActive = overflowItems.some((item) =>
//     isItemActive(pathname, item.href)
//   );

//   return (
//     <nav
//       aria-label={translate(dictionary, "nav.mobileLabel")}
//       className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
//     >
//       {/* Taller in RTL so Nastaliq glyphs have vertical room. */}
//       <ul className="flex h-16 items-stretch rtl:h-24">
//         {visibleItems.map((item) => {
//           const isActive = isItemActive(pathname, item.href);
//           const Icon = item.icon;
//           const label = translate(dictionary, item.translationKey);

//           return (
//             <li key={item.key} className="flex-1">
//               <Link
//                 href={item.href}
//                 aria-current={isActive ? "page" : undefined}
//                 className={[
//                   "flex h-full flex-col items-center justify-center gap-0.5 px-1",
//                   "text-[11px] font-medium transition-colors",
//                   "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
//                   isActive ? "text-primary" : "text-text-muted",
//                 ].join(" ")}
//               >
//                 <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
//                 {/* No truncate — labels are short, and Nastaliq's dots/
//                     tails would be clipped by overflow:hidden. */}
//                 <span className="w-full text-center rtl:leading-snug">
//                   {label}
//                 </span>
//               </Link>
//             </li>
//           );
//         })}

//         {hasOverflow && (
//           <li className="flex-1">
//             <button
//               type="button"
//               onClick={onOpenMenu}
//               aria-haspopup="dialog"
//               aria-expanded={isMobileNavOpen}
//               className={[
//                 "flex h-full w-full flex-col items-center justify-center gap-0.5 px-1",
//                 "text-[11px] font-medium transition-colors",
//                 "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
//                 isMoreActive ? "text-primary" : "text-text-muted",
//               ].join(" ")}
//             >
//               <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
//               <span className="w-full text-center rtl:leading-snug">
//                 {translate(dictionary, "nav.more")}
//               </span>
//             </button>
//           </li>
//         )}
//       </ul>
//     </nav>
//   );
// }
// components/layout/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { translate, type Dictionary } from "@/lib/i18n";
import type { NavItem } from "./nav-items";

interface BottomNavProps {
  items: NavItem[];
  dictionary: Dictionary;
  onOpenMenu: () => void;
  isMobileNavOpen: boolean;
  // When true, only /billing remains clickable. Everything else renders
  // greyed out so a lapsed customer isn't bounced on every tap.
  restrictedToBilling?: boolean;
}

const MAX_VISIBLE_ITEMS = 4;

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav({
  items,
  dictionary,
  onOpenMenu,
  isMobileNavOpen,
  restrictedToBilling = false,
}: BottomNavProps) {
  const pathname = usePathname();
  const disabledTooltip = translate(dictionary, "nav.disabledTooltip");

  // When restricted, show Billing first so it's always one tap away,
  // then fall back to the default ordering minus the disabled entries.
  const orderedItems = restrictedToBilling
    ? [
        ...items.filter((i) => i.key === "billing"),
        ...items.filter((i) => i.key !== "billing"),
      ]
    : items;

  const hasOverflow = orderedItems.length > MAX_VISIBLE_ITEMS;
  const visibleItems = hasOverflow
    ? orderedItems.slice(0, MAX_VISIBLE_ITEMS)
    : orderedItems;
  const overflowItems = hasOverflow
    ? orderedItems.slice(MAX_VISIBLE_ITEMS)
    : [];

  const isMoreActive = overflowItems.some((item) =>
    isItemActive(pathname, item.href)
  );

  return (
    <nav
      aria-label={translate(dictionary, "nav.mobileLabel")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex h-16 items-stretch rtl:h-24">
        {visibleItems.map((item) => {
          const isActive = isItemActive(pathname, item.href);
          const Icon = item.icon;
          const label = translate(dictionary, item.translationKey);
          const isDisabled = restrictedToBilling && item.key !== "billing";

          if (isDisabled) {
            return (
              <li key={item.key} className="flex-1">
                <div
                  aria-disabled="true"
                  title={disabledTooltip}
                  className="flex h-full cursor-not-allowed flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-text-muted opacity-40"
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="w-full text-center rtl:leading-snug">
                    {label}
                  </span>
                </div>
              </li>
            );
          }

          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex h-full flex-col items-center justify-center gap-0.5 px-1",
                  "text-[11px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                  isActive ? "text-primary" : "text-text-muted",
                ].join(" ")}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="w-full text-center rtl:leading-snug">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}

        {hasOverflow && (
          <li className="flex-1">
            <button
              type="button"
              onClick={onOpenMenu}
              aria-haspopup="dialog"
              aria-expanded={isMobileNavOpen}
              className={[
                "flex h-full w-full flex-col items-center justify-center gap-0.5 px-1",
                "text-[11px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                isMoreActive ? "text-primary" : "text-text-muted",
              ].join(" ")}
            >
              <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="w-full text-center rtl:leading-snug">
                {translate(dictionary, "nav.more")}
              </span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}