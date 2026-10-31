"use client";

import { useEffect } from "react";

/**
 * Small enhancements for the static header: a solid background once the page scrolls,
 * and closing the mobile menu after a link is chosen.
 */
export function HeaderScroll() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    if (!header) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      header.dataset.scrolled = window.scrollY > 12 ? "true" : "false";
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    const menu = header.querySelector<HTMLDetailsElement>(".mobile-nav");
    const onClick = (e: Event) => {
      if (menu && (e.target as HTMLElement).closest("a")) menu.open = false;
    };
    menu?.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("scroll", onScroll);
      menu?.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
