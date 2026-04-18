const solutionCards = [
  {
    title: "24/7 Call Answering",
    text: "Never miss a customer call. Our AI receptionist answers day and night.",
  },
  {
    title: "Emergency Call Handling",
    text: "Detects urgent situations instantly and routes emergency calls without delay.",
  },
  {
    title: "Lead Qualification & Booking",
    text: "Captures caller details, checks availability, books appointments, and sends SMS confirmations.",
  },
];

export function SolutionsMarquee() {
  const marqueeCards = [...solutionCards, ...solutionCards];

  return (
    <div className="solution-marquee-mask relative z-10 mx-auto max-w-[1240px] overflow-hidden">
      <div className="solution-marquee-track flex w-max gap-5 py-3">
        {marqueeCards.map((card, index) => (
          <article
            key={`${card.title}-${index}`}
            className="flex min-h-[190px] w-[280px] shrink-0 flex-col justify-between rounded-[24px] border border-[rgba(139,92,246,0.18)] bg-[linear-gradient(180deg,rgba(14,14,18,0.98),rgba(8,8,10,0.96))] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_18px_40px_rgba(0,0,0,0.32),0_0_32px_rgba(124,58,237,0.08)] sm:w-[320px]"
          >
            <div className="h-px w-16 bg-[linear-gradient(90deg,rgba(139,92,246,0.85),rgba(139,92,246,0.05))]" />
            <div className="space-y-3">
              <h3 className="text-[1.1rem] font-semibold tracking-[-0.03em] text-white">
                {card.title}
              </h3>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">{card.text}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
