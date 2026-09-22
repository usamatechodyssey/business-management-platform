// // app/components/layout/DashboardShell.tsx
// "use client";

// import {
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
//   type ReactNode,
// } from "react";
// import { useRouter } from "next/navigation";
// import { createPortal } from "react-dom";
// import { Header } from "./Header";
// import { Sidebar } from "./Sidebar";
// import { BottomNav } from "./BottomNav";
// import { getVisibleNavItems } from "./nav-items";
// import { useToast } from "@/app/components/ui/Toast";
// import { translate, type Dictionary, type Locale } from "@/lib/i18n";
// import type { ModuleKey, UserRole } from "@/types";

// interface DashboardShellProps {
//   children: ReactNode;
//   dictionary: Dictionary;
//   currentLocale: Locale;
//   businessName: string;
//   userName: string;
//   userRole: UserRole;
//   enabledModules: ModuleKey[];
//   // Optional banner (or fragment of banners) rendered directly below the
//   // header, inside the flex column. Keeps sticky positioning scoped to
//   // the same flex container as the header — avoids overlap bugs.
//   topBanner?: ReactNode;
// }

// export function DashboardShell({
//   children,
//   dictionary,
//   currentLocale,
//   businessName,
//   userName,
//   userRole,
//   enabledModules,
//   topBanner,
// }: DashboardShellProps) {
//   const router = useRouter();
//   const { push: pushToast } = useToast();

//   const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
//   const [isLoggingOut, setIsLoggingOut] = useState(false);

//   const drawerRef = useRef<HTMLDivElement>(null);

//   const items = useMemo(
//     () => getVisibleNavItems(enabledModules, userRole),
//     [enabledModules, userRole]
//   );

//   const closeMobileNav = useCallback(() => setIsMobileNavOpen(false), []);
//   const openMobileNav = useCallback(() => setIsMobileNavOpen(true), []);

//   // Drawer side-effects: Escape to close, body-scroll lock, focus the
//   // drawer on open and restore the previously focused element on close.
//   useEffect(() => {
//     if (!isMobileNavOpen) return;

//     const previouslyFocused = document.activeElement as HTMLElement | null;
//     drawerRef.current?.focus();
//     const previousOverflow = document.body.style.overflow;
//     document.body.style.overflow = "hidden";

//     function handleKeyDown(event: KeyboardEvent) {
//       if (event.key === "Escape") setIsMobileNavOpen(false);
//     }
//     document.addEventListener("keydown", handleKeyDown);

//     return () => {
//       document.removeEventListener("keydown", handleKeyDown);
//       document.body.style.overflow = previousOverflow;
//       previouslyFocused?.focus();
//     };
//   }, [isMobileNavOpen]);

//   const handleLogout = useCallback(async () => {
//     if (isLoggingOut) return;
//     setIsLoggingOut(true);
//     try {
//       const response = await fetch("/api/auth/logout", { method: "POST" });
//       if (!response.ok) {
//         throw new Error(`Logout failed with status ${response.status}`);
//       }
//       router.push("/login");
//       router.refresh();
//     } catch {
//       setIsLoggingOut(false);
//       pushToast({
//         message: translate(dictionary, "errors.generic"),
//         variant: "error",
//       });
//     }
//   }, [dictionary, isLoggingOut, pushToast, router]);

//   const [mounted, setMounted] = useState(false);
//   useEffect(() => setMounted(true), []);

//   return (
//     <div className="flex min-h-screen flex-col bg-background">
//       <Header
//         dictionary={dictionary}
//         currentLocale={currentLocale}
//         userName={userName}
//         userRole={userRole}
//         onOpenMenu={openMobileNav}
//         onLogout={handleLogout}
//         isLoggingOut={isLoggingOut}
//       />

//       {topBanner}

//       <div className="flex flex-1">
//         <aside className="hidden border-e border-border bg-surface lg:flex lg:w-64 lg:shrink-0">
//           <Sidebar
//             items={items}
//             dictionary={dictionary}
//             businessName={businessName}
//             onLogout={handleLogout}
//             isLoggingOut={isLoggingOut}
//           />
//         </aside>

//         <main className="min-w-0 flex-1 pb-16 lg:pb-0">{children}</main>
//       </div>

//       <BottomNav
//         items={items}
//         dictionary={dictionary}
//         onOpenMenu={openMobileNav}
//         isMobileNavOpen={isMobileNavOpen}
//       />

//       {isMobileNavOpen &&
//         mounted &&
//         createPortal(
//           <div
//             className="fixed inset-0 z-50 lg:hidden"
//             role="dialog"
//             aria-modal="true"
//             aria-label={translate(dictionary, "nav.primaryLabel")}
//           >
//             <div
//               className="absolute inset-0 bg-black/50"
//               onClick={closeMobileNav}
//               aria-hidden="true"
//             />
//             <div
//               ref={drawerRef}
//               tabIndex={-1}
//               className="absolute inset-y-0 inset-s-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl focus:outline-none"
//             >
//               <Sidebar
//                 items={items}
//                 dictionary={dictionary}
//                 businessName={businessName}
//                 onNavigate={closeMobileNav}
//                 onRequestClose={closeMobileNav}
//                 onLogout={handleLogout}
//                 isLoggingOut={isLoggingOut}
//               />
//             </div>
//           </div>,
//           document.body
//         )}
//     </div>
//   );
// }
// components/layout/DashboardShell.tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { getVisibleNavItems } from "./nav-items";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { ModuleKey, UserRole } from "@/types";

interface DashboardShellProps {
  children: ReactNode;
  dictionary: Dictionary;
  currentLocale: Locale;
  businessName: string;
  userName: string;
  userRole: UserRole;
  enabledModules: ModuleKey[];
  // When true, sidebar/bottom-nav items other than Billing are rendered
  // as disabled. Set by the billing layout when the subscription has
  // lapsed — the customer can still navigate to /billing but is not
  // repeatedly bounced to the blocked screen.
  restrictedToBilling?: boolean;
}

export function DashboardShell({
  children,
  dictionary,
  currentLocale,
  businessName,
  userName,
  userRole,
  enabledModules,
  restrictedToBilling = false,
}: DashboardShellProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => getVisibleNavItems(enabledModules, userRole),
    [enabledModules, userRole]
  );

  const closeMobileNav = useCallback(() => setIsMobileNavOpen(false), []);
  const openMobileNav = useCallback(() => setIsMobileNavOpen(true), []);

  useEffect(() => {
    if (!isMobileNavOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    drawerRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMobileNavOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isMobileNavOpen]);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Logout failed with status ${response.status}`);
      }
      router.push("/login");
      router.refresh();
    } catch {
      setIsLoggingOut(false);
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    }
  }, [dictionary, isLoggingOut, pushToast, router]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        dictionary={dictionary}
        currentLocale={currentLocale}
        userName={userName}
        userRole={userRole}
        onOpenMenu={openMobileNav}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <div className="flex flex-1">
        <aside className="hidden border-e border-border bg-surface lg:flex lg:w-64 lg:shrink-0">
          <Sidebar
            items={items}
            dictionary={dictionary}
            businessName={businessName}
            onLogout={handleLogout}
            isLoggingOut={isLoggingOut}
            restrictedToBilling={restrictedToBilling}
          />
        </aside>

        <main className="min-w-0 flex-1 pb-16 lg:pb-0">{children}</main>
      </div>

      <BottomNav
        items={items}
        dictionary={dictionary}
        onOpenMenu={openMobileNav}
        isMobileNavOpen={isMobileNavOpen}
        restrictedToBilling={restrictedToBilling}
      />

      {isMobileNavOpen &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={translate(dictionary, "nav.primaryLabel")}
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={closeMobileNav}
              aria-hidden="true"
            />
            <div
              ref={drawerRef}
              tabIndex={-1}
              className="absolute inset-y-0 inset-s-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl focus:outline-none"
            >
              <Sidebar
                items={items}
                dictionary={dictionary}
                businessName={businessName}
                onNavigate={closeMobileNav}
                onRequestClose={closeMobileNav}
                onLogout={handleLogout}
                isLoggingOut={isLoggingOut}
                restrictedToBilling={restrictedToBilling}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}