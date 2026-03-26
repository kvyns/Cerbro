import { useState } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function Pricing() {
  const [selectedPlan, setSelectedPlan] = useState(null);

  const pricingTiers = [
    {
      name: "Student",
      description: "For individual students and educators",
      price: "Free",
      color: "border-mint/20 bg-white/70",
      accentColor: "mint",
      buttonClass: "bg-mint hover:bg-mint/90",
      features: [
        { name: "Verification Limit", value: "50/month" },
        { name: "Issue Limit", value: "5 certificates" },
        { name: "Max Active Certificates", value: "Unlimited" },
        { name: "Support Level", value: "Community" },
        { name: "API Access", value: false },
        { name: "Custom Branding", value: false },
      ],
    },
    {
      name: "Free",
      description: "Perfect for small organizations",
      price: "Free",
      color: "border-steel/10 bg-white/70",
      accentColor: "steel",
      buttonClass: "bg-ink hover:bg-steel",
      features: [
        { name: "Verification Limit", value: "500/month" },
        { name: "Issue Limit", value: "50 certificates" },
        { name: "Max Active Certificates", value: "500" },
        { name: "Support Level", value: "Email (48h)" },
        { name: "API Access", value: false },
        { name: "Custom Branding", value: false },
      ],
    },
    {
      name: "Pro",
      description: "For growing organizations",
      price: "$99",
      priceFreq: "/month",
      color: "border-amber/30 bg-white/80 ring-2 ring-amber/40",
      accentColor: "amber",
      buttonClass: "bg-amber hover:bg-amber/90",
      featured: true,
      features: [
        { name: "Verification Limit", value: "Unlimited" },
        { name: "Issue Limit", value: "Unlimited" },
        { name: "Max Active Certificates", value: "10,000" },
        { name: "Support Level", value: "Priority Email + Chat" },
        { name: "API Access", value: true },
        { name: "Custom Branding", value: false },
      ],
    },
    {
      name: "Enterprise",
      description: "Custom solutions for your needs",
      price: "Custom",
      color: "border-steel/10 bg-white/70",
      accentColor: "steel",
      buttonClass: "bg-ink hover:bg-steel",
      features: [
        { name: "Verification Limit", value: "Unlimited" },
        { name: "Issue Limit", value: "Unlimited" },
        { name: "Max Active Certificates", value: "Unlimited" },
        { name: "Support Level", value: "Dedicated Account Manager" },
        { name: "API Access", value: "Advanced API + Webhooks" },
        { name: "Custom Branding", value: true },
      ],
    },
    {
      name: "Institute",
      description: "For educational institutions",
      price: "Custom",
      color: "border-steel/10 bg-white/70",
      accentColor: "mint",
      buttonClass: "bg-mint hover:bg-mint/90",
      features: [
        { name: "Verification Limit", value: "Unlimited" },
        { name: "Issue Limit", value: "Unlimited" },
        { name: "Max Active Certificates", value: "Unlimited" },
        { name: "Support Level", value: "Dedicated Support Team" },
        { name: "API Access", value: "Full API Access" },
        { name: "Custom Branding", value: true },
      ],
    },
  ];

  const featuresList = [
    "QR Code Generation",
    "Digital Certificate Verification",
    "Batch Certificate Download",
    "Certificate History",
    "Email Notifications",
    "Security & Compliance",
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-fog font-body text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(244,162,97,.33),transparent_30%),radial-gradient(circle_at_83%_12%,rgba(42,157,143,.25),transparent_28%),linear-gradient(160deg,#f7f6f2_0%,#eef3f5_46%,#dbe5ea_100%)]" />
      <div className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full border border-ink/15" />
      <div className="pointer-events-none absolute -left-24 bottom-12 h-72 w-72 rounded-full border border-ink/20" />

      {/* Navigation */}
      <nav className="relative border-b border-steel/10 bg-white/50 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8">
          <div className="flex items-center justify-between">
            <a href="/" className="font-display text-2xl font-bold text-ink hover:text-steel transition">
              Cerbro
            </a>
            <div className="flex gap-6 items-center">
              <a href="/" className="text-sm font-semibold text-steel hover:text-ink transition">
                Verify
              </a>
              <a href="/pricing" className="text-sm font-semibold text-ink transition">
                Pricing
              </a>
              <a href="/login" className="text-sm font-semibold text-steel hover:text-ink transition">
                Sign In
              </a>
              <a href="/register" className="text-sm font-semibold text-white bg-mint hover:bg-mint/90 px-4 py-1.5 rounded-lg transition">
                Sign Up
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative mx-auto flex w-full max-w-5xl flex-col px-4 pb-12 pt-8 sm:px-8">
        {/* Header */}
        <header className="mb-12 animate-rise rounded-3xl border border-steel/10 bg-white/70 p-6 shadow-soft backdrop-blur-md sm:p-8">
          <h1 className="font-display text-3xl font-bold leading-tight text-ink sm:text-4xl mb-3">
            Simple, Transparent Pricing
          </h1>
          <p className="mb-4 text-xl font-semibold text-ink sm:text-2xl">
            Scale with your organization
          </p>
          <p className="mt-3 max-w-3xl text-sm text-steel/80 sm:text-base">
            All plans include unlimited verification and secure QR-based certificate validation. Choose the plan that fits your needs.
          </p>
        </header>

        {/* Pricing Cards Grid */}
        <div className="mb-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 animate-rise [animation-delay:100ms]">
          {pricingTiers.map((tier, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedPlan(idx)}
              className={`relative rounded-3xl border-2 overflow-hidden transition-all duration-300 cursor-pointer shadow-soft backdrop-blur-sm ${tier.color} ${
                selectedPlan === idx ? "ring-2 ring-offset-2 ring-ink/50" : ""
              } ${tier.featured ? "lg:scale-[1.02]" : ""}`}
            >
              {/* Featured Badge */}
              {tier.featured && (
                <div className="bg-gradient-to-r from-amber to-amber/80 text-white text-xs font-bold py-2 px-4 text-center">
                  ⭐ MOST POPULAR
                </div>
              )}

              <div className="p-5">
                {/* Tier Name */}
                <h3 className="font-display text-lg font-bold text-ink mb-1">
                  {tier.name}
                </h3>
                <p className="text-xs text-steel/70 mb-4 line-clamp-2">
                  {tier.description}
                </p>

                {/* Price */}
                <div className="mb-4">
                  <div className="text-3xl font-bold text-ink">
                    {tier.price}
                  </div>
                  {tier.priceFreq && (
                    <div className="text-xs text-steel/60">{tier.priceFreq}</div>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  className={`w-full py-2 px-3 rounded-xl font-semibold text-white mb-4 text-sm flex items-center justify-center gap-2 transition-all ${tier.buttonClass}`}
                >
                  Get Started
                  <ArrowRight size={16} />
                </button>

                {/* Features List */}
                <div className="space-y-2 border-t border-steel/10 pt-4">
                  <p className="text-xs font-semibold text-steel/60 uppercase tracking-wide">
                    What's included
                  </p>
                  {tier.features.map((feature, fidx) => (
                    <div key={fidx} className="flex items-start gap-2">
                      {typeof feature.value === "boolean" ? (
                        feature.value ? (
                          <CheckCircle2 size={14} className={`text-mint flex-shrink-0 mt-0.5 font-bold`} />
                        ) : (
                          <div className="text-sm text-steel/20 flex-shrink-0 mt-0">✕</div>
                        )
                      ) : (
                        <CheckCircle2 size={14} className="text-mint flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-grow">
                        <p className="text-xs text-steel/80 leading-tight">{feature.name}</p>
                        {typeof feature.value !== "boolean" && (
                          <p className="text-xs text-steel/60 font-medium leading-tight">
                            {feature.value}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Features Section */}
        <section className="mb-12 animate-rise rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm [animation-delay:200ms] sm:p-8">
          <h2 className="font-display text-2xl font-bold text-ink mb-8 text-center">
            All Plans Include
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuresList.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-mint flex-shrink-0" />
                <p className="text-sm text-steel/80">{feature}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="animate-rise rounded-3xl border border-steel/10 bg-white/80 p-6 shadow-soft backdrop-blur-sm [animation-delay:300ms] sm:p-8">
          <h2 className="font-display text-2xl font-bold text-ink mb-6 text-center">
            Questions?
          </h2>
          <div className="space-y-4">
            <div className="border-l-4 border-mint pl-4">
              <h3 className="font-semibold text-ink mb-1">
                Can I upgrade or downgrade my plan?
              </h3>
              <p className="text-sm text-steel/70">
                Yes! You can change your plan anytime. Changes take effect at the start of your next billing cycle.
              </p>
            </div>
            <div className="border-l-4 border-amber pl-4">
              <h3 className="font-semibold text-ink mb-1">
                Do you offer annual discounts?
              </h3>
              <p className="text-sm text-steel/70">
                Yes, annual plans include a 20% discount. Contact our sales team for details.
              </p>
            </div>
            <div className="border-l-4 border-mint pl-4">
              <h3 className="font-semibold text-ink mb-1">
                What payment methods do you accept?
              </h3>
              <p className="text-sm text-steel/70">
                We accept credit cards, bank transfers, and invoicing for Enterprise plans.
              </p>
            </div>
            <div className="border-l-4 border-amber pl-4">
              <h3 className="font-semibold text-ink mb-1">
                Is there a free trial?
              </h3>
              <p className="text-sm text-steel/70">
                Yes! Start with our Free tier or contact us for a 14-day Pro trial.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* CTA Footer */}
      <div className="relative border-t border-steel/10 bg-white/50 backdrop-blur-md py-8 mt-12">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-8">
          <h2 className="font-display text-2xl font-bold text-ink mb-2">Ready to get started?</h2>
          <p className="text-steel/70 mb-6 text-sm">
            Join organizations using Cerbro to verify certificates instantly.
          </p>
          <button className="bg-ink hover:bg-steel text-white font-semibold py-2.5 px-6 rounded-xl transition-all text-sm">
            Get Started Free
          </button>
        </div>
      </div>
    </div>
  );
}
