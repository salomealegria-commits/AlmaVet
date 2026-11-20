import {
  CalendarHeart,
  FlaskConical,
  HeartPulse,
  ShieldCheck,
  Smile,
  Sparkles,
  Stethoscope,
  Syringe,
} from 'lucide-react';
import type { VetService } from '../types/domain';
import { formatCOP } from '../utils/format';

interface ServicesSectionProps {
  services: VetService[];
  loading: boolean;
  onSelectService: (serviceId: number) => void;
}

function ServiceIcon({ name }: { name: string }) {
  const cls = 'h-5 w-5 text-[#536B56]';
  switch (name) {
    case 'stethoscope':
      return <Stethoscope className={cls} />;
    case 'syringe':
      return <Syringe className={cls} />;
    case 'shield':
      return <ShieldCheck className={cls} />;
    case 'sparkles':
      return <Sparkles className={cls} />;
    case 'smile':
      return <Smile className={cls} />;
    case 'heart-pulse':
      return <HeartPulse className={cls} />;
    case 'flask':
      return <FlaskConical className={cls} />;
    default:
      return <CalendarHeart className={cls} />;
  }
}

export function ServicesSection({ services, loading, onSelectService }: ServicesSectionProps) {
  return (
    <section id="servicios" className="py-20 border-t border-[#E4DFD4]">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold tracking-wider text-[#536B56] mb-2">
            Servicios veterinarios · Tarifas de demostración
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#292D29] text-balance">
            Medicina preventiva y especializada con trato sereno
          </h2>
          <p className="mt-3 text-base text-[#596059]">
            Ocho líneas de atención diseñadas para acompañar la salud de tu perro o gato en cada etapa de su vida.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="h-64 rounded-xl border border-[#E4DFD4] bg-white/70 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <article
                key={service.id}
                className="flex flex-col rounded-xl border border-[#E4DFD4] bg-white p-6 transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#A8B99A]"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#A8B99A]/20">
                    <ServiceIcon name={service.icono} />
                  </div>
                  <span className="text-xs font-medium text-[#596059] tabular-nums">
                    {String(index + 1).padStart(2, '0')} · {service.duracion_minutos} min
                  </span>
                </div>

                <h3 className="font-display text-lg font-semibold text-[#292D29]">{service.nombre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#596059]">{service.descripcion}</p>

                <ul className="mt-4 space-y-1.5 text-xs text-[#596059] flex-1">
                  {service.beneficios.map((beneficio, bIdx) => (
                    <li key={bIdx} className="flex items-start gap-2">
                      <span className="text-[#536B56] font-semibold" aria-hidden="true">
                        —
                      </span>
                      <span>{beneficio}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-4 border-t border-[#E4DFD4] flex items-center justify-between gap-2">
                  <div>
                    <span className="block text-[11px] text-[#596059]">Tarifa [DEMO]</span>
                    <span className="font-semibold text-[#292D29] tabular-nums">{formatCOP(service.precio)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectService(service.id)}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-[#536B56] px-3.5 text-xs font-semibold text-white hover:bg-[#425745] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Solicitar cita
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
