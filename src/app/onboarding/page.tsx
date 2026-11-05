import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/session";
import { Onboarding } from "@/components/onboarding";

export const metadata = { title: "Siapkan brand kamu" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ ulang?: string }> }) {
  const { user, w } = await requireWorkspace();
  const brand = await w.getBrand();
  if (brand.onboarded && !(await searchParams).ulang) redirect("/beranda");
  return (
    <Onboarding
      firstName={user.name.split(" ")[0]}
      initial={{
        name: brand.name,
        industry: brand.industry,
        description: brand.description,
        handle: brand.handle.replace(/^@/, ""),
        audience: brand.audience,
        goals: brand.goals,
        tone: brand.onboarded ? brand.tone : "",
        logoUrl: brand.logoUrl,
        colors: { primary: brand.colors.primary, accent: brand.colors.accent },
        template: brand.defaultTemplate,
        socialRequested: brand.socialRequested,
      }}
    />
  );
}
