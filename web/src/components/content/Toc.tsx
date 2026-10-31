"use client";

import { useEffect, useState } from "react";

interface Item {
  id: string;
  text: string;
  level: number;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);

/**
 * "On this page" navigation built from the article's h2 and h3 headings, with the current section highlighted.
 * Headings get stable ids so every section can be linked directly.
 */
export function Toc({ rootId, title = "On this page" }: { rootId: string; title?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const used = new Set<string>();
    const heads = Array.from(root.querySelectorAll<HTMLHeadingElement>("h2, h3"));
    const list: Item[] = heads.map((h) => {
      let id = h.id || slug(h.textContent ?? "section");
      while (used.has(id)) id = `${id}-x`;
      used.add(id);
      h.id = id;
      return { id, text: h.textContent ?? "", level: h.tagName === "H3" ? 3 : 2 };
    });
    setItems(list);
    if (!list.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -65% 0px", threshold: 0 },
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [rootId]);

  if (items.length < 2) return null;
  return (
    <nav className="toc" aria-label={title}>
      <p className="toc__title">{title}</p>
      <ul>
        {items.map((it) => (
          <li key={it.id} className={it.level === 3 ? "toc__sub" : undefined}>
            <a href={`#${it.id}`} aria-current={active === it.id ? "location" : undefined}>
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Thin reading-progress bar at the top of long pages. */
export function ReadingProgress() {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(".reading-progress");
    if (!bar) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <div className="reading-progress" aria-hidden="true" />;
}

