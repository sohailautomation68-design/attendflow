/**
 * Translations for public pages. English is complete. Urdu covers the home page so far;
 * other pages still use English and can move into this file over time.
 * Use logical Tailwind classes (text-start, ms-, me-) so right-to-left layouts flip correctly.
 */
export type Lang = "en" | "ur";

export const STRINGS = {
  en: {
    dir: "ltr",
    heroTitle: "Smart attendance. Better student engagement.",
    heroBody: "attendflow helps tuition academies and coaching centres mark attendance in seconds on a phone, see who is at risk, and follow up before students fall behind.",
    ctaStart: "Start your academy",
    ctaSignIn: "Sign in",
    feature1: "One-tap attendance",
    feature1Body: "Teachers mark a whole class from their phone, with a draft kept if the connection drops.",
    feature2: "Absence alerts",
    feature2Body: "Students with repeated absences or low attendance are flagged, with follow-up tasks.",
    feature3: "Reports you can export",
    feature3Body: "Attendance percentages follow clear rules and download as CSV.",
    switchTo: "اردو",
  },
  ur: {
    dir: "rtl",
    heroTitle: "سمارٹ حاضری۔ بہتر طلبہ کی شمولیت۔",
    heroBody: "attendflow ٹیوشن اکیڈمیوں اور کوچنگ سینٹرز کو فون پر چند سیکنڈ میں حاضری لگانے، خطرے میں موجود طلبہ کو دیکھنے، اور پیچھے رہ جانے سے پہلے پیروی کرنے میں مدد دیتا ہے۔",
    ctaStart: "اپنی اکیڈمی شروع کریں",
    ctaSignIn: "سائن ان",
    feature1: "ایک ٹیپ میں حاضری",
    feature1Body: "اساتذہ فون سے پوری کلاس کی حاضری لگاتے ہیں، اور کنکشن ٹوٹنے پر ڈرافٹ محفوظ رہتا ہے۔",
    feature2: "غیر حاضری کے الرٹ",
    feature2Body: "بار بار غیر حاضری یا کم حاضری والے طلبہ کو فالو اپ کے کاموں کے ساتھ نشان زد کیا جاتا ہے۔",
    feature3: "قابلِ ایکسپورٹ رپورٹس",
    feature3Body: "حاضری کا فیصد واضح اصولوں پر ہے اور CSV کے طور پر ڈاؤن لوڈ ہوتا ہے۔",
    switchTo: "English",
  },
} as const;

export function pickLang(value: string | undefined): Lang {
  return value === "ur" ? "ur" : "en";
}
