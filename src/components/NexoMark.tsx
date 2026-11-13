import darkSymbol from '@/assets/nexo-symbol-dark.png.asset.json';
import lightSymbol from '@/assets/nexo-symbol-light.png.asset.json';
import darkLogo from '@/assets/nexo-logo-dark.png.asset.json';

interface NexoMarkProps {
  className?: string;
  variant?: 'silver' | 'color';
  fullLogo?: boolean;
}

const NexoMark = ({ className, variant = 'silver', fullLogo = false }: NexoMarkProps) => (
  <img
    src={fullLogo ? darkLogo.url : variant === 'silver' ? darkSymbol.url : lightSymbol.url}
    alt={fullLogo ? 'Nexo Imagen — Consulta integral en diagnóstico por imágenes' : ''}
    aria-hidden={fullLogo ? undefined : true}
    className={`object-contain ${className || ''}`}
    decoding="async"
    draggable={false}
  />
);

export default NexoMark;
