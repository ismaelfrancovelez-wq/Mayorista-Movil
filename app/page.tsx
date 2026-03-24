// app/page.tsx
// ✅ SSR: pre-carga datos en el servidor antes de enviar el HTML
// Replica la lógica de /api/featured/active pero con queries en paralelo
// El cliente recibe la página con datos — sin flash de loading

import HomePrincipal from '../components/HomePrincipal';
import { db } from '../lib/firebase-admin';

// ✅ CACHE: los datos públicos se cachean 5 minutos en el servidor
// Miles de usuarios comparten el mismo HTML pre-generado
// El auth se resuelve en cliente (AuthCheck + fetch /api/auth/me en HomePrincipal)
export const revalidate = 300; // 5 minutos

async function getHomeData() {
  try {
    const now = new Date();

    // ── 1. Consultas base en paralelo ──────────────────────────────
    const [
      featuredProductsSnap,
      featuredFactoriesSnap,
      productsSnap,
      lotsSnap,
      usersSnap,
      manufacturersSnap,
    ] = await Promise.all([
      db.collection('featured')
        .where('type', '==', 'product')
        .where('active', '==', true)
        .where('expired', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get(),

      db.collection('featured')
        .where('type', '==', 'factory')
        .where('active', '==', true)
        .where('expired', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(6)
        .get(),

      // Solo category para calcular el grid de categorías
      db.collection('products')
        .where('active', '==', true)
        .select('category')
        .limit(200)
        .get(),

      // Contadores trust bar
      db.collection('lots').where('status', '==', 'completed').count().get(),
      db.collection('users').count().get(),
      db.collection('manufacturers')
        .where('verification.status', '==', 'verified')
        .count()
        .get(),
    ]);

    // ── 2. Filtrar expirados (igual que la route) ──────────────────
    const validFeaturedProductDocs = featuredProductsSnap.docs.filter(doc => {
      const endDate = doc.data().endDate?.toDate();
      if (endDate && endDate < now) {
        // Marcar como expirado en background sin bloquear el render
        doc.ref.update({ expired: true, active: false, updatedAt: new Date() });
        return false;
      }
      return true;
    });

    const validFeaturedFactoryDocs = featuredFactoriesSnap.docs.filter(doc => {
      const endDate = doc.data().endDate?.toDate();
      if (endDate && endDate < now) {
        doc.ref.update({ expired: true, active: false, updatedAt: new Date() });
        return false;
      }
      return true;
    });

    // ── 3. Queries secundarias EN PARALELO (no en serie como la route) ──
    const productIds  = validFeaturedProductDocs.map(d => d.data().itemId).filter(Boolean);
    const factoryIds  = validFeaturedFactoryDocs.map(d => d.data().itemId).filter(Boolean);

    const [productSnaps, factorySnaps] = await Promise.all([
      Promise.all(productIds.map(id => db.collection('products').doc(id).get())),
      Promise.all(factoryIds.map(id => db.collection('manufacturers').doc(id).get())),
    ]);

    // ── 4. Mapear productos destacados ────────────────────────────
    const featuredProducts = validFeaturedProductDocs
      .map((doc, i) => {
        const snap = productSnaps[i];
        if (!snap?.exists) return null;
        const p = snap.data()!;
        return {
          id: doc.id,
          type: doc.data().type,
          itemId: doc.data().itemId,
          endDate: doc.data().endDate?.toDate()?.toISOString(),
          metadata: doc.data().metadata,
          itemData: {
            id: snap.id,
            name: p.name || '',
            price: p.price || 0,
            minimumOrder: p.minimumOrder || 0,
            category: p.category || '',
          },
        };
      })
      .filter(Boolean);

    // ── 5. Mapear fábricas destacadas ─────────────────────────────
    const featuredFactories = validFeaturedFactoryDocs
      .map((doc, i) => {
        const snap = factorySnaps[i];
        if (!snap?.exists) return null;
        const f = snap.data()!;
        return {
          id: doc.id,
          type: doc.data().type,
          itemId: doc.data().itemId,
          endDate: doc.data().endDate?.toDate()?.toISOString(),
          metadata: doc.data().metadata,
          itemData: {
            id: snap.id,
            name: f.businessName || f.name || 'Fábrica',
            description: f.description || '',
            address: f.address?.formattedAddress || '',
          },
        };
      })
      .filter(Boolean);

    // ── 6. Productos para categorías ──────────────────────────────
    const products = productsSnap.docs.map(doc => ({
      id: doc.id,
      name: '',
      price: 0,
      minimumOrder: 0,
      shippingMethods: [],
      category: doc.data().category || 'otros',
    }));

    // ── 7. Stats trust bar ────────────────────────────────────────
    const stats = {
      lotsCompleted:     lotsSnap.data().count        ?? 0,
      totalUsers:        usersSnap.data().count        ?? 0,
      verifiedFactories: manufacturersSnap.data().count ?? 0,
    };

    return { featuredProducts, featuredFactories, products, stats };

  } catch (error) {
    console.error('Error pre-cargando home:', error);
    return {
      featuredProducts: [],
      featuredFactories: [],
      products: [],
      stats: null,
    };
  }
}

export default async function Page() {
  const { featuredProducts, featuredFactories, products, stats } = await getHomeData();

  return (
    <HomePrincipal
      initialStats={stats}
      initialProducts={products}
      initialFeaturedProducts={featuredProducts as any}
      initialFeaturedFactories={featuredFactories as any}
    />
  );
}