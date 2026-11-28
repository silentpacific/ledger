// "Market moves": an example change rolling over on a fact card, with its history (10 s CSS loop). Example data, no store named.
export default function ChangeExample() {
  return (
    <div className="h-zoom" role="img" aria-label="Animation: a list of changes this month; one pet store's free-shipping minimum rolls over from $49 to $79 on its fact card, and a new dot is added to its history line.">
<div className="h-fixed">
<div style={{ position: "absolute", left: "96px", top: "110px", width: "540px" }}>
<p style={{ margin: "0 0 10px", fontSize: "15px", fontWeight: "600", color: "#B45309" }}>Market moves</p>
<h2 style={{ margin: "0", fontSize: "42px", lineHeight: "1.1", letterSpacing: "-1px", fontWeight: "800" }}>What changed this month.</h2>
<p style={{ margin: "14px 0 18px", fontSize: "17px", lineHeight: "1.55", color: "#475569" }}>Every change we spot across 995 stores, with the before, the after and the date.</p>
<div className="m-a m-it1 m-sel" style={{ display: "flex", gap: "14px", alignItems: "flex-start", padding: "14px 16px", border: "1px solid #EEF2F6", borderRadius: "12px", marginTop: "10px", background: "#FFFFFF" }}>
<span style={{ flex: "none", marginTop: "5px", width: "9px", height: "9px", borderRadius: "5px", background: "#15803D" }}></span>
<div style={{ flex: "1" }}><p style={{ margin: "0", fontSize: "12px", fontWeight: "600", color: "#15803D" }}>Pet</p><p style={{ margin: "3px 0 0", fontSize: "15px", lineHeight: "1.4", fontWeight: "600" }}>A pet store raised its free-shipping minimum from $49 to $79</p></div>
<span style={{ flex: "none", fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>1 Nov</span></div>
<div className="m-a m-it2" style={{ display: "flex", gap: "14px", alignItems: "flex-start", padding: "14px 16px", border: "1px solid #EEF2F6", borderRadius: "12px", marginTop: "10px", background: "#FFFFFF" }}>
<span style={{ flex: "none", marginTop: "5px", width: "9px", height: "9px", borderRadius: "5px", background: "#0E7C6B" }}></span>
<div style={{ flex: "1" }}><p style={{ margin: "0", fontSize: "12px", fontWeight: "600", color: "#0E7C6B" }}>Beauty</p><p style={{ margin: "3px 0 0", fontSize: "15px", lineHeight: "1.4", fontWeight: "600" }}>A beauty store added Zip alongside Afterpay</p></div>
<span style={{ flex: "none", fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>1 Nov</span></div>
<div className="m-a m-it3" style={{ display: "flex", gap: "14px", alignItems: "flex-start", padding: "14px 16px", border: "1px solid #EEF2F6", borderRadius: "12px", marginTop: "10px", background: "#FFFFFF" }}>
<span style={{ flex: "none", marginTop: "5px", width: "9px", height: "9px", borderRadius: "5px", background: "#B45309" }}></span>
<div style={{ flex: "1" }}><p style={{ margin: "0", fontSize: "12px", fontWeight: "600", color: "#B45309" }}>Fashion</p><p style={{ margin: "3px 0 0", fontSize: "15px", lineHeight: "1.4", fontWeight: "600" }}>A fashion store cut its express delivery fee from $15 to $10</p></div>
<span style={{ flex: "none", fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>1 Nov</span></div>
<div className="m-a m-it4" style={{ display: "flex", gap: "14px", alignItems: "flex-start", padding: "14px 16px", border: "1px solid #EEF2F6", borderRadius: "12px", marginTop: "10px", background: "#FFFFFF" }}>
<span style={{ flex: "none", marginTop: "5px", width: "9px", height: "9px", borderRadius: "5px", background: "#1D4ED8" }}></span>
<div style={{ flex: "1" }}><p style={{ margin: "0", fontSize: "12px", fontWeight: "600", color: "#1D4ED8" }}>Homewares</p><p style={{ margin: "3px 0 0", fontSize: "15px", lineHeight: "1.4", fontWeight: "600" }}>12 homewares stores started a Black Friday sale</p></div>
<span style={{ flex: "none", fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>24 Nov</span></div>
</div>

<div style={{ position: "absolute", left: "824px", top: "150px", width: "520px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "18px", boxShadow: "0 28px 60px rgba(15,23,42,.12)", padding: "26px 30px", boxSizing: "border-box" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: "13px", fontWeight: "600", color: "#64748B" }}>Free-shipping minimum · a pet store</span>
<span className="m-a m-badge" style={{ fontSize: "11px", fontWeight: "700", color: "#92400E", background: "#FEF3C7", border: "1px solid #FACC15", borderRadius: "999px", padding: "4px 10px" }}>Changed 1 Nov</span></div>
<div style={{ height: "54px", overflow: "hidden", marginTop: "8px" }}><div className="m-a m-roll"><p style={{ margin: "0", height: "54px", fontSize: "50px", lineHeight: "54px", fontWeight: "800", letterSpacing: "-1.5px" }}>$49</p><p style={{ margin: "0", height: "54px", fontSize: "50px", lineHeight: "54px", fontWeight: "800", letterSpacing: "-1.5px" }}>$79</p></div></div>
<div style={{ position: "relative", height: "44px", marginTop: "16px", borderLeft: "3px solid #FACC15" }}>
<p className="m-a m-oldq" style={{ margin: "0", fontSize: "14px", lineHeight: "1.5", fontStyle: "italic", color: "#334155", position: "absolute", left: "12px", top: "0", right: "0" }}>“Free shipping on all orders over $49.”</p>
<p className="m-a m-newq" style={{ margin: "0", fontSize: "14px", lineHeight: "1.5", fontStyle: "italic", color: "#334155", position: "absolute", left: "12px", top: "0", right: "0" }}>“Free shipping on all orders over <span style={{ background: "#FDE68A", borderRadius: "3px", padding: "0 2px" }}>$79</span>.”</p></div>

<div style={{ marginTop: "26px", paddingTop: "20px", borderTop: "1px solid #EEF2F6" }}>
<p style={{ margin: "0 0 18px", fontSize: "13px", fontWeight: "600", color: "#64748B" }}>History</p>
<div style={{ position: "relative", height: "74px" }}>
<div style={{ position: "absolute", left: "8px", top: "10px", width: "300px", height: "3px", background: "#CBD5E1", borderRadius: "2px" }}></div>
<div className="m-a m-seg" style={{ position: "absolute", left: "308px", top: "10px", width: "142px", height: "3px", background: "#FACC15", borderRadius: "2px" }}></div>
<div style={{ position: "absolute", left: "0", top: "3px", width: "17px", height: "17px", borderRadius: "9px", background: "#FFFFFF", border: "3px solid #94A3B8", boxSizing: "border-box" }}></div>
<div style={{ position: "absolute", left: "150px", top: "3px", width: "17px", height: "17px", borderRadius: "9px", background: "#FFFFFF", border: "3px solid #94A3B8", boxSizing: "border-box" }}></div>
<div style={{ position: "absolute", left: "300px", top: "3px", width: "17px", height: "17px", borderRadius: "9px", background: "#FFFFFF", border: "3px solid #94A3B8", boxSizing: "border-box" }}></div>
<div className="m-a m-ring" style={{ position: "absolute", left: "441px", top: "2px", width: "19px", height: "19px", borderRadius: "10px", border: "2px solid #FACC15", boxSizing: "border-box" }}></div>
<div className="m-a m-dot" style={{ position: "absolute", left: "441px", top: "2px", width: "19px", height: "19px", borderRadius: "10px", background: "#FACC15", border: "3px solid #FFFFFF", boxShadow: "0 0 0 1.5px #EAB308", boxSizing: "border-box" }}></div>
<div style={{ position: "absolute", left: "0", top: "30px", fontSize: "12px", color: "#64748B", lineHeight: "1.4" }}><b style={{ color: "#0F172A" }}>$49</b><br />1 Aug</div>
<div style={{ position: "absolute", left: "150px", top: "30px", fontSize: "12px", color: "#64748B", lineHeight: "1.4" }}><b style={{ color: "#0F172A" }}>$49</b><br />1 Sep</div>
<div style={{ position: "absolute", left: "300px", top: "30px", fontSize: "12px", color: "#64748B", lineHeight: "1.4" }}><b style={{ color: "#0F172A" }}>$49</b><br />1 Oct</div>
<div className="m-a m-was" style={{ position: "absolute", left: "418px", top: "30px", fontSize: "12px", color: "#64748B", lineHeight: "1.4", textAlign: "right", width: "60px" }}><b style={{ color: "#B45309" }}>$79</b><br />1 Nov</div>
</div>
<p className="m-a m-was" style={{ margin: "10px 0 0", fontSize: "13px", color: "#475569" }}>Was $49 for at least three months. Both reads agree on the new wording.</p>
</div></div>
<p style={{ position: "absolute", left: "96px", bottom: "30px", margin: "0", fontSize: "12px", color: "#94A3B8" }}>An example change, to show how one is recorded. Stores are not named.</p>
</div>
    </div>
  );
}
