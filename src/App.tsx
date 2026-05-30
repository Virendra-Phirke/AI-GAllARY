/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import GalleryApp from "./components/GalleryApp";

export default function App() {
  return (
    <div className="w-full h-[100dvh] bg-[#050505] text-[#E0D8D0] font-sans overflow-hidden flex flex-col relative" id="website-root">
      <GalleryApp />
    </div>
  );
}

