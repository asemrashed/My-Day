import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const bengaliDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const bengaliMonths = [
  "জানুয়ারী",
  "ফেব্রুয়ারী",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];
const bengaliWeekdays = [
  "রবিবার",
  "সোমবার",
  "মঙ্গলবার",
  "বুধবার",
  "বৃহস্পতিবার",
  "শুক্রবার",
  "শনিবার",
];

// Utility to convert English numbers to Bengali numbers
export function toBengaliNumerals(num: number | string): string {
  return num
    .toString()
    .split("")
    .map((char) => {
      const digit = parseInt(char, 10);
      return isNaN(digit) ? char : bengaliDigits[digit];
    })
    .join("");
}

// Custom Bengali Date Formatter: e.g., "বুধবার, ২৭ মে ২০২৬"
export function formatBengaliDate(date: Date): string {
  const dayName = bengaliWeekdays[date.getDay()];
  const dayOfMonth = toBengaliNumerals(date.getDate());
  const monthName = bengaliMonths[date.getMonth()];
  const year = toBengaliNumerals(date.getFullYear());
  
  return `${dayName}, ${dayOfMonth} ${monthName} ${year}`;
}

// Traditional Bengali Calendar Date calculation (approximated for standard conversion)
// e.g., 27 May falls in Joistho month (১৪৩৩)
export function getTraditionalBengaliDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();
  
  // A simple robust estimation for traditional Bengali calendar (civil version used in BD)
  // Bengali year starts around April 14 (Phela Baishakh)
  let banglaYear = year - 593;
  if (month < 3 || (month === 3 && day < 14)) {
    banglaYear -= 1;
  }
  
  // Approximate month mappings (mid-month transitions)
  // Baishakh: Apr 14 - May 14
  // Joistho: May 15 - Jun 15
  // Ashar: Jun 16 - Jul 16
  // Shrabon: Jul 17 - Aug 17
  // Bhadro: Aug 18 - Sep 17
  // Ashwin: Sep 18 - Oct 17
  // Kartik: Oct 18 - Nov 16
  // Ogrohayon: Nov 17 - Dec 16
  // Poush: Dec 17 - Jan 14
  // Magh: Jan 15 - Feb 12
  // Falgun: Feb 13 - Mar 14
  // Chaitra: Mar 15 - Apr 13
  
  let banglaMonth = "";
  let banglaDay = 1;
  
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Simple offset algorithm
  const transitions = [
    { m: 0, d: 14, name: "মাঘ" },       // Jan 15
    { m: 1, d: 13, name: "ফাল্গুন" },   // Feb 13
    { m: 2, d: 15, name: "চৈত্র" },     // Mar 15
    { m: 3, d: 14, name: "বৈশাখ" },    // Apr 14
    { m: 4, d: 15, name: "জ্যৈষ্ঠ" },   // May 15
    { m: 5, d: 16, name: "আষাঢ়" },    // Jun 16
    { m: 6, d: 17, name: "শ্রাবণ" },    // Jul 17
    { m: 7, d: 18, name: "ভাদ্র" },    // Aug 18
    { m: 8, d: 18, name: "আশ্বিন" },   // Sep 18
    { m: 9, d: 18, name: "কার্তিক" },   // Oct 18
    { m: 10, d: 17, name: "অগ্রহায়ণ" }, // Nov 17
    { m: 11, d: 17, name: "পৌষ" },     // Dec 17
  ];
  
  // Find current active month block
  let activeIndex = 0;
  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i];
    if (month > t.m || (month === t.m && day >= t.d)) {
      activeIndex = i;
    }
  }
  
  // Special wrap-around for Jan 1 to Jan 14 (still in Poush of previous Bangla year)
  if (month === 0 && day < 15) {
    banglaMonth = "পৌষ";
    banglaDay = day + 15; // approximate
  } else {
    const currentT = transitions[activeIndex];
    banglaMonth = currentT.name;
    // calculate offset days
    if (month === currentT.m) {
      banglaDay = day - currentT.d + 1;
    } else {
      // previous month overflow
      const prevT = transitions[activeIndex];
      const prevMonthDays = new Date(year, currentT.m, 0).getDate();
      banglaDay = prevMonthDays - prevT.d + day + 1;
    }
  }
  
  return `${toBengaliNumerals(banglaDay)} ${banglaMonth}, ${toBengaliNumerals(banglaYear)} বঙ্গাব্দ`;
}
