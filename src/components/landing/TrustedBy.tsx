import { motion } from "framer-motion";
import { FaTiktok } from "react-icons/fa";

interface Brand {
  name: string;
  node: React.ReactNode;
}

function SupabaseMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M13.67 22.5c-.58 0-.83-.64-.38-1.1l6.77-6.34c.27-.25.69-.04.62.36l-.7 5.08c-.05.3-.02.59.13 1v.03c-.02.15-.46.78-.46.78-.83 1.13-2.76 1.12-3.1 1.07-.5-.06-1.1-.5-1.1-.5l-1.55-1.08s1-1.1 1-1.2c-.05-.06-1.2-.8-1.23-.82l1-.08.5-.6" 
        fill="#3ECF8E"
      />
      <path
        d="M7.13 1.13c.81 0 1.12.75 1 1.36l-4.7 8.37c-.2.36-.04.8.38.8h4.9c.53 0 .88.57.57 1.04l-4.9 7.27c-.5.74-.6.5-.55.3l5.9-9.1c.2-.3 0-.74-.35-.74H9.1M7.13 1.13c.5 0 .68.4.57.94l-4.6 8.36"
        fill="#3ECF8E"
      />
    </svg>
  );
}

export function TrustedBy() {
  const brands: Brand[] = [
    {
      name: "TikTok",
      node: <FaTiktok className="h-5 w-5" />,
    },
    {
      name: "Paystack",
      node: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <circle cx="12" cy="12" r="12" fill="#1b8d4e" />
          <text x="12" y="17" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" fontFamily="Arial, sans-serif">P</text>
        </svg>
      ),
    },
    {
      name: "Google AI",
      node: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M4.7 9.8a6.6 6.6 0 0 1 11.9-2.2l-1.9 1.2A4.6 4.6 0 0 0 8.2 12c-.3 1.6-.5 3.3-.8 4.9C5.9 14 4.3 13.7 2.7 13.6c-.4-2.2.3-4.3 2-5.8Zm14.5 1.9c1.5-1 3-1.5 4.6-1.9-2-3.4-5.6-5.6-9.6-5.8 1.5.4 2 2 1.8 3.5l-1.3 6.9c-.7 3.1-3.6 5.1-6.7 4.8a5.3 5.3 0 0 1-4.2-4.4c1.4 1.1 3.2 1.4 5 .2s3-2.8 3.4-4.8l1.1-6c1.3-.4 2.7-.4 4.2.3l-1.3 6.8Zm-9.8 2.1c-.7 3.7 1.6 7.2 5.2 8.1 3.9-1.2 6.6-5 6.2-9.1-1.7.4-3 1.3-4 2.5D15 17.8l-5.6-4Z" fill="#4285F4"/>
        </svg>
      ),
    },
    {
      name: "Supabase",
      node: <SupabaseMark />,
    },
  ];

  return (
    <section className="py-10 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">
            Built to work with the platforms and tools you already trust
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {brands.map((brand) => (
              <div
                key={brand.name}
                className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity"
              >
                {brand.node}
                <span className="font-semibold text-muted-foreground">{brand.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}