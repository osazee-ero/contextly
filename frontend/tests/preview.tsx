import React from "react";
import { createRoot } from "react-dom/client";
import AppLayout from "../src/app/(app)/layout";
import Navbar from "../src/components/layout/Navbar";
import Dashboard from "../src/app/(app)/dashboard/page";
import Documents from "../src/app/(app)/documents/page";
import Chat from "../src/app/(app)/chat/page";
import Hero from "../src/components/sections/Hero";
import ProductPreview from "../src/components/sections/ProductPreview";
import HowItWorks from "../src/components/sections/HowItWorks";
import FinalCTA from "../src/components/sections/FinalCTA";

const pathname = window.location.pathname;
createRoot(document.getElementById("root")!).render(
  pathname === "/" ? <>{await Navbar()}<Hero /><ProductPreview /><HowItWorks /><FinalCTA /></> :
  await AppLayout({ children: pathname === "/documents" ? <Documents /> : pathname === "/chat" ? <Chat /> : <Dashboard /> })
);
