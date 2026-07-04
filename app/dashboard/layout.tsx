import BottomNav from "@/components/BottomNav";
import EditEntry from "@/components/EditEntry";
import QuickEntry from "@/components/QuickEntry";

const DashboardLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  <>
    <main className="mx-auto min-h-dvh w-full max-w-md px-4 pb-28 pt-6">
      {children}
    </main>
    <QuickEntry />
    <EditEntry />
    <BottomNav />
  </>
);

export default DashboardLayout;
