import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

// Public concierge landing. Middleware sends signed-in users to /home; this
// also guards directly. Ported 1:1 from the approved landing demo.
export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/home");

  const serif = "var(--font-serif-f), Fraunces, serif";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F6F0E7] text-[#241910]">
      {/* top bar */}
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-6 sm:px-[52px]">
        <div className="text-[21px] font-semibold tracking-[0.02em]" style={{ fontFamily: serif }}>
          NOVA
        </div>
        <Link
          href="/login"
          className="inline-flex h-[42px] items-center rounded-full border border-[#EBE1D2] bg-transparent px-5 text-sm font-semibold hover:bg-white"
        >
          Sign in
        </Link>
      </div>

      {/* hero */}
      <section className="mx-auto max-w-[820px] px-8 pb-2 pt-[60px] text-center">
        <h1
          className="mx-0 mb-4 mt-[18px] font-semibold leading-[1.0] tracking-[-0.028em] text-[clamp(40px,6.4vw,68px)]"
          style={{ fontFamily: serif }}
        >
          The only setup you need in one place.
        </h1>
        <p
          className="mx-auto max-w-[560px] font-medium text-[#5a4a38] text-[clamp(19px,2.4vw,24px)]"
          style={{ fontFamily: serif }}
        >
          See every number that moves the needle.
        </p>
        <div className="mt-[30px] flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-[52px] items-center rounded-full bg-[#A0703C] px-7 text-[15px] font-semibold text-white hover:bg-[#855729]"
          >
            Sign in
          </Link>
          <a
            href="mailto:matthewbryanchuang@gmail.com?subject=NOVA%20portal%20access"
            className="inline-flex h-[52px] items-center rounded-full border border-[#EBE1D2] bg-white px-7 text-[15px] font-semibold text-[#241910] hover:bg-[#f3ece0]"
          >
            Request access
          </a>
        </div>
        <div className="mt-4 text-[13px] text-[#8A7762]">
          For NOVA Consulting clients and the Setters Collaborative team.
        </div>
      </section>

      {/* product mockup */}
      <section className="mx-auto mt-11 max-w-[980px] px-6">
        <div
          className="rounded-[20px] bg-[#241910] p-3"
          style={{ boxShadow: "0 50px 100px rgba(36,25,16,.26)" }}
        >
          <div className="flex items-center gap-[7px] px-3 py-2">
            <i className="h-[11px] w-[11px] rounded-full bg-[#5a4730]" />
            <i className="h-[11px] w-[11px] rounded-full bg-[#5a4730]" />
            <i className="h-[11px] w-[11px] rounded-full bg-[#5a4730]" />
            <span className="ml-3 text-[12px] font-medium text-[#9a866d]">tone.setco.pro</span>
          </div>
          <div className="rounded-[12px] bg-[#F6F0E7] p-[22px]">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="text-[22px] font-semibold" style={{ fontFamily: serif }}>
                Tone · Dashboard
              </h3>
              <span className="rounded-full bg-[#e9eedc] px-[11px] py-1 text-[11px] font-semibold text-[#566A3D]">
                On pace
              </span>
            </div>
            {/* kpis */}
            <div className="mb-[14px] grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { l: "Calls booked", n: "18", u: "" },
                { l: "Show-up rate", n: "78", u: "%" },
                { l: "Closed", n: "5", u: "" },
                { l: "Cash", n: "$19", u: "k" },
              ].map((k) => (
                <div key={k.l} className="rounded-[12px] border border-[#EBE1D2] bg-white p-[14px]">
                  <div className="text-[11px] text-[#8A7762]">{k.l}</div>
                  <div className="mt-1.5 text-[30px] font-semibold" style={{ fontFamily: serif }}>
                    {k.n}
                    {k.u && <span className="text-[#cdbda3]">{k.u}</span>}
                  </div>
                </div>
              ))}
            </div>
            {/* targets + ring */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
              <div className="rounded-[12px] border border-[#EBE1D2] bg-white p-4">
                <h4 className="mb-[10px] text-[13px] font-semibold">This week&apos;s targets</h4>
                {[
                  { t: "Calls booked", v: "14 / 20", w: 70, c: "#A0703C" },
                  { t: "Show-ups", v: "11 / 14", w: 78, c: "#566A3D" },
                  { t: "Closes", v: "5 / 6", w: 83, c: "#566A3D" },
                  { t: "Cash collected", v: "$19k / $30k", w: 63, c: "#B07A1E" },
                ].map((b) => (
                  <div key={b.t} className="mb-[11px] last:mb-0">
                    <div className="mb-1.5 flex justify-between text-[12.5px] font-medium">
                      <span>{b.t}</span>
                      <span className="text-[#8A7762]">{b.v}</span>
                    </div>
                    <div className="h-[9px] overflow-hidden rounded-full bg-[#ece1cf]">
                      <div className="h-full rounded-full" style={{ width: `${b.w}%`, background: b.c }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center justify-center rounded-[12px] border border-[#EBE1D2] bg-white p-4 text-center">
                <div
                  className="my-1 grid h-[120px] w-[120px] place-items-center rounded-full"
                  style={{ background: "conic-gradient(#A0703C 0 70%, #e9ddca 70% 100%)" }}
                >
                  <div
                    className="grid h-[84px] w-[84px] place-items-center rounded-full bg-white text-[26px] font-semibold"
                    style={{ fontFamily: serif }}
                  >
                    70%
                  </div>
                </div>
                <div className="text-[13px] font-semibold">Weekly goal</div>
                <div className="mt-0.5 text-[12px] text-[#8A7762]">6 to go by Friday</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* quote */}
      <div
        className="mx-auto mt-16 max-w-[680px] rounded-[20px] border border-[#EBE1D2] bg-white px-[38px] py-[34px] text-center"
        style={{ boxShadow: "0 20px 50px rgba(36,25,16,.06)" }}
      >
        <p className="text-[21px] leading-[1.45]" style={{ fontFamily: serif }}>
          &ldquo;It&apos;s the first time the whole team and I are looking at the same numbers
          — and the recaps mean nothing slips.&rdquo;
        </p>
        <div className="mt-4 text-[13px] font-medium text-[#8A7762]">— A NOVA client</div>
      </div>

      {/* stats */}
      <div className="mx-auto mb-20 mt-[46px] flex flex-wrap justify-center gap-12">
        {[
          { n: "71%", l: "avg show-up" },
          { n: "$31k", l: "weekly cash" },
          { n: "4-wk", l: "hit-target streak" },
        ].map((s) => (
          <div key={s.l} className="text-center">
            <div className="text-[40px] font-semibold" style={{ fontFamily: serif }}>
              {s.n}
            </div>
            <div className="text-[13px] text-[#8A7762]">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
