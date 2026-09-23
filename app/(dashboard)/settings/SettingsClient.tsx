// // app/(dashboard)/settings/SettingsClient.tsx
// "use client";

// import { useState } from "react";
// import { Tabs } from "@/app/components/ui/Tabs";
// import { BusinessProfileForm } from "@/app/components/settings/BusinessProfileForm";
// import { ModuleToggleList } from "@/app/components/settings/ModuleToggleList";
// import { KhataSettingsForm } from "@/app/components/settings/KhataSettingsForm";
// import { LanguagePreference } from "@/app/components/settings/LanguagePreference";
// import { RolesTab } from "@/app/components/settings/RolesTab";
// import { ExportTab } from "@/app/components/settings/ExportTab";
// import { translate, type Dictionary, type Locale } from "@/lib/i18n";
// import type { Business } from "@/types";

// interface SettingsClientProps {
//   business: Business;
//   currentLocale: Locale;
//   dictionary: Dictionary;
// }

// // Tab ids — kept as a small literal union so typos can't sneak through
// // the Tabs component's onChange.
// type SettingsTab =
//   | "profile"
//   | "modules"
//   | "khata"
//   | "roles"
//   | "language"
//   | "export";

// const VALID_TABS: readonly SettingsTab[] = [
//   "profile",
//   "modules",
//   "khata",
//   "roles",
//   "language",
//   "export",
// ] as const;

// function isSettingsTab(value: string): value is SettingsTab {
//   return (VALID_TABS as readonly string[]).includes(value);
// }

// export function SettingsClient({
//   business,
//   currentLocale,
//   dictionary,
// }: SettingsClientProps) {
//   // Tab is component state, not URL state — settings tabs are a UI
//   // detail, and avoiding router pushes keeps back/forward navigation
//   // predictable.
//   const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

//   const tabs = [
//     {
//       id: "profile",
//       label: translate(dictionary, "settings.tabs.profile"),
//     },
//     {
//       id: "modules",
//       label: translate(dictionary, "settings.tabs.modules"),
//     },
//     {
//       id: "khata",
//       label: translate(dictionary, "settings.tabs.khata"),
//     },
//     {
//       id: "roles",
//       label: translate(dictionary, "settings.tabs.roles"),
//     },
//     {
//       id: "language",
//       label: translate(dictionary, "settings.tabs.language"),
//     },
//     {
//       id: "export",
//       label: translate(dictionary, "settings.tabs.export"),
//     },
//   ];

//   return (
//     <div className="flex flex-col gap-6 p-4 sm:p-6">
//       {/* Header */}
//       <div>
//         <h1 className="text-xl font-semibold text-foreground">
//           {translate(dictionary, "settings.title")}
//         </h1>
//         <p className="text-sm text-text-muted">
//           {translate(dictionary, "settings.subtitle")}
//         </p>
//       </div>

//       {/* Tabs */}
//       <Tabs
//         tabs={tabs}
//         activeId={activeTab}
//         onChange={(id) => {
//           if (isSettingsTab(id)) setActiveTab(id);
//         }}
//       />

//       {/* Content — each tab owns its own submit button, so a failure in
//           one section never blocks the others. A successful save calls
//           router.refresh() (inside each form), which re-runs the server
//           page, passes down a fresh `business` prop, and re-syncs the
//           forms via their useEffect([business]) hooks. */}
//       <div>
//         {activeTab === "profile" && (
//           <BusinessProfileForm business={business} dictionary={dictionary} />
//         )}
//         {activeTab === "modules" && (
//           <ModuleToggleList
//             enabledModules={business.enabledModules}
//             dictionary={dictionary}
//           />
//         )}
//         {activeTab === "khata" && (
//           <KhataSettingsForm business={business} dictionary={dictionary} />
//         )}
//         {activeTab === "roles" && <RolesTab dictionary={dictionary} />}
//         {activeTab === "language" && (
//           <LanguagePreference
//             currentLocale={currentLocale}
//             businessLanguage={business.settings.language}
//             dictionary={dictionary}
//           />
//         )}
//         {activeTab === "export" && <ExportTab dictionary={dictionary} />}
//       </div>
//     </div>
//   );
// }
// app/(dashboard)/settings/SettingsClient.tsx
"use client";

import { useState } from "react";
import { Tabs } from "@/app/components/ui/Tabs";
import { BusinessProfileForm } from "@/app/components/settings/BusinessProfileForm";
import { ModuleToggleList } from "@/app/components/settings/ModuleToggleList";
import { KhataSettingsForm } from "@/app/components/settings/KhataSettingsForm";
import { LanguagePreference } from "@/app/components/settings/LanguagePreference";
import { RolesTab } from "@/app/components/settings/RolesTab";
import { ExportTab } from "@/app/components/settings/ExportTab";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { Business } from "@/types";

interface SettingsClientProps {
  business: Business;
  currentLocale: Locale;
  dictionary: Dictionary;
}

// Tab ids — kept as a small literal union so typos can't sneak through
// the Tabs component's onChange.
type SettingsTab =
  | "profile"
  | "modules"
  | "khata"
  | "roles"
  | "language"
  | "export";

const VALID_TABS: readonly SettingsTab[] = [
  "profile",
  "modules",
  "khata",
  "roles",
  "language",
  "export",
] as const;

function isSettingsTab(value: string): value is SettingsTab {
  return (VALID_TABS as readonly string[]).includes(value);
}

export function SettingsClient({
  business,
  currentLocale,
  dictionary,
}: SettingsClientProps) {
  // Tab is component state, not URL state — settings tabs are a UI
  // detail, and avoiding router pushes keeps back/forward navigation
  // predictable.
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const tabs = [
    {
      id: "profile",
      label: translate(dictionary, "settings.tabs.profile"),
    },
    {
      id: "modules",
      label: translate(dictionary, "settings.tabs.modules"),
    },
    {
      id: "khata",
      label: translate(dictionary, "settings.tabs.khata"),
    },
    {
      id: "roles",
      label: translate(dictionary, "settings.tabs.roles"),
    },
    {
      id: "language",
      label: translate(dictionary, "settings.tabs.language"),
    },
    {
      id: "export",
      label: translate(dictionary, "settings.tabs.export"),
    },
  ];

  return (
    // min-w-0      → flex-col parent ko widest child (tabs strip) ki
    //                width tak grow karne se rokta hai
    // overflow-x-clip → koi bhi child jo viewport se bahar nikle, use
    //                clip kar deta hai (clip, hidden nahi — taake koi
    //                nested scroll container na bane). Ye page-wide
    //                horizontal slide ka safety net hai.
    <div className="flex min-w-0 flex-col gap-6 overflow-x-clip p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {translate(dictionary, "settings.title")}
        </h1>
        <p className="text-sm text-text-muted">
          {translate(dictionary, "settings.subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeId={activeTab}
        onChange={(id) => {
          if (isSettingsTab(id)) setActiveTab(id);
        }}
      />

      {/* Content — each tab owns its own submit button, so a failure in
          one section never blocks the others. A successful save calls
          router.refresh() (inside each form), which re-runs the server
          page, passes down a fresh `business` prop, and re-syncs the
          forms via their useEffect([business]) hooks.

          min-w-0 here: keeps tab content from pushing width wider than
          the parent on mobile. */}
      <div className="min-w-0">
        {activeTab === "profile" && (
          <BusinessProfileForm business={business} dictionary={dictionary} />
        )}
        {activeTab === "modules" && (
          <ModuleToggleList
            enabledModules={business.enabledModules}
            dictionary={dictionary}
          />
        )}
        {activeTab === "khata" && (
          <KhataSettingsForm business={business} dictionary={dictionary} />
        )}
        {activeTab === "roles" && <RolesTab dictionary={dictionary} />}
        {activeTab === "language" && (
          <LanguagePreference
            currentLocale={currentLocale}
            businessLanguage={business.settings.language}
            dictionary={dictionary}
          />
        )}
        {activeTab === "export" && <ExportTab dictionary={dictionary} />}
      </div>
    </div>
  );
}