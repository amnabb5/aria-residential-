'use client';

/**
 * Gallery — a responsive mosaic of building/residence imagery.
 */
import { Camera } from 'lucide-react';

const SHOTS = [
  { src: '/images/gallery-interior.png', title: 'The Residences', span: 'sm:col-span-2 sm:row-span-2' },
  { src: '/images/gallery-pool.png', title: 'Rooftop Pool', span: 'sm:col-span-2' },
  { src: '/images/gallery-lobby.png', title: 'Lobby', span: '' },
  { src: '/images/gallery-view.png', title: 'City Views', span: '' },
  { src: '/images/hero-building.png', title: 'The Tower', span: 'sm:col-span-2' },
  { src: '/images/gallery-interior.png', title: 'Kitchen', span: '' },
];

export function Gallery() {
  return (
    <section id="gallery" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-white/20 bg-background/70 p-8 shadow-lg backdrop-blur-md sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
              Gallery
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              A look inside Aria.
            </h2>
          </div>
          <p className="inline-flex items-center gap-2 text-sm text-stone-500">
            <Camera className="h-4 w-4" />
            Renderings for illustration. Tour a unit in 3D to see the real thing.
          </p>
        </div>

        <div className="mt-10 grid auto-rows-[200px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHOTS.map((s, i) => (
            <figure
              key={i}
              className={`group relative overflow-hidden rounded-2xl bg-stone-200 shadow-sm ${s.span}`}
            >
              <img
                src={s.src}
                alt={s.title}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
              <figcaption className="absolute bottom-3 left-3 translate-y-2 text-sm font-medium text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
                {s.title}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
