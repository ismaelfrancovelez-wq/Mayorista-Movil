// app/page.tsx - Home Principal (SIEMPRE se muestra este)

import HomePrincipal from '../components/HomePrincipal';

export default async function Page() {
  // SIEMPRE mostrar el home principal
  // La lógica de redirección está dentro del componente
  return <HomePrincipal />;
}