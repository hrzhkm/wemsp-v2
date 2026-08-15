import { useLanguage } from "@/lib/i18n/context";

// Define a type for service items
type ServiceItem = {
  titleKey: string;
  descriptionKey: string;
  icon: string;
  altKey: string;
};

// Array of services - easy to add new ones here
const serviceItems: ServiceItem[] = [
  {
    titleKey: "services.familyManagement.title",
    descriptionKey: "services.familyManagement.description",
    icon: "/assets/family-logo.png",
    altKey: "services.familyManagement.title"
  },
  {
    titleKey: "services.assetManagement.title",
    descriptionKey: "services.assetManagement.description",
    icon: "/assets/asset-logo.png",
    altKey: "services.assetManagement.title"
  },
  // To add a new service, just add another object here like:
  // {
  //   titleKey: "services.newService.title",
  //   descriptionKey: "services.newService.description",
  //   icon: "/assets/new-service-icon.png",
  //   altKey: "services.newService.title"
  // },
];

const ServiceCard = ({ title, description, icon, alt }: { title: string; description: string; icon: string; alt: string }) => (
  <div className="bg-white p-8 rounded-lg shadow-md flex flex-col items-center text-center w-full">
    <div className="w-24 h-24 mb-6 flex items-center justify-center">
      <img
        src={icon}
        alt={alt}
        className="w-full h-full object-contain"
      />
    </div>
    <h3 className="text-2xl font-bold mb-4">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

const Services = () => {
  const { t } = useLanguage();
  // Calculate grid columns based on number of items
  const getGridCols = () => {
    const itemCount = serviceItems.length;
    if (itemCount === 1) return 'grid-cols-1';
    if (itemCount === 2) return 'grid-cols-1 md:grid-cols-2';
    if (itemCount === 3) return 'grid-cols-1 md:grid-cols-3';
    if (itemCount === 4) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
    // For 5 or more items, use 2 columns on medium screens and 3 on large screens
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  };

  return (
    <div id="services" className="bg-gray-100 py-20 w-full">
      <div className="w-full px-4">
        <h2 className="text-4xl font-bold text-center mb-16">{t('services.title')}</h2>

        <div className={`grid ${getGridCols()} gap-8 w-full px-8`}>
          {serviceItems.map((service, index) => (
            <ServiceCard
              key={index}
              title={t(service.titleKey)}
              description={t(service.descriptionKey)}
              icon={service.icon}
              alt={t(service.altKey)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Services; 