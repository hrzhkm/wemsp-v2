import Arrow from "../ui/arrow";
import { useLanguage } from "@/lib/i18n/context";

export default function About() {
  const { t } = useLanguage();
  return (
    <div
      id="about"
      className="about bg-cover bg-center w-full h-screen relative"
      style={{ backgroundImage: "url('/assets/background-islamic.png')" }}
      >
        <div className="absolute inset-0 bg-black/90" /> {/* Dark overlay */}
        <div className="relative z-10 container mx-auto h-full flex items-center px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left Column */}
            <div className="text-white">
              <h3 className="text-orange-400 text-xl font-medium mb-4">
                {t('about.label')}
              </h3>
              <h2 className="text-4xl font-bold mb-8">
                {t('about.title')}
              </h2>
            </div>

            {/* Right Column */}
            <div className="text-white/80">
              <p className="text-lg leading-relaxed mb-8">
                {t('about.description')}
              </p>
              <button className="bg-orange-400 text-white px-6 py-3 rounded-full hover:bg-orange-500 transition-colors flex items-center gap-2">
                {t('about.continueReading')}
                <Arrow />
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}