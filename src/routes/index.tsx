import { createFileRoute } from '@tanstack/react-router'
import Navbar from '../components/home/navbar';
import Header from "../components/home/header";
import About from "../components/home/about";
import Services from "../components/home/services";
// import LatestTransactions from "../components/home/latest-transactions";
// import { Footer } from "@/components/ui/footer";

export const Route = createFileRoute('/')({ component: App })

function App() {

  return (
    <div className="items-center justify-items-center min-h-screen font-[family-name:var(--font-geist-sans)]">
      <Navbar />
      {/* Header Section */}
      <Header />
      {/* About Section */}
      <About />
      {/* Services Section */}
      <Services />
      {/* Blockchain Transactions Section */}
      {/* <LatestTransactions /> */}
      {/* Footer Section */}
      {/* <Footer /> */}
    </div>
  )
}
