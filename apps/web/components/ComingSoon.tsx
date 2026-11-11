// Placeholder body for screens that are linked from the sidebar but not built yet.
export default function ComingSoon({ title }: { title: string }) {
  return (
    <section className="space-y-2">
      <h1 className="font-display text-[30px] font-extrabold leading-[34px] tracking-[-0.03em] text-[#1e2b1b]">
        {title}
      </h1>
      <p className="text-[15px] text-[#556251]">This screen is coming soon.</p>
    </section>
  );
}
