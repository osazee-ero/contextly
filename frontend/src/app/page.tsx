import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/sections/Hero";
import ProductPreview from "@/components/sections/ProductPreview";
import HowItWorks from "@/components/sections/HowItWorks";
import FinalCTA from "@/components/sections/FinalCTA";

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="bg-[#09090B] pt-16 text-white">
        <Hero />
        <ProductPreview />
        <HowItWorks />
        <FinalCTA />
      </main>
    </>
  );
}