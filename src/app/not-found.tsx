import Link from "@/ui/components/app-link";
import { buttonClass } from "@/ui/components/styles";

export default function NotFound() {
  return (
    <main className="bg-petroleum-gradient on-dark flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center text-ivory-50">
      <p className="caption-3 text-gold-300">QorStock · Demo</p>
      <h1 className="heading-5 md:heading-3 max-w-[680px]">No encontramos esta página</h1>
      <p className="body-3 max-w-md text-ivory-200">Puede que el enlace haya cambiado. Vuelve al inicio para seguir el recorrido.</p>
      <Link href="/" className={buttonClass("primary")}>
        Volver al inicio
      </Link>
    </main>
  );
}
