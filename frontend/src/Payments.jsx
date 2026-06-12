import { useState } from "react";
import { CreditCard, CheckCircle2, ArrowRight, ArrowLeft, Lock, CheckCircle } from "lucide-react";

export default function Payments() {
  const [activeTab, setActiveTab] = useState("billing");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [cardData, setCardData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardHolder: "",
  });
  const creditsPackages = [
    { id: 1, credits: 100, price: 9.99, popular: false },
    { id: 2, credits: 500, price: 39.99, popular: true, savings: "20% OFF" },
    { id: 3, credits: 1000, price: 69.99, popular: false },
    { id: 4, credits: 5000, price: 299.99, popular: false, savings: "30% OFF" },
  ];

  const invoices = [
    { id: 1, date: "2024-03-20", amount: "$39.99", status: "paid", credits: 500 },
    { id: 2, date: "2024-02-20", amount: "$69.99", status: "paid", credits: 1000 },
    { id: 3, date: "2024-01-20", amount: "$9.99", status: "paid", credits: 100 },
  ];

  const handleCardChange = (field, value) => {
    if (field === "cardNumber") {
      value = value.replace(/\s/g, "").slice(0, 16);
      value = value.replace(/(\d{4})/g, "$1 ").trim();
    }
    if (field === "expiryDate") {
      value = value.slice(0, 5);
      if (value.length === 2 && !value.includes("/")) {
        value += "/";
      }
    }
    if (field === "cvv") {
      value = value.slice(0, 3);
    }
    setCardData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-fog dark:bg-steel font-body text-ink dark:text-fog">
      <div className="pointer-events-none absolute inset-0 gradient-bg" />
      <div className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full border border-ink/15" />
      <div className="pointer-events-none absolute -left-24 bottom-12 h-72 w-72 rounded-full border border-ink/20" />

      {/* Navigation */}
      <nav className="relative border-b border-steel/10 bg-white/50 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-8">
          <div className="flex items-center justify-between">
            <a href="/" className="font-display text-2xl font-bold text-ink hover:text-steel transition">
              Cerbro
            </a>
            <div className="flex gap-6">
              <a href="/" className="text-sm font-semibold text-steel hover:text-ink transition">
                Verify
              </a>
              <a href="/pricing" className="text-sm font-semibold text-steel hover:text-ink transition">
                Pricing
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col px-4 pb-12 pt-8 sm:px-8">
        {/* Header */}
        <div className="mb-8 animate-rise">
          <a href="/dashboard" className="flex items-center gap-2 text-steel hover:text-ink transition mb-4">
            <ArrowLeft size={20} />
            Back to Dashboard
          </a>
          <h1 className="font-display text-3xl font-bold text-ink">
            Buy Credits
          </h1>
          <p className="text-steel/70 text-sm mt-2">
            Purchase credits to issue and manage certificates
          </p>
        </div>

        {/* Credits Packages */}
        <div className="mb-12 animate-rise [animation-delay:100ms]">
          <h2 className="font-display text-2xl font-bold text-ink mb-6">
            Credit Packages
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {creditsPackages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative rounded-3xl border-2 p-6 transition-all cursor-pointer ${
                  pkg.popular
                    ? "border-mint/30 bg-white/80 ring-2 ring-mint/40 shadow-soft"
                    : "border-steel/10 bg-white/70 hover:shadow-soft"
                }`}
              >
                {pkg.savings && (
                  <div className="absolute top-0 right-0 bg-danger text-white text-xs font-bold py-1 px-3 rounded-bl-3xl">
                    {pkg.savings}
                  </div>
                )}
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-mint text-white text-xs font-bold py-1 px-4 rounded-full">
                    POPULAR
                  </div>
                )}

                <div className="mb-4 pt-2">
                  <p className="font-display text-4xl font-bold text-ink">
                    {pkg.credits}
                  </p>
                  <p className="text-xs text-steel/60 mt-1">Credits</p>
                </div>

                <div className="mb-6 py-4 border-y border-steel/10">
                  <p className="font-display text-3xl font-bold text-ink">
                    ${pkg.price}
                  </p>
                  <p className="text-xs text-steel/60">${(pkg.price / pkg.credits).toFixed(3)}/credit</p>
                </div>

                <button
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
                    pkg.popular
                      ? "bg-mint hover:bg-mint/90 text-white"
                      : "bg-steel/10 hover:bg-steel/20 text-ink"
                  }`}
                >
                  Buy Now
                  <ArrowRight size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Billing Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payment Form */}
          <div className="lg:col-span-2 animate-rise [animation-delay:200ms]">
            <div className="rounded-3xl border border-steel/10 bg-white/80 p-8 shadow-soft backdrop-blur-sm">
              <h2 className="font-display text-2xl font-bold text-ink mb-6">
                Payment Information
              </h2>

              {/* Payment Method Selection */}
              <div className="mb-6">
                <p className="text-sm font-semibold text-steel mb-3">Payment Method</p>
                <div className="flex gap-3">
                  {["card", "paypal", "apple"].map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
                        paymentMethod === method
                          ? "bg-mint text-white"
                          : "bg-fog text-steel hover:bg-steel/10"
                      }`}
                    >
                      {method === "card" && <><CreditCard size={13} className="inline mr-1" />Card</>}
                      {method === "paypal" && "PayPal"}
                      {method === "apple" && "Apple Pay"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Form */}
              {paymentMethod === "card" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-steel mb-2">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      value={cardData.cardHolder}
                      onChange={(e) => handleCardChange("cardHolder", e.target.value)}
                      placeholder="John Doe"
                      className="w-full rounded-xl border border-steel/20 bg-white px-4 py-3 text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-steel mb-2">
                      Card Number
                    </label>
                    <input
                      type="text"
                      value={cardData.cardNumber}
                      onChange={(e) => handleCardChange("cardNumber", e.target.value)}
                      placeholder="4242 4242 4242 4242"
                      className="w-full rounded-xl border border-steel/20 bg-white px-4 py-3 text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-steel mb-2">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        value={cardData.expiryDate}
                        onChange={(e) => handleCardChange("expiryDate", e.target.value)}
                        placeholder="MM/YY"
                        className="w-full rounded-xl border border-steel/20 bg-white px-4 py-3 text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-steel mb-2">
                        CVV
                      </label>
                      <input
                        type="text"
                        value={cardData.cvv}
                        onChange={(e) => handleCardChange("cvv", e.target.value)}
                        placeholder="123"
                        className="w-full rounded-xl border border-steel/20 bg-white px-4 py-3 text-ink outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === "paypal" && (
                <div className="py-8 text-center">
                  <p className="text-steel/60 mb-4">You will be redirected to PayPal to complete your purchase.</p>
                </div>
              )}

              {paymentMethod === "apple" && (
                <div className="py-8 text-center">
                  <p className="text-steel/60 mb-4">Apple Pay is available on supported devices.</p>
                </div>
              )}

              <button className="w-full mt-8 bg-mint hover:bg-mint/90 text-white font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2">
                <CreditCard size={18} />
                Complete Purchase
              </button>

              <p className="text-xs text-steel/60 mt-4 text-center">
                Your payment information is secure and encrypted
              </p>
            </div>
          </div>

          {/* Order Summary */}
          <div className="animate-rise [animation-delay:300ms]">
            <div className="rounded-3xl border border-steel/10 dark:border-steel/40 bg-white/80 dark:bg-ink/80 p-6 shadow-soft backdrop-blur-sm sticky top-8">
              <h3 className="font-display text-xl font-bold text-ink mb-6">
                Order Summary
              </h3>

              <div className="space-y-4 mb-6 pb-6 border-b border-steel/10">
                <div className="flex justify-between">
                  <p className="text-steel/70">500 Credits</p>
                  <p className="font-semibold text-ink">$39.99</p>
                </div>
                <div className="flex justify-between text-sm">
                  <p className="text-steel/60">Processing fee</p>
                  <p className="text-steel/60">$0.00</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center">
                  <p className="font-semibold text-ink">Total</p>
                  <p className="font-display text-2xl font-bold text-mint">$39.99</p>
                </div>
              </div>

              <div className="bg-mint/10 border border-mint/30 rounded-lg p-4">
                <p className="text-xs text-steel/70 mb-2 flex items-center gap-1"><Lock size={11} /> SSL Secure</p>
                <p className="text-xs text-steel/70 flex items-center gap-1"><CheckCircle size={11} /> Money-back guarantee</p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoices */}
        <div className="mt-12 animate-rise [animation-delay:400ms]">
          <h2 className="font-display text-2xl font-bold text-ink mb-6">
            Billing History
          </h2>
          <div className="rounded-3xl border border-steel/10 bg-white/80 shadow-soft backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-steel/10">
                  <tr>
                    <th className="text-left py-4 px-6 font-semibold text-steel/70">Date</th>
                    <th className="text-left py-4 px-6 font-semibold text-steel/70">Credits</th>
                    <th className="text-left py-4 px-6 font-semibold text-steel/70">Amount</th>
                    <th className="text-left py-4 px-6 font-semibold text-steel/70">Status</th>
                    <th className="text-right py-4 px-6 font-semibold text-steel/70">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-steel/10 hover:bg-fog/50 transition last:border-0">
                      <td className="py-4 px-6 text-steel/70">{inv.date}</td>
                      <td className="py-4 px-6 font-semibold text-ink">{inv.credits}</td>
                      <td className="py-4 px-6 font-semibold text-ink">{inv.amount}</td>
                      <td className="py-4 px-6">
                        <span className="inline-block px-3 py-1 bg-mint/20 text-mint rounded-full text-xs font-semibold">
                          <CheckCircle size={11} className="inline mr-1" />{inv.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button className="text-mint hover:text-mint/80 transition font-semibold text-sm">
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
