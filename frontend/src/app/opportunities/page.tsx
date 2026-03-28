import NavBar from "@/components/NavBar";
import OpportunitiesPage from "@/components/opportunities/OpportunitiesPage";

export const metadata = {
  title: "Возможности | Трамплин",
};

export default function OpportunitiesListPage() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <NavBar />
      <main className="flex-1 overflow-hidden">
        <OpportunitiesPage />
      </main>
    </div>
  );
}
