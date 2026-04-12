import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex w-full transition-colors duration-300">
      <Sidebar />
      <MainContent />
    </div>
  );
}
