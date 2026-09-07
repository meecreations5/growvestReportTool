import { GraduationCap, HeartHandshake, Home, Landmark, Plane, Target } from "lucide-react";

export function goalVisual(name = "") {
  const text = String(name).toLowerCase();
  if (/home|house|property/.test(text)) return Home;
  if (/travel|holiday|world/.test(text)) return Plane;
  if (/education|college|school|child/.test(text)) return GraduationCap;
  if (/retire|freedom/.test(text)) return Landmark;
  if (/family|legacy|protection/.test(text)) return HeartHandshake;
  return Target;
}

export function goalStatusTone(status = "") {
  const text = String(status).toLowerCase();
  if (/failed|overdue|critical|lapsed|expired/.test(text)) return "red";
  if (/attention|required|review|plan|not started|date/.test(text)) return "yellow";
  if (/completed|on track|running|progress|active/.test(text)) return "blue";
  return "neutral";
}

export function goalToneClasses(tone = "neutral") {
  if (tone === "red") return {
    text: "text-[#E53935]",
    dot: "bg-[#E53935]",
    soft: "bg-[#FFF0EF]",
    border: "border-[#E53935]/20"
  };
  if (tone === "yellow") return {
    text: "text-[#8A5B00]",
    dot: "bg-[#F5B301]",
    soft: "bg-[#FFF8DF]",
    border: "border-[#F5B301]/35"
  };
  if (tone === "blue") return {
    text: "text-[#1F4ED8]",
    dot: "bg-[#1F4ED8]",
    soft: "bg-[#EAF0FF]",
    border: "border-[#1F4ED8]/15"
  };
  return {
    text: "text-[#6B7280]",
    dot: "bg-[#6B7280]",
    soft: "bg-[#F4F6F9]",
    border: "border-slate-200"
  };
}
